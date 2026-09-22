//! Version-pinned edits to one language account, with append-only history.
//!
//! The generic desktop transcript update re-reads and re-applies its mutation against
//! whatever it finds, up to five times. That is right for live capture and wrong here:
//! a correction the reader typed against one reading must not silently land on text
//! that changed underneath it. Every entry point below pins the trigger-maintained
//! `transcripts.content_version` — not `content_revision`, which a writer can leave
//! alone while changing `words_json` — compares it inside one `BEGIN IMMEDIATE`
//! transaction, and reports a stale base as an outcome rather than writing.
//!
//! Undo is another checked edit, not an in-memory stack, so it survives a restart.
use serde_json::{Value, json};
use sqlx::SqlitePool;

use crate::dialext::{Error, invalid};

/// What a checked edit did. `Stale` is an expected answer, not a failure: the caller
/// still holds the reader's typing and can offer a refresh against `content_version`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EditOutcome {
    Applied {
        edit_id: String,
        sequence: i64,
        content_version: String,
    },
    Stale {
        content_version: String,
    },
    /// Nothing about the account's text would change.
    Unchanged {
        content_version: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct WordChange {
    word_id: String,
    previous_text: String,
    next_text: String,
}

/// Distribute `text` across `word_ids` exactly as the desktop's own segment edit does,
/// so the native owner and the interface agree on what a passage edit means.
fn distribute(text: &str, word_ids: &[String]) -> Vec<(String, String)> {
    let tokens: Vec<&str> = text.split_whitespace().collect();
    word_ids
        .iter()
        .enumerate()
        .map(|(index, word_id)| {
            let next = if index + 1 == word_ids.len() {
                tokens.get(index..).unwrap_or_default().join(" ")
            } else {
                tokens.get(index).copied().unwrap_or_default().to_string()
            };
            (word_id.clone(), next)
        })
        .collect()
}

struct Account {
    transcript_id: String,
    words: Value,
    content_version: String,
}

async fn load_account(
    tx: &mut sqlx::SqliteConnection,
    session_id: &str,
    account_id: &str,
) -> Result<Account, Error> {
    let Some((transcript_id, words_json, content_version)) =
        sqlx::query_as::<_, (String, String, String)>(
            "SELECT t.id, t.words_json, t.content_version FROM dialext_accounts a
             JOIN transcripts t ON t.id = a.transcript_id AND t.session_id = a.session_id
             JOIN sessions s ON s.id = a.session_id AND s.deleted_at IS NULL
             WHERE a.id = ? AND a.session_id = ? AND t.deleted_at IS NULL",
        )
        .bind(account_id)
        .bind(session_id)
        .fetch_optional(&mut *tx)
        .await?
    else {
        return Err(invalid("This language account is unavailable."));
    };
    Ok(Account {
        transcript_id,
        words: serde_json::from_str(&words_json)?,
        content_version,
    })
}

/// Apply `changes` to the account's words and append one history row. The caller has
/// already compared the pinned version inside this transaction.
async fn write_edit(
    tx: &mut sqlx::SqliteConnection,
    session_id: &str,
    account_id: &str,
    account: &Account,
    changes: &[WordChange],
    undoes_edit_id: Option<&str>,
) -> Result<EditOutcome, Error> {
    let mut words = account.words.clone();
    let mut applied = 0usize;
    for word in words.as_array_mut().into_iter().flatten() {
        let Some(id) = word["id"].as_str() else {
            continue;
        };
        if let Some(change) = changes.iter().find(|change| change.word_id == id) {
            // Only `text` moves. Anchors, metadata and speaker attribution are evidence.
            word["text"] = json!(change.next_text);
            applied += 1;
        }
    }
    if applied != changes.len() {
        return Err(invalid("That passage is no longer part of this reading."));
    }

    let updated = sqlx::query(
        "UPDATE transcripts SET words_json = ?, content_revision = content_revision + 1,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ? AND session_id = ? AND content_version = ? AND deleted_at IS NULL",
    )
    .bind(words.to_string())
    .bind(&account.transcript_id)
    .bind(session_id)
    .bind(&account.content_version)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if updated != 1 {
        // The pinned version was compared above inside this immediate transaction, so
        // this is an invariant failure rather than an ordinary race.
        return Err(invalid("This reading could not be updated."));
    }

    let result_version =
        sqlx::query_scalar::<_, String>("SELECT content_version FROM transcripts WHERE id = ?")
            .bind(&account.transcript_id)
            .fetch_one(&mut *tx)
            .await?;

    let sequence = sqlx::query_scalar::<_, i64>(
        "SELECT COALESCE(max(sequence), 0) + 1 FROM dialext_account_edits
         WHERE session_id = ? AND account_id = ?",
    )
    .bind(session_id)
    .bind(account_id)
    .fetch_one(&mut *tx)
    .await?;
    let edit_id = format!("{account_id}:edit:{sequence}");
    let changes_json = Value::Array(
        changes
            .iter()
            .map(|change| {
                json!({
                    "word_id": change.word_id,
                    "previous_text": change.previous_text,
                    "next_text": change.next_text,
                })
            })
            .collect(),
    );
    sqlx::query(
        "INSERT INTO dialext_account_edits
         (id, session_id, account_id, sequence, base_content_version, result_content_version,
          changes_json, undoes_edit_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&edit_id)
    .bind(session_id)
    .bind(account_id)
    .bind(sequence)
    .bind(&account.content_version)
    .bind(&result_version)
    .bind(changes_json.to_string())
    .bind(undoes_edit_id)
    .execute(&mut *tx)
    .await?;

    propose_summary_corrections(
        tx,
        session_id,
        account_id,
        &result_version,
        &edit_id,
        changes,
    )
    .await?;

    Ok(EditOutcome::Applied {
        edit_id,
        sequence,
        content_version: result_version,
    })
}

/// The text of a generated summary block, as the reader currently sees it.
pub(crate) fn block_text(node: &Value) -> String {
    node["content"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|paragraph| {
            paragraph["content"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(|inline| inline["text"].as_str())
                .collect::<String>()
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

/// Offer each generated summary of this recording a proposal for the blocks this
/// correction affects, in the same transaction as the correction, so the proposal is
/// pinned to exactly the account version the correction produced.
///
/// A block is only targeted while it still reads as generated: its text equals the
/// passage before this edit, or an earlier correction's proposal for it is still
/// pending against an untouched summary. A block the reader rewrote by hand is theirs
/// and is never proposed over. Nothing in the summary changes until a proposal is
/// accepted.
async fn propose_summary_corrections(
    tx: &mut sqlx::SqliteConnection,
    session_id: &str,
    account_id: &str,
    result_version: &str,
    edit_id: &str,
    changes: &[WordChange],
) -> Result<(), Error> {
    let documents = sqlx::query_as::<_, (String, String, String)>(
        "SELECT id, body, content_version FROM session_documents
         WHERE session_id = ? AND deleted_at IS NULL
           AND kind IN ('summary', 'template_output') AND body_format = 'prosemirror_json'
         ORDER BY id",
    )
    .bind(session_id)
    .fetch_all(&mut *tx)
    .await?;

    for (document_id, body, document_version) in documents {
        let Ok(body) = serde_json::from_str::<Value>(&body) else {
            continue;
        };
        let blocks: Vec<(String, String)> = body["content"]
            .as_array()
            .into_iter()
            .flatten()
            .filter(|node| node["type"].as_str() == Some("dialextBlock"))
            .filter_map(|node| Some((node["attrs"]["id"].as_str()?.to_string(), block_text(node))))
            .collect();
        if blocks.is_empty() {
            continue;
        }

        // A pending correction proposal for this summary still describes it only while
        // the summary is unchanged since; otherwise it is left to be refused as stale.
        let pending = sqlx::query_as::<_, (String, String)>(
            "SELECT id, target_blocks_json FROM session_proposals
             WHERE session_id = ? AND target_id = ? AND account_id = ? AND source = 'dialext'
               AND status = 'pending' AND base_document_version = ?",
        )
        .bind(session_id)
        .bind(&document_id)
        .bind(account_id)
        .bind(&document_version)
        .fetch_all(&mut *tx)
        .await?;
        let mut targets: Vec<(String, String)> = Vec::new();
        for (_, json) in &pending {
            let earlier: Value = serde_json::from_str(json).unwrap_or(Value::Array(Vec::new()));
            for block in earlier.as_array().into_iter().flatten() {
                if let (Some(id), Some(text)) = (block["block_id"].as_str(), block["text"].as_str())
                {
                    targets.retain(|(existing, _)| existing != id);
                    targets.push((id.to_string(), text.to_string()));
                }
            }
        }

        for change in changes {
            let Some((_, current)) = blocks.iter().find(|(id, _)| *id == change.word_id) else {
                continue;
            };
            let awaiting = targets.iter().any(|(id, _)| *id == change.word_id);
            if *current != change.previous_text && !awaiting {
                continue;
            }
            targets.retain(|(id, _)| *id != change.word_id);
            targets.push((change.word_id.clone(), change.next_text.clone()));
        }
        // A target that would leave its block as it already reads proposes nothing.
        targets.retain(|(id, text)| {
            blocks
                .iter()
                .any(|(block, current)| block == id && current != text)
        });

        if pending.is_empty() && targets.is_empty() {
            continue;
        }
        for (id, _) in &pending {
            sqlx::query(
                "UPDATE session_proposals SET status = 'superseded',
                   updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
                 WHERE id = ? AND status = 'pending'",
            )
            .bind(id)
            .execute(&mut *tx)
            .await?;
        }
        if targets.is_empty() {
            continue;
        }

        let current_markdown = targets
            .iter()
            .filter_map(|(id, _)| blocks.iter().find(|(block, _)| block == id))
            .map(|(_, text)| text.as_str())
            .collect::<Vec<_>>()
            .join("\n\n");
        let proposed_markdown = targets
            .iter()
            .map(|(_, text)| text.as_str())
            .collect::<Vec<_>>()
            .join("\n\n");
        let target_blocks = Value::Array(
            targets
                .iter()
                .map(|(id, text)| json!({ "block_id": id, "text": text }))
                .collect(),
        );
        sqlx::query(
            "INSERT INTO session_proposals (id, workspace_id, session_id, kind, target_id,
               account_id, base_document_version, base_transcript_version, target_blocks_json,
               current_markdown, proposed_markdown, status, source)
             SELECT ?, workspace_id, id, 'summary_replace', ?, ?, ?, ?, ?, ?, ?, 'pending', 'dialext'
             FROM sessions WHERE id = ?",
        )
        .bind(format!("{edit_id}:{document_id}"))
        .bind(&document_id)
        .bind(account_id)
        .bind(&document_version)
        .bind(result_version)
        .bind(target_blocks.to_string())
        .bind(current_markdown)
        .bind(proposed_markdown)
        .bind(session_id)
        .execute(&mut *tx)
        .await?;
    }
    Ok(())
}

/// Replace the text of one passage's words, pinned to `expected_content_version`.
pub async fn edit_passage(
    pool: &SqlitePool,
    session_id: &str,
    account_id: &str,
    expected_content_version: &str,
    word_ids: &[String],
    text: &str,
) -> Result<EditOutcome, Error> {
    if word_ids.is_empty() {
        return Err(invalid("Select some words to correct."));
    }
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
    let account = load_account(&mut tx, session_id, account_id).await?;
    if account.content_version != expected_content_version {
        return Ok(EditOutcome::Stale {
            content_version: account.content_version,
        });
    }

    let mut current = std::collections::BTreeMap::new();
    for word in account.words.as_array().into_iter().flatten() {
        if let Some(id) = word["id"].as_str() {
            current.insert(
                id.to_string(),
                word["text"].as_str().unwrap_or_default().to_string(),
            );
        }
    }
    let mut changes = Vec::new();
    for (word_id, next_text) in distribute(text, word_ids) {
        let Some(previous_text) = current.get(&word_id) else {
            return Err(invalid("That passage is no longer part of this reading."));
        };
        if *previous_text == next_text {
            continue;
        }
        changes.push(WordChange {
            word_id,
            previous_text: previous_text.clone(),
            next_text,
        });
    }
    if changes.is_empty() {
        let content_version = account.content_version.clone();
        tx.commit().await?;
        return Ok(EditOutcome::Unchanged { content_version });
    }

    let outcome = write_edit(&mut tx, session_id, account_id, &account, &changes, None).await?;
    tx.commit().await?;
    Ok(outcome)
}

/// Revert the newest edit of this account that is not itself an undo and has not
/// already been undone, as another checked, recorded edit.
pub async fn undo_last_edit(
    pool: &SqlitePool,
    session_id: &str,
    account_id: &str,
    expected_content_version: &str,
) -> Result<EditOutcome, Error> {
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
    let account = load_account(&mut tx, session_id, account_id).await?;
    if account.content_version != expected_content_version {
        return Ok(EditOutcome::Stale {
            content_version: account.content_version,
        });
    }

    let Some((target_id, changes_json)) = sqlx::query_as::<_, (String, String)>(
        "SELECT e.id, e.changes_json FROM dialext_account_edits e
         WHERE e.session_id = ? AND e.account_id = ? AND e.undoes_edit_id IS NULL
           AND NOT EXISTS (SELECT 1 FROM dialext_account_edits u WHERE u.undoes_edit_id = e.id)
         ORDER BY e.sequence DESC LIMIT 1",
    )
    .bind(session_id)
    .bind(account_id)
    .fetch_optional(&mut *tx)
    .await?
    else {
        let content_version = account.content_version.clone();
        tx.commit().await?;
        return Ok(EditOutcome::Unchanged { content_version });
    };

    let recorded: Value = serde_json::from_str(&changes_json)?;
    let mut current = std::collections::BTreeMap::new();
    for word in account.words.as_array().into_iter().flatten() {
        if let Some(id) = word["id"].as_str() {
            current.insert(
                id.to_string(),
                word["text"].as_str().unwrap_or_default().to_string(),
            );
        }
    }
    let mut changes = Vec::new();
    for change in recorded.as_array().into_iter().flatten() {
        let word_id = change["word_id"].as_str().unwrap_or_default().to_string();
        let previous_text = change["previous_text"].as_str().unwrap_or_default();
        let next_text = change["next_text"].as_str().unwrap_or_default();
        let Some(stored) = current.get(&word_id) else {
            return Err(invalid("That passage is no longer part of this reading."));
        };
        // Undo reverts what this edit did. If something outside this history changed the
        // same words, reverting would discard it, so refuse instead.
        if stored != next_text {
            return Err(invalid(
                "This passage changed since that correction. Review it instead of undoing.",
            ));
        }
        changes.push(WordChange {
            word_id,
            previous_text: next_text.to_string(),
            next_text: previous_text.to_string(),
        });
    }
    changes.retain(|change| change.previous_text != change.next_text);
    if changes.is_empty() {
        let content_version = account.content_version.clone();
        tx.commit().await?;
        return Ok(EditOutcome::Unchanged { content_version });
    }

    let outcome = write_edit(
        &mut tx,
        session_id,
        account_id,
        &account,
        &changes,
        Some(&target_id),
    )
    .await?;
    tx.commit().await?;
    Ok(outcome)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    async fn adopted(vault: &Path) -> (anlg_db_core::Db, String, String) {
        let db = anlg_db_core::Db::connect_memory_plain().await.unwrap();
        anlg_db_app::prepare_schema(&db).await.unwrap();
        let bundle: Value = serde_json::from_str(include_str!(
            "../../../dialext/fixtures/language-practice.json"
        ))
        .unwrap();
        let id = format!("dialext-{}", bundle["recording"]["id"].as_str().unwrap());
        sqlx::query("INSERT INTO sessions(id,metadata_json) VALUES(?,?)")
            .bind(&id)
            .bind(
                json!({"dialext":{"version":1,"selected_language":"english","original":bundle}})
                    .to_string(),
            )
            .execute(db.pool())
            .await
            .unwrap();
        sqlx::query("INSERT INTO transcripts(id,session_id,words_json) VALUES(?,?,'[{\"id\":\"w\",\"text\":\"saved\"}]')")
            .bind(format!("{id}:reading"))
            .bind(&id)
            .execute(db.pool())
            .await
            .unwrap();
        crate::dialext::migrate_recording(db.pool(), vault, &id)
            .await
            .unwrap();
        let account: String = sqlx::query_scalar(
            "SELECT id FROM dialext_accounts WHERE session_id = ? AND target_language = 'en'",
        )
        .bind(&id)
        .fetch_one(db.pool())
        .await
        .unwrap();
        (db, id, account)
    }

    async fn version(db: &anlg_db_core::Db, account: &str) -> String {
        sqlx::query_scalar(
            "SELECT t.content_version FROM dialext_accounts a
             JOIN transcripts t ON t.id = a.transcript_id WHERE a.id = ?",
        )
        .bind(account)
        .fetch_one(db.pool())
        .await
        .unwrap()
    }

    async fn words(db: &anlg_db_core::Db, account: &str) -> Vec<(String, String)> {
        let json: String = sqlx::query_scalar(
            "SELECT t.words_json FROM dialext_accounts a
             JOIN transcripts t ON t.id = a.transcript_id WHERE a.id = ?",
        )
        .bind(account)
        .fetch_one(db.pool())
        .await
        .unwrap();
        serde_json::from_str::<Value>(&json)
            .unwrap()
            .as_array()
            .unwrap()
            .iter()
            .map(|word| {
                (
                    word["id"].as_str().unwrap_or_default().to_string(),
                    word["text"].as_str().unwrap_or_default().to_string(),
                )
            })
            .collect()
    }

    #[test]
    fn distributes_text_the_way_the_desktop_segment_edit_does() {
        let ids = vec!["a".to_string(), "b".to_string(), "c".to_string()];
        assert_eq!(
            distribute("one two three four", &ids),
            vec![
                ("a".to_string(), "one".to_string()),
                ("b".to_string(), "two".to_string()),
                ("c".to_string(), "three four".to_string()),
            ],
            "the last word absorbs the remainder"
        );
        assert_eq!(
            distribute("one", &ids),
            vec![
                ("a".to_string(), "one".to_string()),
                ("b".to_string(), String::new()),
                ("c".to_string(), String::new()),
            ],
            "missing tokens empty their words rather than shifting the rest"
        );
    }

    #[tokio::test]
    async fn a_pinned_edit_applies_and_records_its_history() {
        let vault = tempfile::tempdir().unwrap();
        let (db, session, account) = adopted(vault.path()).await;
        let before = words(&db, &account).await;
        let target = before[0].0.clone();
        let pinned = version(&db, &account).await;

        let outcome = edit_passage(
            db.pool(),
            &session,
            &account,
            &pinned,
            std::slice::from_ref(&target),
            "Corrected.",
        )
        .await
        .unwrap();
        let EditOutcome::Applied {
            edit_id,
            sequence,
            content_version,
        } = outcome
        else {
            panic!("expected the pinned edit to apply, got {outcome:?}");
        };
        assert_eq!(sequence, 1);
        assert_ne!(
            content_version, pinned,
            "applying an edit must move the pinned token"
        );

        let after = words(&db, &account).await;
        assert_eq!(after[0], (target.clone(), "Corrected.".to_string()));
        assert_eq!(
            after[1..],
            before[1..],
            "an edit must not touch words it was not given"
        );

        let (base, result, changes): (String, String, String) = sqlx::query_as(
            "SELECT base_content_version, result_content_version, changes_json
             FROM dialext_account_edits WHERE id = ?",
        )
        .bind(&edit_id)
        .fetch_one(db.pool())
        .await
        .unwrap();
        assert_eq!(base, pinned);
        assert_eq!(result, content_version);
        let changes: Value = serde_json::from_str(&changes).unwrap();
        assert_eq!(changes[0]["previous_text"], json!(before[0].1));
        assert_eq!(changes[0]["next_text"], json!("Corrected."));
    }

    #[tokio::test]
    async fn a_stale_edit_refuses_and_leaves_the_reading_untouched() {
        let vault = tempfile::tempdir().unwrap();
        let (db, session, account) = adopted(vault.path()).await;
        let target = words(&db, &account).await[0].0.clone();
        let stale = version(&db, &account).await;

        edit_passage(
            db.pool(),
            &session,
            &account,
            &stale,
            std::slice::from_ref(&target),
            "First writer.",
        )
        .await
        .unwrap();
        let after_first = words(&db, &account).await;
        let moved = version(&db, &account).await;

        let outcome = edit_passage(
            db.pool(),
            &session,
            &account,
            &stale,
            std::slice::from_ref(&target),
            "Second writer typing against the old base.",
        )
        .await
        .unwrap();
        assert_eq!(
            outcome,
            EditOutcome::Stale {
                content_version: moved.clone()
            },
            "a stale base must report the current version, not write"
        );
        assert_eq!(
            words(&db, &account).await,
            after_first,
            "the refused edit must leave every word as the first writer left it"
        );
        assert_eq!(
            sqlx::query_scalar::<_, i64>("SELECT count(*) FROM dialext_account_edits")
                .fetch_one(db.pool())
                .await
                .unwrap(),
            1,
            "a refused edit records no history"
        );
    }

    #[tokio::test]
    async fn undo_is_another_checked_edit_and_is_durable() {
        let vault = tempfile::tempdir().unwrap();
        let (db, session, account) = adopted(vault.path()).await;
        let original = words(&db, &account).await;
        let target = original[0].0.clone();

        let pinned = version(&db, &account).await;
        edit_passage(
            db.pool(),
            &session,
            &account,
            &pinned,
            std::slice::from_ref(&target),
            "One.",
        )
        .await
        .unwrap();
        let pinned = version(&db, &account).await;
        edit_passage(
            db.pool(),
            &session,
            &account,
            &pinned,
            std::slice::from_ref(&target),
            "Two.",
        )
        .await
        .unwrap();

        let pinned = version(&db, &account).await;
        let outcome = undo_last_edit(db.pool(), &session, &account, &pinned)
            .await
            .unwrap();
        assert!(matches!(outcome, EditOutcome::Applied { sequence: 3, .. }));
        assert_eq!(
            words(&db, &account).await[0].1,
            "One.",
            "undo reverts the newest edit only"
        );

        let pinned = version(&db, &account).await;
        undo_last_edit(db.pool(), &session, &account, &pinned)
            .await
            .unwrap();
        assert_eq!(
            words(&db, &account).await[0],
            original[0],
            "undoing again restores the text the reading was adopted with"
        );

        // The history is the durable stack: nothing here is held in memory, so a
        // restart that reopens this database sees the same four rows.
        let rows: Vec<(i64, Option<String>)> = sqlx::query_as(
            "SELECT sequence, undoes_edit_id FROM dialext_account_edits
             WHERE session_id = ? AND account_id = ? ORDER BY sequence",
        )
        .bind(&session)
        .bind(&account)
        .fetch_all(db.pool())
        .await
        .unwrap();
        assert_eq!(rows.len(), 4);
        assert_eq!(rows[0].1, None);
        assert_eq!(
            rows[2].1.as_deref(),
            Some(format!("{account}:edit:2").as_str())
        );
        assert_eq!(
            rows[3].1.as_deref(),
            Some(format!("{account}:edit:1").as_str())
        );
    }

    #[tokio::test]
    async fn a_stale_undo_refuses_and_history_stays_append_only() {
        let vault = tempfile::tempdir().unwrap();
        let (db, session, account) = adopted(vault.path()).await;
        let target = words(&db, &account).await[0].0.clone();
        let pinned = version(&db, &account).await;
        edit_passage(db.pool(), &session, &account, &pinned, &[target], "One.")
            .await
            .unwrap();
        let after = words(&db, &account).await;

        let outcome = undo_last_edit(db.pool(), &session, &account, &pinned)
            .await
            .unwrap();
        assert!(
            matches!(outcome, EditOutcome::Stale { .. }),
            "undoing against the base the edit replaced is stale"
        );
        assert_eq!(words(&db, &account).await, after);

        assert!(
            sqlx::query("UPDATE dialext_account_edits SET changes_json = '[]'")
                .execute(db.pool())
                .await
                .is_err(),
            "history must refuse to be rewritten"
        );
    }

    #[tokio::test]
    async fn an_edit_outside_the_history_blocks_undo_rather_than_discarding_it() {
        let vault = tempfile::tempdir().unwrap();
        let (db, session, account) = adopted(vault.path()).await;
        let target = words(&db, &account).await[0].0.clone();
        let pinned = version(&db, &account).await;
        edit_passage(
            db.pool(),
            &session,
            &account,
            &pinned,
            std::slice::from_ref(&target),
            "Recorded.",
        )
        .await
        .unwrap();

        // Some other writer changes the same word without going through this history.
        let transcript: String =
            sqlx::query_scalar("SELECT transcript_id FROM dialext_accounts WHERE id = ?")
                .bind(&account)
                .fetch_one(db.pool())
                .await
                .unwrap();
        let mut current: Value = serde_json::from_str(
            &sqlx::query_scalar::<_, String>("SELECT words_json FROM transcripts WHERE id = ?")
                .bind(&transcript)
                .fetch_one(db.pool())
                .await
                .unwrap(),
        )
        .unwrap();
        current[0]["text"] = json!("Typed somewhere else.");
        sqlx::query("UPDATE transcripts SET words_json = ? WHERE id = ?")
            .bind(current.to_string())
            .bind(&transcript)
            .execute(db.pool())
            .await
            .unwrap();

        let pinned = version(&db, &account).await;
        let error = undo_last_edit(db.pool(), &session, &account, &pinned)
            .await
            .unwrap_err();
        assert!(
            error.to_string().contains("changed since that correction"),
            "undo must refuse rather than discard a change it did not record, got: {error}"
        );
        assert_eq!(words(&db, &account).await[0].1, "Typed somewhere else.");
    }

    async fn generated_summary(db: &anlg_db_core::Db, session: &str, account: &str) {
        let content: Vec<Value> = words(db, account)
            .await
            .into_iter()
            .map(|(id, text)| {
                json!({
                    "type": "dialextBlock",
                    "attrs": { "id": id },
                    "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": text }] }],
                })
            })
            .collect();
        sqlx::query(
            "INSERT INTO session_documents(id,session_id,kind,template_id,body,body_format)
             VALUES('lecture',?,'template_output','lecture-template',?,'prosemirror_json')",
        )
        .bind(session)
        .bind(json!({ "type": "doc", "content": content }).to_string())
        .execute(db.pool())
        .await
        .unwrap();
    }

    async fn pending(db: &anlg_db_core::Db) -> Vec<(String, Value)> {
        sqlx::query_as::<_, (String, String)>(
            "SELECT id, target_blocks_json FROM session_proposals
             WHERE status = 'pending' ORDER BY created_at, id",
        )
        .fetch_all(db.pool())
        .await
        .unwrap()
        .into_iter()
        .map(|(id, json)| (id, serde_json::from_str(&json).unwrap()))
        .collect()
    }

    async fn summary_block(db: &anlg_db_core::Db, index: usize) -> String {
        let body: Value = serde_json::from_str(
            &sqlx::query_scalar::<_, String>(
                "SELECT body FROM session_documents WHERE id = 'lecture'",
            )
            .fetch_one(db.pool())
            .await
            .unwrap(),
        )
        .unwrap();
        block_text(&body["content"][index])
    }

    async fn set_summary_block(db: &anlg_db_core::Db, index: usize, text: &str) {
        let mut body: Value = serde_json::from_str(
            &sqlx::query_scalar::<_, String>(
                "SELECT body FROM session_documents WHERE id = 'lecture'",
            )
            .fetch_one(db.pool())
            .await
            .unwrap(),
        )
        .unwrap();
        body["content"][index]["content"][0]["content"][0]["text"] = json!(text);
        sqlx::query("UPDATE session_documents SET body = ? WHERE id = 'lecture'")
            .bind(body.to_string())
            .execute(db.pool())
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn a_correction_proposes_only_its_block_and_acceptance_keeps_manual_edits() {
        let vault = tempfile::tempdir().unwrap();
        let (db, session, _) = adopted(vault.path()).await;
        // The harness's selected reading holds one saved word; the generated alternate
        // carries the fixture's own passages.
        let mut account = String::new();
        let mut passages = Vec::new();
        for (candidate,) in sqlx::query_as::<_, (String,)>(
            "SELECT id FROM dialext_accounts WHERE session_id = ? ORDER BY id",
        )
        .bind(&session)
        .fetch_all(db.pool())
        .await
        .unwrap()
        {
            let found = words(&db, &candidate).await;
            if found.len() > passages.len() {
                account = candidate;
                passages = found;
            }
        }
        assert!(passages.len() >= 2, "the fixture needs two passages");
        generated_summary(&db, &session, &account).await;

        // The reader rewrites the second block by hand before correcting the first passage.
        set_summary_block(&db, 1, "My own wording.").await;

        let pinned = version(&db, &account).await;
        let EditOutcome::Applied {
            content_version, ..
        } = edit_passage(
            db.pool(),
            &session,
            &account,
            &pinned,
            std::slice::from_ref(&passages[0].0),
            "I would like to order tea.",
        )
        .await
        .unwrap()
        else {
            panic!("expected the correction to apply");
        };

        let proposals = pending(&db).await;
        assert_eq!(proposals.len(), 1);
        assert_eq!(
            proposals[0].1,
            json!([{ "block_id": passages[0].0, "text": "I would like to order tea." }]),
            "only the corrected passage's block is proposed"
        );
        let (pin, base): (String, String) = sqlx::query_as(
            "SELECT base_transcript_version, base_document_version FROM session_proposals",
        )
        .fetch_one(db.pool())
        .await
        .unwrap();
        assert_eq!(
            pin, content_version,
            "pinned to the version this correction produced"
        );
        assert_eq!(
            summary_block(&db, 0).await,
            passages[0].1,
            "proposing changes nothing until the reader accepts"
        );
        assert!(!base.is_empty());

        let outcome = crate::dialext_proposals::apply_proposal(db.pool(), &proposals[0].0)
            .await
            .unwrap();
        assert!(matches!(
            outcome,
            crate::dialext_proposals::ProposalOutcome::Applied {
                blocks_changed: 1,
                ..
            }
        ));
        assert_eq!(summary_block(&db, 0).await, "I would like to order tea.");
        assert_eq!(
            summary_block(&db, 1).await,
            "My own wording.",
            "accepting a targeted proposal keeps the unrelated manual edit"
        );
    }

    #[tokio::test]
    async fn a_block_the_reader_rewrote_is_never_proposed_over() {
        let vault = tempfile::tempdir().unwrap();
        let (db, session, account) = adopted(vault.path()).await;
        generated_summary(&db, &session, &account).await;
        let target = words(&db, &account).await[0].0.clone();
        set_summary_block(&db, 0, "Written by hand.").await;

        let pinned = version(&db, &account).await;
        edit_passage(
            db.pool(),
            &session,
            &account,
            &pinned,
            std::slice::from_ref(&target),
            "Corrected.",
        )
        .await
        .unwrap();
        assert!(pending(&db).await.is_empty());
        assert_eq!(summary_block(&db, 0).await, "Written by hand.");
    }

    #[tokio::test]
    async fn a_second_correction_supersedes_the_first_proposal_and_undo_withdraws_it() {
        let vault = tempfile::tempdir().unwrap();
        let (db, session, account) = adopted(vault.path()).await;
        generated_summary(&db, &session, &account).await;
        let (target, original) = words(&db, &account).await[0].clone();

        let pinned = version(&db, &account).await;
        edit_passage(
            db.pool(),
            &session,
            &account,
            &pinned,
            std::slice::from_ref(&target),
            "One.",
        )
        .await
        .unwrap();
        let pinned = version(&db, &account).await;
        edit_passage(
            db.pool(),
            &session,
            &account,
            &pinned,
            std::slice::from_ref(&target),
            "Two.",
        )
        .await
        .unwrap();

        let proposals = pending(&db).await;
        assert_eq!(
            proposals.len(),
            1,
            "one live proposal per summary, not a stale pile"
        );
        assert_eq!(proposals[0].1[0]["text"], json!("Two."));
        let superseded: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM session_proposals WHERE status = 'superseded'",
        )
        .fetch_one(db.pool())
        .await
        .unwrap();
        assert_eq!(superseded, 1);

        // Undoing both corrections brings the passage back to what the summary says,
        // so nothing is left to propose.
        let pinned = version(&db, &account).await;
        undo_last_edit(db.pool(), &session, &account, &pinned)
            .await
            .unwrap();
        let pinned = version(&db, &account).await;
        undo_last_edit(db.pool(), &session, &account, &pinned)
            .await
            .unwrap();
        assert!(pending(&db).await.is_empty());
        assert_eq!(summary_block(&db, 0).await, original);
    }
}
