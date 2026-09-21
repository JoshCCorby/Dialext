//! Deterministic Dialext outputs with stored per-block evidence.
//!
//! An output is written, and the evidence behind each of its blocks is pinned, in one
//! `BEGIN IMMEDIATE` transaction against the active account as it stands at that
//! moment. Provenance is therefore a stored fact about a stable block, never something
//! reconstructed later from where a bullet happens to sit or what it happens to say.
use serde_json::{Value, json};
use sqlx::SqlitePool;

use crate::dialext::{Error, invalid};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OutputOutcome {
    Written {
        document_version: String,
        blocks: usize,
    },
    /// The output already has text. Generating never replaces what the reader has.
    AlreadyHasText,
    /// The selected reading has no anchored passage to take a block from.
    NoPassages,
}

struct Passage {
    word_id: String,
    text: String,
    anchors: Value,
    spoken_language: String,
    target_language: String,
}

fn anchored_passages(words: &Value) -> Vec<Passage> {
    words
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|word| {
            let word_id = word["id"].as_str().filter(|id| !id.is_empty())?;
            let text = word["text"].as_str()?.trim();
            let dialext = &word["metadata"]["dialext"];
            let anchors = dialext["anchors"].as_array().filter(|a| !a.is_empty())?;
            if text.is_empty() {
                return None;
            }
            Some(Passage {
                word_id: word_id.to_string(),
                text: text.to_string(),
                anchors: Value::Array(anchors.clone()),
                spoken_language: dialext["spoken_language"]
                    .as_str()
                    .unwrap_or("unknown")
                    .to_string(),
                target_language: dialext["target_language"]
                    .as_str()
                    .unwrap_or_default()
                    .to_string(),
            })
        })
        .collect()
}

fn output_document(title: &str, passages: &[Passage]) -> Value {
    let mut content = vec![json!({
        "type": "heading",
        "attrs": { "level": 2 },
        "content": [{ "type": "text", "text": title }],
    })];
    content.extend(passages.iter().map(|passage| {
        json!({
            "type": "dialextBlock",
            "attrs": { "id": passage.word_id },
            "content": [{
                "type": "paragraph",
                "content": [{ "type": "text", "text": passage.text }],
            }],
        })
    }));
    json!({ "type": "doc", "content": content })
}

/// Write a deterministic output into `document_id` and pin each block's evidence.
///
/// One block per anchored passage of the **selected** reading, keyed by that passage's
/// word id. Only an output that is still empty is written; the evidence rows commit in
/// the same transaction, so an output can never exist with blocks whose evidence was
/// taken from a different version of the reading.
pub async fn generate_output(
    pool: &SqlitePool,
    session_id: &str,
    document_id: &str,
    title: &str,
) -> Result<OutputOutcome, Error> {
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;

    let Some(body) = sqlx::query_scalar::<_, String>(
        "SELECT body FROM session_documents
         WHERE id = ? AND session_id = ? AND deleted_at IS NULL
           AND kind IN ('summary', 'template_output')",
    )
    .bind(document_id)
    .bind(session_id)
    .fetch_optional(&mut *tx)
    .await?
    else {
        return Err(invalid("That output is no longer available."));
    };
    if !body.is_empty() {
        return Ok(OutputOutcome::AlreadyHasText);
    }

    let Some((account_id, words_json, account_version)) =
        sqlx::query_as::<_, (String, String, String)>(
            "SELECT a.id, t.words_json, t.content_version FROM dialext_recordings r
             JOIN sessions s ON s.id = r.id AND s.deleted_at IS NULL
             JOIN dialext_accounts a ON a.id = r.active_account_id AND a.session_id = r.id
             JOIN transcripts t ON t.id = a.transcript_id AND t.session_id = a.session_id
               AND t.deleted_at IS NULL
             WHERE r.id = ?",
        )
        .bind(session_id)
        .fetch_optional(&mut *tx)
        .await?
    else {
        return Err(invalid("This recording has no available reading."));
    };

    let passages = anchored_passages(&serde_json::from_str(&words_json)?);
    if passages.is_empty() {
        return Ok(OutputOutcome::NoPassages);
    }

    let title = match title.trim() {
        "" => "Summary",
        title => title,
    };
    let written = sqlx::query(
        "UPDATE session_documents SET body = ?, body_format = 'prosemirror_json',
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ? AND session_id = ? AND body = '' AND deleted_at IS NULL",
    )
    .bind(output_document(title, &passages).to_string())
    .bind(document_id)
    .bind(session_id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if written != 1 {
        return Ok(OutputOutcome::AlreadyHasText);
    }

    // A document id is reused only if this output was emptied and generated again; the
    // evidence then describes the new blocks, never a mix of old and new.
    sqlx::query("DELETE FROM dialext_block_evidence WHERE document_id = ?")
        .bind(document_id)
        .execute(&mut *tx)
        .await?;
    for passage in &passages {
        sqlx::query(
            "INSERT INTO dialext_block_evidence(id, document_id, block_id, session_id,
               account_id, account_content_version, passage_word_id, block_text,
               anchors_json, spoken_language, target_language)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(document_id)
        .bind(&passage.word_id)
        .bind(session_id)
        .bind(&account_id)
        .bind(&account_version)
        .bind(&passage.word_id)
        .bind(&passage.text)
        .bind(passage.anchors.to_string())
        .bind(&passage.spoken_language)
        .bind(&passage.target_language)
        .execute(&mut *tx)
        .await?;
    }

    let document_version = sqlx::query_scalar::<_, String>(
        "SELECT content_version FROM session_documents WHERE id = ?",
    )
    .bind(document_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(OutputOutcome::Written {
        document_version,
        blocks: passages.len(),
    })
}

/// Re-pin the evidence of blocks an accepted correction proposal just replaced. The
/// proposal was compared against both the summary's and the account's versions in the
/// same transaction, so the new text is exactly the corrected passage at
/// `account_version`; the passage's anchors are unchanged by a correction.
pub(crate) async fn repin_accepted_blocks(
    tx: &mut sqlx::SqliteConnection,
    document_id: &str,
    account_id: &str,
    account_version: &str,
    blocks: &[(String, String)],
) -> Result<(), Error> {
    for (block_id, text) in blocks {
        sqlx::query(
            "UPDATE dialext_block_evidence SET block_text = ?, account_content_version = ?,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
             WHERE document_id = ? AND block_id = ? AND account_id = ?",
        )
        .bind(text)
        .bind(account_version)
        .bind(document_id)
        .bind(block_id)
        .bind(account_id)
        .execute(&mut *tx)
        .await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn seeded() -> anlg_db_core::Db {
        let db = anlg_db_core::Db::connect_memory_plain().await.unwrap();
        anlg_db_app::prepare_schema(&db).await.unwrap();
        sqlx::query("INSERT INTO sessions(id) VALUES('recording')")
            .execute(db.pool())
            .await
            .unwrap();
        let words = json!([
            {"id":"w1","text":"I would like two tickets.","metadata":{"dialext":{
                "anchors":[{"source_id":"irish-asr","start_ms":0,"end_ms":4000}],
                "spoken_language":"ga","target_language":"en"}}},
            {"id":"w2","text":"   ","metadata":{"dialext":{
                "anchors":[{"source_id":"english-asr","start_ms":4000,"end_ms":5000}]}}},
            {"id":"w3","text":"No anchors here."},
            {"id":"w4","text":"Thank you.","metadata":{"dialext":{
                "anchors":[{"source_id":"english-asr","start_ms":5000,"end_ms":7000}],
                "spoken_language":"en","target_language":"en"}}},
        ]);
        for (id, language, words) in [
            ("english", "en", words.clone()),
            ("irish", "ga", json!([{"id":"g1","text":"Dhá thicéad.","metadata":{"dialext":{
                "anchors":[{"source_id":"irish-asr","start_ms":0,"end_ms":4000}]}}}])),
        ] {
            sqlx::query("INSERT INTO transcripts(id,session_id,words_json) VALUES(?,'recording',?)")
                .bind(format!("recording:{id}"))
                .bind(words.to_string())
                .execute(db.pool())
                .await
                .unwrap();
            sqlx::query(
                "INSERT INTO dialext_accounts(id,session_id,transcript_id,target_language,
                    input_evidence_digest,original_sha256) VALUES(?,'recording',?,?,?,?)",
            )
            .bind(format!("account-{language}"))
            .bind(format!("recording:{id}"))
            .bind(language)
            .bind(format!("{:064}", 1))
            .bind(format!("{:064}", if language == "en" { 2 } else { 3 }))
            .execute(db.pool())
            .await
            .unwrap();
        }
        sqlx::query(
            "INSERT INTO dialext_recordings(id,active_account_id,preferred_language)
             VALUES('recording','account-en','en')",
        )
        .execute(db.pool())
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO session_documents(id,session_id,kind,body,body_format)
             VALUES('lecture','recording','template_output','','prosemirror_json')",
        )
        .execute(db.pool())
        .await
        .unwrap();
        db
    }

    async fn evidence(db: &anlg_db_core::Db) -> Vec<(String, String, String, String, String)> {
        sqlx::query_as(
            "SELECT block_id, account_id, account_content_version, block_text, anchors_json
             FROM dialext_block_evidence WHERE document_id = 'lecture' ORDER BY block_id",
        )
        .fetch_all(db.pool())
        .await
        .unwrap()
    }

    async fn account_version(db: &anlg_db_core::Db, id: &str) -> String {
        sqlx::query_scalar("SELECT content_version FROM transcripts WHERE id = ?")
            .bind(id)
            .fetch_one(db.pool())
            .await
            .unwrap()
    }

    #[tokio::test]
    async fn an_output_pins_each_block_to_the_selected_reading_in_one_write() {
        let db = seeded().await;
        let outcome = generate_output(db.pool(), "recording", "lecture", "Lecture")
            .await
            .unwrap();
        assert!(matches!(outcome, OutputOutcome::Written { blocks: 2, .. }));

        let body: Value = serde_json::from_str(
            &sqlx::query_scalar::<_, String>("SELECT body FROM session_documents WHERE id = 'lecture'")
                .fetch_one(db.pool())
                .await
                .unwrap(),
        )
        .unwrap();
        let ids: Vec<&str> = body["content"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|node| node["attrs"]["id"].as_str())
            .collect();
        assert_eq!(ids, vec!["w1", "w4"], "blank and unanchored passages get no block");

        let pinned = account_version(&db, "recording:english").await;
        let rows = evidence(&db).await;
        assert_eq!(rows.len(), 2);
        for (_, account, version, _, _) in &rows {
            assert_eq!(account, "account-en");
            assert_eq!(*version, pinned);
        }
        assert_eq!(rows[0].3, "I would like two tickets.");
        let anchors: Value = serde_json::from_str(&rows[0].4).unwrap();
        assert_eq!(anchors[0]["source_id"], "irish-asr");
        assert_eq!(anchors[0]["end_ms"], 4000);
    }

    #[tokio::test]
    async fn an_output_with_text_is_never_generated_over_and_gains_no_evidence() {
        let db = seeded().await;
        sqlx::query("UPDATE session_documents SET body = 'mine' WHERE id = 'lecture'")
            .execute(db.pool())
            .await
            .unwrap();
        let outcome = generate_output(db.pool(), "recording", "lecture", "Lecture")
            .await
            .unwrap();
        assert_eq!(outcome, OutputOutcome::AlreadyHasText);
        assert!(evidence(&db).await.is_empty());
        let body: String =
            sqlx::query_scalar("SELECT body FROM session_documents WHERE id = 'lecture'")
                .fetch_one(db.pool())
                .await
                .unwrap();
        assert_eq!(body, "mine");
    }

    #[tokio::test]
    async fn the_other_reading_pins_the_other_account() {
        let db = seeded().await;
        sqlx::query("UPDATE dialext_recordings SET active_account_id = 'account-ga'")
            .execute(db.pool())
            .await
            .unwrap();
        generate_output(db.pool(), "recording", "lecture", "Léacht")
            .await
            .unwrap();
        let rows = evidence(&db).await;
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].0, "g1");
        assert_eq!(rows[0].1, "account-ga");
    }

    #[tokio::test]
    async fn a_recording_without_a_usable_reading_refuses() {
        let db = seeded().await;
        sqlx::query("UPDATE transcripts SET deleted_at = '2026-01-01' WHERE id = 'recording:english'")
            .execute(db.pool())
            .await
            .unwrap();
        let error = generate_output(db.pool(), "recording", "lecture", "Lecture")
            .await
            .unwrap_err();
        assert!(error.to_string().contains("no available reading"));
        assert!(evidence(&db).await.is_empty());
    }
}
