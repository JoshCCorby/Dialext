//! Atomic, version-pinned acceptance of a correction-driven summary proposal.
//!
//! The interface's existing accept path compares a `base_updated_at` timestamp, then
//! writes the document and the proposal status as two separate statements, replacing
//! the whole body from the proposed markdown. That is useful inbox infrastructure and
//! not an atomic stale-write guarantee: the comparison and the write can straddle
//! another writer, the timestamp misses a change within the same clock tick, and
//! replacing the whole body discards manual edits to blocks the proposal never named.
//!
//! Here, one `BEGIN IMMEDIATE` transaction compares the document's and the account
//! transcript's trigger-maintained `content_version` tokens, replaces only the blocks
//! the proposal names, and transitions the proposal's status. A mismatch in either
//! token leaves the document and the proposal exactly as they were.
use serde_json::{Value, json};
use sqlx::SqlitePool;

use crate::dialext::{Error, invalid};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProposalOutcome {
    Applied {
        document_version: String,
        blocks_changed: usize,
    },
    /// The document or the account moved after the proposal was made. Nothing written.
    Stale {
        document_version: String,
        transcript_version: String,
    },
    /// Already applied or declined; applying again is not an error.
    Settled { status: String },
}

struct Proposal {
    session_id: String,
    target_id: String,
    account_id: String,
    base_document_version: String,
    base_transcript_version: String,
    target_blocks: Vec<(String, String)>,
    status: String,
}

/// Replace the text of every block the proposal names, leaving every other block —
/// including ones the reader edited or added by hand — exactly as stored.
fn patch_blocks(body: &mut Value, targets: &[(String, String)]) -> usize {
    let mut changed = 0;
    let Some(content) = body.get_mut("content").and_then(Value::as_array_mut) else {
        return 0;
    };
    for node in content.iter_mut() {
        if node["type"].as_str() != Some("dialextBlock") {
            continue;
        }
        let Some(id) = node["attrs"]["id"].as_str() else {
            continue;
        };
        let Some((_, text)) = targets.iter().find(|(target, _)| target == id) else {
            continue;
        };
        // The block keeps its identity; only what is inside it is replaced.
        node["content"] = json!([{
            "type": "paragraph",
            "content": [{ "type": "text", "text": text }],
        }]);
        changed += 1;
    }
    changed
}

async fn load_proposal(
    tx: &mut sqlx::SqliteConnection,
    proposal_id: &str,
) -> Result<Proposal, Error> {
    let Some((session_id, target_id, account_id, base_doc, base_tx, blocks, status)) =
        sqlx::query_as::<_, (String, String, String, String, String, String, String)>(
            "SELECT session_id, target_id, account_id, base_document_version,
                base_transcript_version, target_blocks_json, status
             FROM session_proposals WHERE id = ?",
        )
        .bind(proposal_id)
        .fetch_optional(&mut *tx)
        .await?
    else {
        return Err(invalid("That proposal is no longer available."));
    };
    let parsed: Value = serde_json::from_str(&blocks).unwrap_or(Value::Array(Vec::new()));
    let target_blocks = parsed
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|block| {
            Some((
                block["block_id"].as_str()?.to_string(),
                block["text"].as_str()?.to_string(),
            ))
        })
        .collect();
    Ok(Proposal {
        session_id,
        target_id,
        account_id,
        base_document_version: base_doc,
        base_transcript_version: base_tx,
        target_blocks,
        status,
    })
}

pub async fn apply_proposal(
    pool: &SqlitePool,
    proposal_id: &str,
) -> Result<ProposalOutcome, Error> {
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
    let proposal = load_proposal(&mut tx, proposal_id).await?;
    if proposal.status != "pending" {
        return Ok(ProposalOutcome::Settled {
            status: proposal.status,
        });
    }
    if proposal.target_blocks.is_empty() {
        return Err(invalid("This proposal names no summary blocks to change."));
    }

    let Some((body, document_version)) = sqlx::query_as::<_, (String, String)>(
        "SELECT body, content_version FROM session_documents
         WHERE id = ? AND session_id = ? AND deleted_at IS NULL",
    )
    .bind(&proposal.target_id)
    .bind(&proposal.session_id)
    .fetch_optional(&mut *tx)
    .await?
    else {
        return Err(invalid("That summary is no longer available."));
    };

    // The account's own reading is pinned too: a summary proposed from a correction
    // must not land after that correction itself changed again.
    let transcript_version = sqlx::query_scalar::<_, String>(
        "SELECT t.content_version FROM dialext_accounts a
         JOIN transcripts t ON t.id = a.transcript_id AND t.session_id = a.session_id
         WHERE a.id = ? AND a.session_id = ? AND t.deleted_at IS NULL",
    )
    .bind(&proposal.account_id)
    .bind(&proposal.session_id)
    .fetch_optional(&mut *tx)
    .await?
    .unwrap_or_default();

    if document_version != proposal.base_document_version
        || transcript_version != proposal.base_transcript_version
    {
        return Ok(ProposalOutcome::Stale {
            document_version,
            transcript_version,
        });
    }

    let mut parsed: Value = serde_json::from_str(&body)?;
    let blocks_changed = patch_blocks(&mut parsed, &proposal.target_blocks);
    if blocks_changed != proposal.target_blocks.len() {
        // A named block is gone. Applying the rest would be a partial edit the reader
        // never reviewed, so refuse the whole proposal.
        return Err(invalid(
            "This summary no longer has the blocks this proposal was written against.",
        ));
    }

    let updated = sqlx::query(
        "UPDATE session_documents SET body = ?,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ? AND session_id = ? AND content_version = ? AND deleted_at IS NULL",
    )
    .bind(parsed.to_string())
    .bind(&proposal.target_id)
    .bind(&proposal.session_id)
    .bind(&document_version)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if updated != 1 {
        return Err(invalid("This summary could not be updated."));
    }

    let settled = sqlx::query(
        "UPDATE session_proposals SET status = 'applied',
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ? AND status = 'pending'",
    )
    .bind(proposal_id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if settled != 1 {
        return Err(invalid("That proposal was already answered."));
    }

    let document_version = sqlx::query_scalar::<_, String>(
        "SELECT content_version FROM session_documents WHERE id = ?",
    )
    .bind(&proposal.target_id)
    .fetch_one(&mut *tx)
    .await?;

    // Both writes commit together, so the summary and the proposal's status can never
    // disagree about whether this proposal was applied.
    tx.commit().await?;
    Ok(ProposalOutcome::Applied {
        document_version,
        blocks_changed,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn block(id: &str, text: &str) -> Value {
        json!({
            "type": "dialextBlock",
            "attrs": { "id": id },
            "content": [{
                "type": "paragraph",
                "content": [{ "type": "text", "text": text }],
            }],
        })
    }

    fn summary_body() -> Value {
        json!({
            "type": "doc",
            "content": [
                block("b1", "Gary asked for two tickets."),
                block("b2", "He ordered coffee."),
                block("b3", "He thanked the clerk."),
            ],
        })
    }

    async fn seeded() -> (anlg_db_core::Db, String) {
        let db = anlg_db_core::Db::connect_memory_plain().await.unwrap();
        anlg_db_app::prepare_schema(&db).await.unwrap();
        sqlx::query("INSERT INTO sessions(id) VALUES('recording')")
            .execute(db.pool())
            .await
            .unwrap();
        sqlx::query(
            "INSERT INTO transcripts(id,session_id,words_json)
             VALUES('recording:english','recording','[{\"id\":\"w1\",\"text\":\"tea\"}]')",
        )
        .execute(db.pool())
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO dialext_accounts(id,session_id,transcript_id,target_language,
                input_evidence_digest,original_sha256)
             VALUES('account-en','recording','recording:english','en',
                'aa00000000000000000000000000000000000000000000000000000000000001',
                'aa00000000000000000000000000000000000000000000000000000000000002')",
        )
        .execute(db.pool())
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO session_documents(id,session_id,kind,body,body_format)
             VALUES('summary-1','recording','summary',?,'json')",
        )
        .bind(summary_body().to_string())
        .execute(db.pool())
        .await
        .unwrap();
        (db, "recording".to_string())
    }

    async fn document_version(db: &anlg_db_core::Db) -> String {
        sqlx::query_scalar("SELECT content_version FROM session_documents WHERE id = 'summary-1'")
            .fetch_one(db.pool())
            .await
            .unwrap()
    }

    async fn transcript_version(db: &anlg_db_core::Db) -> String {
        sqlx::query_scalar("SELECT content_version FROM transcripts WHERE id = 'recording:english'")
            .fetch_one(db.pool())
            .await
            .unwrap()
    }

    async fn insert_proposal(
        db: &anlg_db_core::Db,
        document_version: &str,
        transcript_version: &str,
        blocks: Value,
    ) {
        sqlx::query(
            "INSERT INTO session_proposals(id,session_id,kind,target_id,account_id,
                base_document_version,base_transcript_version,target_blocks_json,
                current_markdown,proposed_markdown,status,source)
             VALUES('proposal-1','recording','summary_replace','summary-1','account-en',
                ?,?,?,'','','pending','dialext')",
        )
        .bind(document_version)
        .bind(transcript_version)
        .bind(blocks.to_string())
        .execute(db.pool())
        .await
        .unwrap();
    }

    async fn body(db: &anlg_db_core::Db) -> Value {
        serde_json::from_str(
            &sqlx::query_scalar::<_, String>(
                "SELECT body FROM session_documents WHERE id = 'summary-1'",
            )
            .fetch_one(db.pool())
            .await
            .unwrap(),
        )
        .unwrap()
    }

    fn text_of(body: &Value, index: usize) -> String {
        let node = &body["content"][index];
        let paragraph = if node["type"] == "dialextBlock" {
            &node["content"][0]
        } else {
            node
        };
        paragraph["content"][0]["text"]
            .as_str()
            .unwrap_or_default()
            .to_string()
    }

    #[tokio::test]
    async fn accepting_a_targeted_proposal_preserves_unrelated_manual_edits() {
        let (db, _) = seeded().await;

        // The reader edits a block this proposal never names, and adds one of their own.
        let mut edited = summary_body();
        edited["content"][2]["content"][0]["content"][0]["text"] =
            json!("He thanked the clerk warmly.");
        edited["content"].as_array_mut().unwrap().push(json!({
            "type": "paragraph",
            "content": [{ "type": "text", "text": "My own note." }],
        }));
        sqlx::query("UPDATE session_documents SET body = ? WHERE id = 'summary-1'")
            .bind(edited.to_string())
            .execute(db.pool())
            .await
            .unwrap();

        insert_proposal(
            &db,
            &document_version(&db).await,
            &transcript_version(&db).await,
            json!([{ "block_id": "b2", "text": "He ordered tea." }]),
        )
        .await;

        let outcome = apply_proposal(db.pool(), "proposal-1").await.unwrap();
        assert!(matches!(
            outcome,
            ProposalOutcome::Applied {
                blocks_changed: 1,
                ..
            }
        ));

        let after = body(&db).await;
        assert_eq!(
            text_of(&after, 1),
            "He ordered tea.",
            "the named block changed"
        );
        assert_eq!(
            text_of(&after, 0),
            "Gary asked for two tickets.",
            "an untargeted block is untouched"
        );
        assert_eq!(
            text_of(&after, 2),
            "He thanked the clerk warmly.",
            "the reader's manual edit to an untargeted block survives acceptance"
        );
        assert_eq!(
            text_of(&after, 3),
            "My own note.",
            "a block the reader added themselves survives acceptance"
        );
        assert_eq!(
            after["content"][1]["attrs"]["id"],
            json!("b2"),
            "the replaced block keeps its identity"
        );
    }

    #[tokio::test]
    async fn a_document_that_moved_refuses_and_writes_nothing() {
        let (db, _) = seeded().await;
        let stale_document = document_version(&db).await;
        insert_proposal(
            &db,
            &stale_document,
            &transcript_version(&db).await,
            json!([{ "block_id": "b2", "text": "He ordered tea." }]),
        )
        .await;

        let mut moved = summary_body();
        moved["content"][1]["content"][0]["content"][0]["text"] =
            json!("Someone else rewrote this.");
        sqlx::query("UPDATE session_documents SET body = ? WHERE id = 'summary-1'")
            .bind(moved.to_string())
            .execute(db.pool())
            .await
            .unwrap();

        let outcome = apply_proposal(db.pool(), "proposal-1").await.unwrap();
        assert!(
            matches!(outcome, ProposalOutcome::Stale { .. }),
            "a document that moved must refuse, got {outcome:?}"
        );
        assert_eq!(
            text_of(&body(&db).await, 1),
            "Someone else rewrote this.",
            "the refused proposal leaves the document exactly as the other writer left it"
        );
        assert_eq!(
            sqlx::query_scalar::<_, String>(
                "SELECT status FROM session_proposals WHERE id = 'proposal-1'"
            )
            .fetch_one(db.pool())
            .await
            .unwrap(),
            "pending",
            "a refused proposal stays answerable"
        );
    }

    #[tokio::test]
    async fn a_correction_that_moved_after_the_proposal_refuses_too() {
        let (db, _) = seeded().await;
        insert_proposal(
            &db,
            &document_version(&db).await,
            &transcript_version(&db).await,
            json!([{ "block_id": "b2", "text": "He ordered tea." }]),
        )
        .await;

        // Only the account's reading moves; the summary is untouched.
        sqlx::query(
            "UPDATE transcripts SET words_json = '[{\"id\":\"w1\",\"text\":\"coffee\"}]'
             WHERE id = 'recording:english'",
        )
        .execute(db.pool())
        .await
        .unwrap();

        let outcome = apply_proposal(db.pool(), "proposal-1").await.unwrap();
        assert!(
            matches!(outcome, ProposalOutcome::Stale { .. }),
            "the transcript pin must be compared too, got {outcome:?}"
        );
        assert_eq!(text_of(&body(&db).await, 1), "He ordered coffee.");
    }

    #[tokio::test]
    async fn the_summary_and_the_proposal_status_move_together() {
        let (db, _) = seeded().await;
        insert_proposal(
            &db,
            &document_version(&db).await,
            &transcript_version(&db).await,
            json!([{ "block_id": "b2", "text": "He ordered tea." }]),
        )
        .await;
        apply_proposal(db.pool(), "proposal-1").await.unwrap();

        assert_eq!(
            sqlx::query_scalar::<_, String>(
                "SELECT status FROM session_proposals WHERE id = 'proposal-1'"
            )
            .fetch_one(db.pool())
            .await
            .unwrap(),
            "applied"
        );
        assert_eq!(
            apply_proposal(db.pool(), "proposal-1").await.unwrap(),
            ProposalOutcome::Settled {
                status: "applied".to_string()
            },
            "answering an applied proposal again is not an error"
        );
    }

    #[tokio::test]
    async fn a_named_block_that_is_gone_refuses_the_whole_proposal() {
        let (db, _) = seeded().await;
        insert_proposal(
            &db,
            &document_version(&db).await,
            &transcript_version(&db).await,
            json!([
                { "block_id": "b2", "text": "He ordered tea." },
                { "block_id": "b9", "text": "A block that is not there." },
            ]),
        )
        .await;

        let error = apply_proposal(db.pool(), "proposal-1").await.unwrap_err();
        assert!(error.to_string().contains("no longer has the blocks"));
        assert_eq!(
            text_of(&body(&db).await, 1),
            "He ordered coffee.",
            "a partial edit the reader never reviewed must not be written"
        );
    }
}
