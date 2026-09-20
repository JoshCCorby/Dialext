//! Bounded prototype metadata adoption. The transcript row always wins over originals.
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::SqlitePool;
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    io::Write,
    path::{Component, Path},
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Database(#[from] sqlx::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    Invalid(String),
}
pub(crate) fn invalid(message: &str) -> Error {
    Error::Invalid(message.into())
}
pub fn sha256(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

// v1: compact serde_json Value (sorted object keys), UTF-8, no BOM/newline.
pub(crate) fn artifact(mut v: Value) -> Result<Vec<u8>, Error> {
    crate::apply::sort_json_keys(&mut v);
    Ok(serde_json::to_vec(&v)?)
}
pub(crate) fn write_artifact(vault: &Path, bytes: &[u8]) -> Result<(String, String), Error> {
    write_artifact_as(vault, bytes, "json", crate::MAX_SESSION_INGEST_BYTES)
}

pub(crate) fn write_artifact_as(
    vault: &Path,
    bytes: &[u8],
    extension: &str,
    limit: usize,
) -> Result<(String, String), Error> {
    if bytes.len() > limit {
        return Err(invalid("Dialext artefact exceeds the bounded import limit"));
    }
    if !extension.chars().all(|c| c.is_ascii_lowercase()) {
        return Err(invalid("Invalid Dialext artefact extension"));
    }
    let digest = sha256(bytes);
    let relative = format!("dialext/artifacts/v1/{digest}.{extension}");
    let path = vault.join(&relative);
    let directory = path.parent().unwrap();
    fs::create_dir_all(directory)?;
    if !directory.canonicalize()?.starts_with(vault.canonicalize()?) {
        return Err(invalid("Invalid Dialext artefact directory"));
    }
    if path.exists() {
        read_artifact_bounded(vault, &relative, &digest, limit)?;
        return Ok((relative, digest));
    }
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| invalid("clock unavailable"))?
        .as_nanos();
    let temporary = directory.join(format!(".{}-{nonce}.tmp", std::process::id()));
    let mut file = fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temporary)?;
    file.write_all(bytes)?;
    file.sync_all()?;
    // hard_link publishes complete bytes atomically and cannot clobber an existing digest path.
    match fs::hard_link(&temporary, &path) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
            read_artifact_bounded(vault, &relative, &digest, limit)?;
        }
        Err(e) => return Err(e.into()),
    }
    fs::remove_file(&temporary)?;
    fs::File::open(directory)?.sync_all()?;
    Ok((relative, digest))
}
pub fn read_artifact(vault: &Path, relative: &str, digest: &str) -> Result<Vec<u8>, Error> {
    read_artifact_bounded(vault, relative, digest, crate::MAX_SESSION_INGEST_BYTES)
}

pub fn read_artifact_bounded(
    vault: &Path,
    relative: &str,
    digest: &str,
    limit: usize,
) -> Result<Vec<u8>, Error> {
    if !relative.starts_with("dialext/artifacts/v1/")
        || Path::new(relative)
            .components()
            .any(|c| !matches!(c, Component::Normal(_)))
    {
        return Err(invalid("Invalid app-owned Dialext artefact path"));
    }
    let path = vault.join(relative);
    let base = vault.canonicalize()?;
    if !path.canonicalize()?.starts_with(&base) || fs::metadata(&path)?.len() > limit as u64 {
        return Err(invalid("Invalid Dialext artefact location or size"));
    }
    let bytes = fs::read(path)?;
    if sha256(&bytes) != digest {
        return Err(invalid("Dialext evidence is missing or corrupt"));
    }
    Ok(bytes)
}
pub(crate) fn array<'a>(value: &'a Value, key: &str) -> Result<&'a Vec<Value>, Error> {
    value
        .get(key)
        .and_then(Value::as_array)
        .ok_or_else(|| invalid("Invalid prepared Dialext bundle"))
}
pub(crate) fn text<'a>(value: &'a Value, key: &str) -> Result<&'a str, Error> {
    value
        .get(key)
        .and_then(Value::as_str)
        .ok_or_else(|| invalid("Invalid prepared Dialext bundle"))
}
fn interval(value: &Value, duration: i64) -> Result<(i64, i64), Error> {
    let start = value["start_ms"]
        .as_i64()
        .ok_or_else(|| invalid("Missing passage interval"))?;
    let end = value["end_ms"]
        .as_i64()
        .ok_or_else(|| invalid("Missing passage interval"))?;
    if start < 0 || end <= start || end > duration {
        return Err(invalid("Invalid passage interval"));
    }
    Ok((start, end))
}
fn validate_bundle(bundle: &Value) -> Result<(), Error> {
    if bundle["format"] != "dialext-recording" || bundle["version"] != 1 {
        return Err(invalid("Unsupported Dialext bundle"));
    }
    let duration = bundle["recording"]["duration_ms"]
        .as_i64()
        .filter(|v| *v > 0)
        .ok_or_else(|| invalid("Missing recording duration"))?;
    let sources = array(&bundle["evidence"], "sources")?;
    let mut ids = BTreeSet::new();
    let mut anchors = BTreeMap::new();
    for source in sources {
        let id = text(source, "source_id")?;
        if !["irish-asr", "english-asr"].contains(&id) || !ids.insert(id) {
            return Err(invalid("Invalid independent source identity"));
        }
        let segments = array(source, "segments")?;
        if segments.is_empty() || segments.len() > 2000 {
            return Err(invalid("Invalid source segment count"));
        }
        for segment in segments {
            let (start, end) = interval(segment, duration)?;
            let content = text(segment, "text")?;
            if content.trim().is_empty()
                || content.encode_utf16().count() > 4000
                || anchors
                    .insert((id, start, end), segment["speaker"].as_str())
                    .is_some()
            {
                return Err(invalid("Ambiguous source interval"));
            }
        }
    }
    if ids.len() != 2 {
        return Err(invalid("Both independent sources are required"));
    }
    for language in ["english", "irish"] {
        let Some(account) = bundle["accounts"].get(language) else {
            continue;
        };
        let segments = array(account, "segments")?;
        if segments.is_empty() || segments.len() > 2000 {
            return Err(invalid("Empty readable account"));
        }
        let mut previous = -1;
        for segment in segments {
            let (start, end) = interval(segment, duration)?;
            let content = text(segment, "text")?;
            if start < previous
                || content.trim().is_empty()
                || content.encode_utf16().count() > 4000
            {
                return Err(invalid("Invalid account passage"));
            }
            previous = end;
            let support = array(segment, "anchors")?;
            if support.is_empty() || support.len() > 8 {
                return Err(invalid("Invalid anchor count"));
            }
            let mut min = i64::MAX;
            let mut max = -1;
            for anchor in support {
                let id = text(anchor, "source_id")?;
                let (a, b) = interval(anchor, duration)?;
                let Some(source_speaker) = anchors.get(&(id, a, b)) else {
                    return Err(invalid("Account anchor does not exactly resolve"));
                };
                if let (Some(speaker), Some(source_speaker)) =
                    (segment["speaker"].as_str(), source_speaker)
                    && speaker != *source_speaker
                {
                    return Err(invalid("Account speaker disagrees with its evidence"));
                }
                min = min.min(a);
                max = max.max(b);
            }
            if min != start || max != end {
                return Err(invalid("Account interval disagrees with its anchors"));
            }
        }
    }
    Ok(())
}
fn working_words(
    session: &str,
    language: &str,
    account: &Value,
) -> Result<(String, String), Error> {
    // Speaker grouping hints are not written here. Numbering a label by the order its
    // string first appears merges two sources that happen to share one — `irish-asr/A`
    // and `english-asr/A` are two people. `dialext_speakers::write_speaker_indexes`
    // derives them from the recording's own speakers later in this same transaction.
    let mut words = Vec::new();
    for (index, segment) in array(account, "segments")?.iter().enumerate() {
        let id = format!("{session}:{language}:passage:{index}");
        words.push(json!({"id":id,"text":segment["text"],"start_ms":segment["start_ms"],"end_ms":segment["end_ms"],"channel":0,
            "metadata":{"timing":{"source":"synthetic_text"},"dialext":{"anchors":segment["anchors"],"source_speaker":segment["speaker"],"target_language":language,
            "spoken_language":segment.get("spoken_language").cloned().unwrap_or(json!("unknown")),"timing":"passage"}}}));
    }
    Ok((serde_json::to_string(&words)?, "[]".to_string()))
}

pub async fn migrate_recording(
    pool: &SqlitePool,
    vault: &Path,
    session_id: &str,
) -> Result<bool, Error> {
    // Serialize adoption against edits, imports and other adopters. Files publish before references.
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
    if sqlx::query_scalar::<_, i64>("SELECT count(*) FROM dialext_recordings WHERE id = ?")
        .bind(session_id)
        .fetch_one(&mut *tx)
        .await?
        != 0
    {
        return Ok(false);
    }
    let Some((metadata, workspace, owner)) = sqlx::query_as::<_,(String,String,String)>("SELECT metadata_json,workspace_id,owner_user_id FROM sessions WHERE id = ? AND deleted_at IS NULL").bind(session_id).fetch_optional(&mut *tx).await? else { return Ok(false) };
    if metadata.len() > crate::MAX_SESSION_INGEST_BYTES {
        return Err(invalid("Prepared metadata exceeds the import limit"));
    }
    let metadata: Value = serde_json::from_str(&metadata)?;
    let Some(dialext) = metadata.get("dialext") else {
        return Ok(false);
    };
    let bundle = &dialext["original"];
    validate_bundle(bundle)?;
    let selected = text(dialext, "selected_language")?;
    if !["english", "irish"].contains(&selected) || bundle["accounts"].get(selected).is_none() {
        return Err(invalid("Missing selected account original"));
    }
    if format!("dialext-{}", text(&bundle["recording"], "id")?) != session_id {
        return Err(invalid("Recording identity mismatch"));
    }
    let selected_transcript = format!("{session_id}:reading");
    if sqlx::query_scalar::<_, i64>(
        "SELECT count(*) FROM transcripts WHERE id = ? AND session_id = ? AND deleted_at IS NULL",
    )
    .bind(&selected_transcript)
    .bind(session_id)
    .fetch_one(&mut *tx)
    .await?
        != 1
    {
        return Err(invalid("Selected transcript is unavailable"));
    }
    let duration = bundle["recording"]["duration_ms"].as_i64().unwrap();
    let mut sources = array(&bundle["evidence"], "sources")?.clone();
    sources.sort_by(|a, b| a["source_id"].as_str().cmp(&b["source_id"].as_str()));
    let mut evidence = Vec::new();
    for source in sources {
        let id = text(&source, "source_id")?;
        let (path, hash) = write_artifact(
            vault,
            &artifact(json!({"format":"dialext-asr-evidence","version":1,"source":source}))?,
        )?;
        sqlx::query("INSERT INTO dialext_evidence(id,session_id,kind,source_id,revision,sha256,artifact_path,duration_ms) VALUES(?,?,'asr',?,1,?,?,?)")
            .bind(format!("{session_id}:{id}:1")).bind(session_id).bind(id).bind(&hash).bind(path).bind(duration).execute(&mut *tx).await?;
        evidence.push(json!({"source_id":id,"revision":1,"sha256":hash}));
    }
    let evidence_digest = sha256(&artifact(
        json!({"format":"dialext-evidence-set","version":1,"sources":evidence}),
    )?);
    let mut active = String::new();
    for (language, code) in [("english", "en"), ("irish", "ga")] {
        let Some(account) = bundle["accounts"].get(language) else {
            continue;
        };
        let id = format!("{session_id}:account:{code}:1");
        let transcript = if selected == language {
            active = id.clone();
            selected_transcript.clone()
        } else {
            format!("{session_id}:reading:{code}:1")
        };
        let (path, hash) = write_artifact(
            vault,
            &artifact(
                json!({"format":"dialext-account-original","version":1,"target_language":code,"evidence":evidence,"account":account}),
            )?,
        )?;
        if selected != language {
            let (words, hints) = working_words(session_id, code, account)?;
            sqlx::query("INSERT INTO transcripts(id,workspace_id,owner_user_id,session_id,source,provider,language,started_at_ms,ended_at_ms,words_json,speaker_hints_json,metadata_json,created_at,updated_at) VALUES(?,?,?,?,'dialext','dialext',?,0,?,?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'))")
                .bind(&transcript).bind(&workspace).bind(&owner).bind(session_id).bind(code).bind(duration).bind(words).bind(hints).bind(json!({"dialext":{"kind":"readable_account","target_language":code}}).to_string()).execute(&mut *tx).await?;
        }
        sqlx::query("INSERT INTO dialext_accounts(id,session_id,transcript_id,target_language,generation,input_evidence_digest,original_artifact_path,original_sha256) VALUES(?,?,?,?,1,?,?,?)")
            .bind(id).bind(session_id).bind(transcript).bind(code).bind(&evidence_digest).bind(path).bind(hash).execute(&mut *tx).await?;
    }
    sqlx::query(
        "INSERT INTO dialext_recordings(id,active_account_id,preferred_language) VALUES(?,?,?)",
    )
    .bind(session_id)
    .bind(active)
    .bind(if selected == "english" { "en" } else { "ga" })
    .execute(&mut *tx)
    .await?;
    crate::dialext_speakers::insert(
        &mut tx,
        session_id,
        &crate::dialext_speakers::derive(bundle)?,
    )
    .await?;
    crate::dialext_speakers::write_speaker_indexes(&mut tx, session_id).await?;
    sqlx::query("UPDATE sessions SET metadata_json = json_set(metadata_json,'$.dialext.registry_version',1) WHERE id = ?").bind(session_id).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(true)
}

pub async fn migrate_recordings(pool: &SqlitePool, vault: &Path) -> Result<(), Error> {
    let ids: Vec<String> = sqlx::query_scalar("SELECT id FROM sessions WHERE deleted_at IS NULL AND json_valid(metadata_json) AND json_type(metadata_json,'$.dialext.original') = 'object'").fetch_all(pool).await?;
    for id in ids {
        migrate_recording(pool, vault, &id).await?;
    }
    crate::dialext_speakers::migrate_all_speakers(pool).await?;
    crate::dialext_speakers::migrate_all_speaker_indexes(pool).await
}

#[cfg(test)]
mod tests {
    use super::*;
    async fn db() -> anlg_db_core::Db {
        let db = anlg_db_core::Db::connect_memory_plain().await.unwrap();
        anlg_db_app::prepare_schema(&db).await.unwrap();
        db
    }
    async fn sample(pool: &SqlitePool) -> String {
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
            .execute(pool)
            .await
            .unwrap();
        sqlx::query(
            "INSERT INTO transcripts(id,session_id,words_json,speaker_hints_json) VALUES(?,?,?,?)",
        )
        .bind(format!("{id}:reading"))
        .bind(&id)
        .bind("[{\"id\":\"saved\",\"text\":\"Saved tea correction\"}]")
        .bind("[{\"id\":\"saved-name\"}]")
        .execute(pool)
        .await
        .unwrap();
        id
    }
    #[tokio::test]
    async fn adoption_preserves_edits_hints_versions_and_is_idempotent() {
        let db = db().await;
        let vault = tempfile::tempdir().unwrap();
        let id = sample(db.pool()).await;
        let before: (String, String, String) = sqlx::query_as(
            "SELECT words_json,speaker_hints_json,content_version FROM transcripts WHERE id = ?",
        )
        .bind(format!("{id}:reading"))
        .fetch_one(db.pool())
        .await
        .unwrap();
        assert!(
            migrate_recording(db.pool(), vault.path(), &id)
                .await
                .unwrap()
        );
        assert!(
            !migrate_recording(db.pool(), vault.path(), &id)
                .await
                .unwrap()
        );
        let after: (String, String, String) = sqlx::query_as(
            "SELECT words_json,speaker_hints_json,content_version FROM transcripts WHERE id = ?",
        )
        .bind(format!("{id}:reading"))
        .fetch_one(db.pool())
        .await
        .unwrap();
        assert_eq!(before, after);
        let originals: Vec<(String,String)> = sqlx::query_as("SELECT artifact_path,sha256 FROM dialext_evidence UNION ALL SELECT original_artifact_path,original_sha256 FROM dialext_accounts").fetch_all(db.pool()).await.unwrap();
        assert_eq!(originals.len(), 4);
        for (path, hash) in originals {
            read_artifact(vault.path(), &path, &hash).unwrap();
        }
        let (words, hints): (String, String) = sqlx::query_as(
            "SELECT words_json,speaker_hints_json FROM transcripts WHERE language = 'ga'",
        )
        .fetch_one(db.pool())
        .await
        .unwrap();
        assert!(words.contains("Ba mhaith liom"));
        assert_eq!(
            serde_json::from_str::<Value>(&hints)
                .unwrap()
                .as_array()
                .unwrap()
                .len(),
            2
        );
        let retained: i64 = sqlx::query_scalar("SELECT json_type(metadata_json,'$.dialext.original') = 'object' AND json_extract(metadata_json,'$.dialext.registry_version') = 1 FROM sessions WHERE id = ?").bind(id).fetch_one(db.pool()).await.unwrap();
        assert_eq!(retained, 1);
    }
    #[tokio::test]
    async fn interrupted_commit_retries_using_published_files_without_overwriting_edits() {
        let db = db().await;
        let vault = tempfile::tempdir().unwrap();
        let id = sample(db.pool()).await;
        sqlx::raw_sql("CREATE TRIGGER simulate_crash BEFORE INSERT ON dialext_recordings BEGIN SELECT RAISE(ABORT,'interrupted'); END;").execute(db.pool()).await.unwrap();
        assert!(
            migrate_recording(db.pool(), vault.path(), &id)
                .await
                .is_err()
        );
        assert!(
            fs::read_dir(vault.path().join("dialext/artifacts/v1"))
                .unwrap()
                .count()
                > 0
        );
        let rows: i64 = sqlx::query_scalar("SELECT count(*) FROM dialext_accounts")
            .fetch_one(db.pool())
            .await
            .unwrap();
        assert_eq!(rows, 0);
        sqlx::raw_sql("DROP TRIGGER simulate_crash")
            .execute(db.pool())
            .await
            .unwrap();
        assert!(
            migrate_recording(db.pool(), vault.path(), &id)
                .await
                .unwrap()
        );
    }
    #[tokio::test]
    async fn missing_corrupt_and_foreign_evidence_refuse_without_removing_work() {
        let db = db().await;
        let vault = tempfile::tempdir().unwrap();
        let id = sample(db.pool()).await;
        migrate_recording(db.pool(), vault.path(), &id)
            .await
            .unwrap();
        let (path, hash): (String, String) =
            sqlx::query_as("SELECT artifact_path,sha256 FROM dialext_evidence LIMIT 1")
                .fetch_one(db.pool())
                .await
                .unwrap();
        fs::write(vault.path().join(&path), b"corrupt").unwrap();
        assert!(read_artifact(vault.path(), &path, &hash).is_err());
        assert!(write_artifact(vault.path(), &artifact(json!({"version":1})).unwrap()).is_ok());
        fs::remove_file(vault.path().join(&path)).unwrap();
        assert!(read_artifact(vault.path(), &path, &hash).is_err());
        assert!(read_artifact(vault.path(), "../../private", &hash).is_err());
        let words: String = sqlx::query_scalar("SELECT words_json FROM transcripts WHERE id = ?")
            .bind(format!("{id}:reading"))
            .fetch_one(db.pool())
            .await
            .unwrap();
        assert!(words.contains("Saved tea correction"));
    }
    #[tokio::test]
    async fn near_match_anchor_and_foreign_account_ownership_are_refused() {
        let db = db().await;
        let vault = tempfile::tempdir().unwrap();
        let id = sample(db.pool()).await;
        sqlx::query("UPDATE sessions SET metadata_json = json_set(metadata_json,'$.dialext.original.accounts.irish.segments[0].anchors[0].end_ms',3999) WHERE id = ?").bind(&id).execute(db.pool()).await.unwrap();
        assert!(
            migrate_recording(db.pool(), vault.path(), &id)
                .await
                .is_err()
        );
        let foreign = sqlx::query("INSERT INTO dialext_accounts(id,session_id,transcript_id,input_evidence_digest,original_sha256) VALUES('foreign','other',?, ?, ?)").bind(format!("{id}:reading")).bind("0".repeat(64)).bind("0".repeat(64)).execute(db.pool()).await;
        assert!(foreign.is_err());
    }
    #[test]
    fn native_bundle_validation_keeps_speaker_and_size_gates() {
        let original: Value = serde_json::from_str(include_str!(
            "../../../dialext/fixtures/language-practice.json"
        ))
        .unwrap();
        for field in ["speaker", "text", "anchors"] {
            let mut bundle = original.clone();
            bundle["accounts"]["english"]["segments"][0][field] = match field {
                "speaker" => json!("Invented Speaker"),
                "text" => json!("a".repeat(4001)),
                _ => json!(vec![
                    bundle["accounts"]["english"]["segments"][0]["anchors"]
                        [0]
                    .clone();
                    9
                ]),
            };
            assert!(validate_bundle(&bundle).is_err());
        }
    }
    #[tokio::test]
    async fn selected_projection_changes_atomically_and_preserves_all_account_work() {
        let db = db().await;
        let vault = tempfile::tempdir().unwrap();
        let id = sample(db.pool()).await;
        migrate_recording(db.pool(), vault.path(), &id)
            .await
            .unwrap();
        let en = format!("{id}:account:en:1");
        let ga = format!("{id}:account:ga:1");
        assert_eq!(
            anlg_db_app::list_session_transcripts(db.pool(), &id)
                .await
                .unwrap()
                .len(),
            1
        );
        let before: i64 = sqlx::query_scalar("SELECT generation FROM search_index_dirty WHERE entity_id = ? AND entity_type = 'session'").bind(&id).fetch_one(db.pool()).await.unwrap();
        anlg_db_app::select_dialext_account(db.pool(), &id, &ga, Some(&en))
            .await
            .unwrap();
        let chosen = anlg_db_app::list_session_transcripts(db.pool(), &id)
            .await
            .unwrap();
        assert_eq!(chosen.len(), 1);
        assert_eq!(chosen[0].language, "ga");
        assert!(matches!(
            anlg_db_app::select_dialext_account(db.pool(), &id, &en, Some(&en)).await,
            Err(anlg_db_app::DialextSelectionError::StaleSelection)
        ));
        assert!(
            anlg_db_app::select_dialext_account(db.pool(), "foreign", &ga, Some(&en))
                .await
                .is_err()
        );
        let after: i64 = sqlx::query_scalar("SELECT generation FROM search_index_dirty WHERE entity_id = ? AND entity_type = 'session'").bind(&id).fetch_one(db.pool()).await.unwrap();
        assert!(after > before);
        sqlx::query(
            "UPDATE transcripts SET words_json = '[{\"text\":\"Saved Irish edit\"}]' WHERE id = ?",
        )
        .bind(&chosen[0].id)
        .execute(db.pool())
        .await
        .unwrap();
        anlg_db_app::select_dialext_account(db.pool(), &id, &en, Some(&ga))
            .await
            .unwrap();
        let english = anlg_db_app::list_session_transcripts(db.pool(), &id)
            .await
            .unwrap();
        assert!(english[0].words_json.contains("Saved tea correction"));
        anlg_db_app::select_dialext_account(db.pool(), &id, &ga, Some(&en))
            .await
            .unwrap();
        assert!(
            anlg_db_app::list_session_transcripts(db.pool(), &id)
                .await
                .unwrap()[0]
                .words_json
                .contains("Saved Irish edit")
        );
        assert!(
            sqlx::query("UPDATE transcripts SET session_id = 'foreign' WHERE id = ?")
                .bind(&chosen[0].id)
                .execute(db.pool())
                .await
                .is_err()
        );
        sqlx::query("UPDATE sessions SET deleted_at = 'deleted' WHERE id = ?")
            .bind(&id)
            .execute(db.pool())
            .await
            .unwrap();
        assert!(
            anlg_db_app::list_session_transcripts(db.pool(), &id)
                .await
                .unwrap()
                .is_empty()
        );
        assert!(
            anlg_db_app::select_dialext_account(db.pool(), &id, &en, Some(&ga))
                .await
                .is_err()
        );
        sqlx::query("UPDATE sessions SET deleted_at = NULL WHERE id = ?")
            .bind(&id)
            .execute(db.pool())
            .await
            .unwrap();
        assert!(
            anlg_db_app::list_session_transcripts(db.pool(), &id)
                .await
                .unwrap()[0]
                .words_json
                .contains("Saved Irish edit")
        );
        sqlx::query("UPDATE transcripts SET deleted_at = 'deleted' WHERE id = ?")
            .bind(&chosen[0].id)
            .execute(db.pool())
            .await
            .unwrap();
        assert!(
            anlg_db_app::list_session_transcripts(db.pool(), &id)
                .await
                .unwrap()
                .is_empty()
        );
        assert!(
            anlg_db_app::select_dialext_account(db.pool(), &id, &ga, Some(&ga))
                .await
                .is_err()
        );
    }
    #[tokio::test]
    async fn ordinary_recordings_keep_all_transcripts_and_unadopted_dialext_is_unavailable() {
        let db = db().await;
        let id = sample(db.pool()).await;
        assert!(
            anlg_db_app::list_session_transcripts(db.pool(), &id)
                .await
                .unwrap()
                .is_empty()
        );
        sqlx::query("INSERT INTO sessions(id) VALUES('ordinary')")
            .execute(db.pool())
            .await
            .unwrap();
        for transcript in ["one", "two"] {
            sqlx::query(
                "INSERT INTO transcripts(id,session_id,words_json) VALUES(?,'ordinary','[]')",
            )
            .bind(transcript)
            .execute(db.pool())
            .await
            .unwrap();
        }
        assert_eq!(
            anlg_db_app::list_session_transcripts(db.pool(), "ordinary")
                .await
                .unwrap()
                .len(),
            2
        );
    }
}
