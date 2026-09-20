//! Recording-level speaker identity.
//!
//! Two independent readings diarise separately, so `irish-asr/voice-a` and
//! `english-asr/voice-a` are two provider labels and not one person. A prepared
//! recording may declare that some of them are the same person; where it does not,
//! each provider label stays its own recording-level speaker. Nothing here merges
//! labels because their strings match.
use serde_json::{Value, json};
use sqlx::SqlitePool;
use std::collections::BTreeMap;

use crate::dialext::{Error, array, invalid, text};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct DerivedSpeaker {
    pub key: String,
    pub display_index: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct DerivedAttribution {
    pub source_id: String,
    pub provider_label: String,
    pub speaker_key: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct DerivedSpeakers {
    pub speakers: Vec<DerivedSpeaker>,
    pub attributions: Vec<DerivedAttribution>,
}

fn declared_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

/// Reads the speaker contract out of a prepared bundle. The bundle has already been
/// structurally validated; this adds only the speaker rules.
pub(crate) fn derive(bundle: &Value) -> Result<DerivedSpeakers, Error> {
    // (source_id, provider_label) -> earliest start, in evidence order.
    let mut labels: BTreeMap<(String, String), i64> = BTreeMap::new();
    for source in array(&bundle["evidence"], "sources")? {
        let source_id = text(source, "source_id")?.to_string();
        for segment in array(source, "segments")? {
            let Some(label) = segment["speaker"].as_str() else {
                continue;
            };
            let start = segment["start_ms"].as_i64().unwrap_or(0);
            labels
                .entry((source_id.clone(), label.to_string()))
                .and_modify(|earliest| *earliest = (*earliest).min(start))
                .or_insert(start);
        }
    }

    let mut declared: BTreeMap<String, bool> = BTreeMap::new();
    if let Some(speakers) = bundle.get("speakers") {
        for speaker in speakers
            .as_array()
            .ok_or_else(|| invalid("Invalid declared speakers"))?
        {
            let id = text(speaker, "id")?;
            if !declared_id(id) || declared.insert(id.to_string(), false).is_some() {
                return Err(invalid("Invalid declared speaker identity"));
            }
        }
    }

    let mut attributions: BTreeMap<(String, String), String> = BTreeMap::new();
    if let Some(mappings) = bundle.get("source_speakers") {
        for mapping in mappings
            .as_array()
            .ok_or_else(|| invalid("Invalid declared speaker attribution"))?
        {
            let source_id = text(mapping, "source_id")?.to_string();
            let provider_label = text(mapping, "provider_label")?.to_string();
            let speaker_id = text(mapping, "speaker_id")?.to_string();
            let Some(seen) = declared.get_mut(&speaker_id) else {
                return Err(invalid("A speaker attribution names an undeclared speaker"));
            };
            if !labels.contains_key(&(source_id.clone(), provider_label.clone())) {
                return Err(invalid(
                    "A speaker attribution names a label this reading never used",
                ));
            }
            if attributions
                .insert((source_id, provider_label), speaker_id)
                .is_some()
            {
                return Err(invalid("A provider label is attributed twice"));
            }
            *seen = true;
        }
    }
    if declared.values().any(|referenced| !referenced) {
        return Err(invalid("A declared speaker is never heard in any reading"));
    }

    // Unattributed labels stay their own recording-level speaker. A key holding "/"
    // cannot collide with a declared identity, which may not contain one.
    let mut earliest: BTreeMap<String, i64> = BTreeMap::new();
    let mut resolved: Vec<DerivedAttribution> = Vec::new();
    for ((source_id, provider_label), start) in &labels {
        let key = attributions
            .get(&(source_id.clone(), provider_label.clone()))
            .cloned()
            .unwrap_or_else(|| format!("{source_id}/{provider_label}"));
        earliest
            .entry(key.clone())
            .and_modify(|value| *value = (*value).min(*start))
            .or_insert(*start);
        resolved.push(DerivedAttribution {
            source_id: source_id.clone(),
            provider_label: provider_label.clone(),
            speaker_key: key,
        });
    }

    let mut ordered: Vec<(i64, String)> = earliest
        .into_iter()
        .map(|(key, start)| (start, key))
        .collect();
    ordered.sort();
    Ok(DerivedSpeakers {
        speakers: ordered
            .into_iter()
            .enumerate()
            .map(|(index, (_, key))| DerivedSpeaker {
                key,
                display_index: index as i64,
            })
            .collect(),
        attributions: resolved,
    })
}

pub(crate) async fn insert(
    tx: &mut sqlx::SqliteConnection,
    session_id: &str,
    derived: &DerivedSpeakers,
) -> Result<(), Error> {
    for speaker in &derived.speakers {
        sqlx::query(
            "INSERT INTO dialext_speakers(id,session_id,speaker_key,display_index) VALUES(?,?,?,?)",
        )
        .bind(speaker_row_id(session_id, &speaker.key))
        .bind(session_id)
        .bind(&speaker.key)
        .bind(speaker.display_index)
        .execute(&mut *tx)
        .await?;
    }
    for attribution in &derived.attributions {
        sqlx::query(
            "INSERT INTO dialext_source_speakers(id,session_id,source_id,provider_label,speaker_id) VALUES(?,?,?,?,?)",
        )
        .bind(format!(
            "{session_id}:label:{}:{}",
            attribution.source_id, attribution.provider_label
        ))
        .bind(session_id)
        .bind(&attribution.source_id)
        .bind(&attribution.provider_label)
        .bind(speaker_row_id(session_id, &attribution.speaker_key))
        .execute(&mut *tx)
        .await?;
    }
    Ok(())
}

pub(crate) fn speaker_row_id(session_id: &str, key: &str) -> String {
    format!("{session_id}:speaker:{key}")
}

/// Adopts the speaker contract for a recording whose accounts were registered before
/// this table existed. Adding identity rows changes no transcript, no saved edit and
/// no existing speaker assignment.
pub async fn migrate_speakers(pool: &SqlitePool, session_id: &str) -> Result<bool, Error> {
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
    if sqlx::query_scalar::<_, i64>("SELECT count(*) FROM dialext_speakers WHERE session_id = ?")
        .bind(session_id)
        .fetch_one(&mut *tx)
        .await?
        != 0
    {
        return Ok(false);
    }
    let Some(metadata) = sqlx::query_scalar::<_, String>(
        "SELECT s.metadata_json FROM sessions s JOIN dialext_recordings r ON r.id = s.id WHERE s.id = ? AND s.deleted_at IS NULL",
    )
    .bind(session_id)
    .fetch_optional(&mut *tx)
    .await?
    else {
        return Ok(false);
    };
    let metadata: Value = serde_json::from_str(&metadata)?;
    let bundle = &metadata["dialext"]["original"];
    if !bundle.is_object() {
        return Ok(false);
    }
    let derived = derive(bundle)?;
    if derived.speakers.is_empty() {
        return Ok(false);
    }
    insert(&mut tx, session_id, &derived).await?;
    tx.commit().await?;
    Ok(true)
}

pub async fn migrate_all_speakers(pool: &SqlitePool) -> Result<(), Error> {
    let ids: Vec<String> = sqlx::query_scalar(
        "SELECT r.id FROM dialext_recordings r JOIN sessions s ON s.id = r.id AND s.deleted_at IS NULL
         WHERE NOT EXISTS(SELECT 1 FROM dialext_speakers WHERE session_id = r.id)",
    )
    .fetch_all(pool)
    .await?;
    for id in ids {
        migrate_speakers(pool, &id).await?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Which displayed speaker a passage belongs to
// ---------------------------------------------------------------------------

/// The reader groups passages into speaker blocks on `(channel, speaker_index,
/// speaker_human_id)`, and `speaker_index` reaches it only through a
/// `provider_speaker_index` hint. An account carrying no such hint therefore keys
/// every unnamed passage identically, so two different people — or a person and a
/// passage nobody was attributed to — render and export as one speaker.
///
/// The index is the recording-level speaker's own `display_index`, so it means the
/// same person in both readings, and two sources that happen to share a label string
/// stay two speakers because the identity comes from `dialext_source_speakers` rather
/// than from the label. A passage with no attribution, or whose anchors disagree about
/// who spoke, gets no hint and stays its own unattributed block.
pub(crate) async fn write_speaker_indexes(
    tx: &mut sqlx::SqliteConnection,
    session_id: &str,
) -> Result<(), Error> {
    let indexes: BTreeMap<(String, String), i64> = sqlx::query_as::<_, (String, String, i64)>(
        "SELECT m.source_id, m.provider_label, s.display_index FROM dialext_source_speakers m
             JOIN dialext_speakers s ON s.id = m.speaker_id AND s.session_id = m.session_id
             WHERE m.session_id = ?",
    )
    .bind(session_id)
    .fetch_all(&mut *tx)
    .await?
    .into_iter()
    .map(|(source_id, label, index)| ((source_id, label), index))
    .collect();
    if indexes.is_empty() {
        return Ok(());
    }
    // `word_speaker` resolves to a speaker key; here the same walk resolves to that
    // speaker's display index, so both read one attribution table.
    let attributions: BTreeMap<(String, String), String> = indexes
        .iter()
        .map(|(label, index)| (label.clone(), index.to_string()))
        .collect();

    let rows = sqlx::query_as::<_, (String, String, String)>(
        "SELECT a.transcript_id, t.words_json, t.speaker_hints_json FROM dialext_accounts a
         JOIN transcripts t ON t.id = a.transcript_id AND t.session_id = a.session_id AND t.deleted_at IS NULL
         WHERE a.session_id = ?",
    )
    .bind(session_id)
    .fetch_all(&mut *tx)
    .await?;

    for (transcript_id, words_json, hints_json) in rows {
        let words: Value = serde_json::from_str(&words_json)?;
        let hints: Value = serde_json::from_str(&hints_json).unwrap_or(Value::Array(Vec::new()));
        let next = with_speaker_indexes(&hints, &words, &attributions);
        if next == hints {
            continue;
        }
        sqlx::query("UPDATE transcripts SET speaker_hints_json = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND session_id = ?")
            .bind(next.to_string())
            .bind(&transcript_id)
            .bind(session_id)
            .execute(&mut *tx)
            .await?;
    }
    Ok(())
}

/// Replaces every `provider_speaker_index` hint with one derived from the recording's
/// own speakers. Every other hint — a reader's saved name above all — is kept verbatim
/// and in order.
fn with_speaker_indexes(
    hints: &Value,
    words: &Value,
    attributions: &BTreeMap<(String, String), String>,
) -> Value {
    let resolved: BTreeMap<&str, Value> = words
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|word| {
            let id = word["id"].as_str()?;
            let index = word_speaker(word, attributions)?.parse::<i64>().ok()?;
            Some((
                id,
                json!({
                    "id": format!("{id}:speaker"),
                    "word_id": id,
                    "type": "provider_speaker_index",
                    "value": json!({"channel": word["channel"].as_i64().unwrap_or(0), "speaker_index": index}).to_string(),
                }),
            ))
        })
        .collect();

    // An index hint already in the account keeps its position, so a pass that changes
    // nothing produces the identical array and writes nothing.
    let mut next = Vec::new();
    let mut placed: std::collections::BTreeSet<&str> = std::collections::BTreeSet::new();
    for hint in hints.as_array().into_iter().flatten() {
        if hint["type"] != "provider_speaker_index" {
            next.push(hint.clone());
            continue;
        }
        let Some(word_id) = hint["word_id"].as_str() else {
            continue;
        };
        // A passage nobody is attributed to loses its index and becomes its own block.
        if let Some(replacement) = resolved.get(word_id)
            && placed.insert(word_id)
        {
            next.push(replacement.clone());
        }
    }
    for (word_id, hint) in &resolved {
        if !placed.contains(word_id) {
            next.push(hint.clone());
        }
    }
    Value::Array(next)
}

/// Backfills recordings adopted before the reader's speaker grouping was derived from
/// the recording's own speakers. It rewrites no passage text and drops no saved name.
pub async fn migrate_all_speaker_indexes(pool: &SqlitePool) -> Result<(), Error> {
    let ids: Vec<String> = sqlx::query_scalar(
        "SELECT r.id FROM dialext_recordings r JOIN sessions s ON s.id = r.id AND s.deleted_at IS NULL",
    )
    .fetch_all(pool)
    .await?;
    for id in ids {
        let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
        write_speaker_indexes(&mut tx, &id).await?;
        tx.commit().await?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Naming a recording-level speaker
// ---------------------------------------------------------------------------

/// A recording speaker's passages in one account transcript.
struct AccountPassages {
    transcript_id: String,
    words: Value,
    hints: Value,
    target_word_ids: Vec<String>,
}

fn word_speaker(word: &Value, attributions: &BTreeMap<(String, String), String>) -> Option<String> {
    let dialext = word.get("metadata")?.get("dialext")?;
    let label = dialext.get("source_speaker")?.as_str()?;
    let anchors = dialext.get("anchors")?.as_array()?;
    let mut resolved: Option<String> = None;
    for anchor in anchors {
        let source_id = anchor.get("source_id")?.as_str()?;
        let speaker = attributions.get(&(source_id.to_string(), label.to_string()))?;
        match &resolved {
            // A passage whose anchors disagree about who spoke stays unattributed.
            Some(seen) if seen != speaker => return None,
            _ => resolved = Some(speaker.clone()),
        }
    }
    resolved
}

fn provider_speaker_indexes(hints: &Value) -> BTreeMap<String, Option<i64>> {
    let mut indexes = BTreeMap::new();
    for hint in hints.as_array().into_iter().flatten() {
        if hint["type"] != "provider_speaker_index" {
            continue;
        }
        let (Some(word_id), Some(value)) = (hint["word_id"].as_str(), hint["value"].as_str())
        else {
            continue;
        };
        let parsed: Value = serde_json::from_str(value).unwrap_or(Value::Null);
        indexes.insert(word_id.to_string(), parsed["speaker_index"].as_i64());
    }
    indexes
}

fn hint_value(hint: &Value) -> Value {
    hint["value"]
        .as_str()
        .and_then(|raw| serde_json::from_str(raw).ok())
        .unwrap_or(Value::Null)
}

/// Mirrors the desktop assignment upsert: a word-scoped hint is narrowed and
/// re-anchored, and a hint scoped to a whole provider speaker is dropped where it
/// covers a word the new assignment claims. Every other hint is left alone.
fn rewrite_hints(
    hints: &Value,
    words: &Value,
    targets: &[String],
    assignment: Option<(&str, &str)>,
) -> Value {
    let claimed: std::collections::BTreeSet<&str> = targets.iter().map(String::as_str).collect();
    let indexes = provider_speaker_indexes(hints);
    let channels: BTreeMap<&str, i64> = words
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|word| Some((word["id"].as_str()?, word["channel"].as_i64().unwrap_or(0))))
        .collect();

    let mut next = Vec::new();
    for hint in hints.as_array().into_iter().flatten() {
        let kind = hint["type"].as_str().unwrap_or_default();
        if kind != "user_speaker_assignment" && kind != "automatic_speaker_assignment" {
            next.push(hint.clone());
            continue;
        }
        let value = hint_value(hint);
        if let Some(word_ids) = value["word_ids"].as_array() {
            let remaining: Vec<&str> = word_ids
                .iter()
                .filter_map(Value::as_str)
                .filter(|word_id| !claimed.contains(word_id))
                .collect();
            if remaining.len() == word_ids.len() {
                next.push(hint.clone());
                continue;
            }
            let Some(anchor) = remaining.first() else {
                continue;
            };
            let mut narrowed = value.clone();
            narrowed["word_ids"] = json!(remaining);
            next.push(json!({
                "id": format!("{anchor}:{kind}:segment"),
                "word_id": anchor,
                "type": kind,
                "value": narrowed.to_string(),
            }));
            continue;
        }
        let covers = targets.iter().any(|word_id| {
            let channel = channels.get(word_id.as_str()).copied().unwrap_or(0);
            value["channel"].as_i64().unwrap_or(0) == channel
                && match value["speaker_index"].as_i64() {
                    Some(index) => indexes.get(word_id).copied().flatten() == Some(index),
                    None => true,
                }
        });
        if !covers {
            next.push(hint.clone());
        }
    }
    if let Some((human_id, anchor)) = assignment {
        next.push(json!({
            "id": format!("{anchor}:user_speaker_assignment:segment"),
            "word_id": anchor,
            "type": "user_speaker_assignment",
            "value": json!({
                "human_id": human_id,
                "scope": "segment",
                "word_ids": targets,
                "extend_to_adjacent": false,
            })
            .to_string(),
        }));
    }
    Value::Array(next)
}

/// Names, or clears the name of, the recording-level speaker who spoke one passage.
/// The identity is the durable record; the per-account hints are how every existing
/// reader, export and search consumer already shows a contact, so both move together
/// in one checked transaction.
pub async fn assign_speaker(
    pool: &SqlitePool,
    session_id: &str,
    word_id: &str,
    human_id: Option<&str>,
    expected_human_id: Option<&str>,
) -> Result<String, Error> {
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
    let attributions: BTreeMap<(String, String), String> =
        sqlx::query_as::<_, (String, String, String)>(
            "SELECT m.source_id, m.provider_label, s.speaker_key FROM dialext_source_speakers m
         JOIN dialext_speakers s ON s.id = m.speaker_id AND s.session_id = m.session_id
         WHERE m.session_id = ?",
        )
        .bind(session_id)
        .fetch_all(&mut *tx)
        .await?
        .into_iter()
        .map(|(source_id, label, key)| ((source_id, label), key))
        .collect();
    if attributions.is_empty() {
        return Err(invalid("This recording has no registered speakers"));
    }

    let rows = sqlx::query_as::<_, (String, String, String)>(
        "SELECT a.transcript_id, t.words_json, t.speaker_hints_json FROM dialext_accounts a
         JOIN transcripts t ON t.id = a.transcript_id AND t.session_id = a.session_id AND t.deleted_at IS NULL
         JOIN sessions s ON s.id = a.session_id AND s.deleted_at IS NULL
         WHERE a.session_id = ?",
    )
    .bind(session_id)
    .fetch_all(&mut *tx)
    .await?;
    if rows.is_empty() {
        return Err(invalid("This recording has no readable accounts"));
    }

    let mut accounts = Vec::new();
    let mut speaker_key: Option<String> = None;
    for (transcript_id, words_json, hints_json) in rows {
        let words: Value = serde_json::from_str(&words_json)?;
        let hints: Value = serde_json::from_str(&hints_json).unwrap_or(Value::Array(Vec::new()));
        for word in words.as_array().into_iter().flatten() {
            if word["id"].as_str() == Some(word_id) {
                speaker_key = word_speaker(word, &attributions);
            }
        }
        accounts.push(AccountPassages {
            transcript_id,
            words,
            hints,
            target_word_ids: Vec::new(),
        });
    }
    let Some(speaker_key) = speaker_key else {
        return Err(invalid(
            "This passage is not attributed to a speaker in this recording",
        ));
    };
    for account in &mut accounts {
        account.target_word_ids = account
            .words
            .as_array()
            .into_iter()
            .flatten()
            .filter(|word| word_speaker(word, &attributions).as_deref() == Some(&speaker_key))
            .filter_map(|word| word["id"].as_str().map(str::to_string))
            .collect();
    }

    let row_id = speaker_row_id(session_id, &speaker_key);
    let Some((current,)) = sqlx::query_as::<_, (Option<String>,)>(
        "SELECT human_id FROM dialext_speakers WHERE id = ? AND session_id = ?",
    )
    .bind(&row_id)
    .bind(session_id)
    .fetch_optional(&mut *tx)
    .await?
    else {
        return Err(invalid("This speaker is no longer part of the recording"));
    };
    if current.as_deref() != expected_human_id {
        return Err(invalid(
            "This speaker was named in another window. Refresh and review the name.",
        ));
    }
    if let Some(human_id) = human_id
        && sqlx::query_scalar::<_, i64>(
            "SELECT count(*) FROM humans WHERE id = ? AND deleted_at IS NULL",
        )
        .bind(human_id)
        .fetch_one(&mut *tx)
        .await?
            != 1
    {
        return Err(invalid("That contact is unavailable"));
    }

    sqlx::query("UPDATE dialext_speakers SET human_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND session_id = ?")
        .bind(human_id)
        .bind(&row_id)
        .bind(session_id)
        .execute(&mut *tx)
        .await?;

    for account in &accounts {
        if account.target_word_ids.is_empty() {
            continue;
        }
        let assignment = human_id.map(|human| (human, account.target_word_ids[0].as_str()));
        let next = rewrite_hints(
            &account.hints,
            &account.words,
            &account.target_word_ids,
            assignment,
        );
        if next == account.hints {
            continue;
        }
        sqlx::query("UPDATE transcripts SET speaker_hints_json = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND session_id = ?")
            .bind(next.to_string())
            .bind(&account.transcript_id)
            .bind(session_id)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(speaker_key)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn bundle() -> Value {
        serde_json::from_str(include_str!(
            "../../../dialext/fixtures/language-practice.json"
        ))
        .unwrap()
    }

    #[test]
    fn matching_provider_labels_across_two_readings_are_not_one_person() {
        let derived = derive(&bundle()).unwrap();
        let keys: Vec<&str> = derived
            .speakers
            .iter()
            .map(|speaker| speaker.key.as_str())
            .collect();
        assert_eq!(
            keys,
            vec![
                "english-asr/voice-a",
                "irish-asr/voice-a",
                "english-asr/voice-b",
                "irish-asr/voice-b"
            ],
            "each reading's own label stays its own speaker, ordered by first speech"
        );
        assert_eq!(derived.attributions.len(), 4);
    }

    #[test]
    fn a_declared_attribution_makes_two_labels_one_speaker() {
        let mut input = bundle();
        input["speakers"] = json!([{ "id": "gary" }]);
        input["source_speakers"] = json!([
            {"source_id": "irish-asr", "provider_label": "voice-a", "speaker_id": "gary"},
            {"source_id": "english-asr", "provider_label": "voice-a", "speaker_id": "gary"},
        ]);
        let derived = derive(&input).unwrap();
        assert_eq!(
            derived
                .speakers
                .iter()
                .filter(|speaker| speaker.key == "gary")
                .count(),
            1
        );
        assert_eq!(derived.speakers.len(), 3);
        assert_eq!(
            derived
                .attributions
                .iter()
                .filter(|attribution| attribution.speaker_key == "gary")
                .count(),
            2
        );
    }

    async fn recording(fixture: &str) -> (anlg_db_core::Db, tempfile::TempDir, String) {
        let db = anlg_db_core::Db::connect_memory_plain().await.unwrap();
        anlg_db_app::prepare_schema(&db).await.unwrap();
        let vault = tempfile::tempdir().unwrap();
        let bundle: Value = serde_json::from_str(fixture).unwrap();
        let id = format!("dialext-{}", bundle["recording"]["id"].as_str().unwrap());
        sqlx::query("INSERT INTO sessions(id,metadata_json) VALUES(?,?)")
            .bind(&id)
            .bind(
                json!({"dialext":{"version":1,"selected_language":"english","original":bundle.clone()}})
                    .to_string(),
            )
            .execute(db.pool())
            .await
            .unwrap();
        // The selected reading is written the way the desktop importer writes it.
        let words: Vec<Value> = bundle["accounts"]["english"]["segments"]
            .as_array()
            .unwrap()
            .iter()
            .enumerate()
            .map(|(index, segment)| {
                json!({"id": format!("{id}:passage:{index}"), "text": segment["text"],
                    "start_ms": segment["start_ms"], "end_ms": segment["end_ms"], "channel": 0,
                    "metadata": {"timing": {"source": "synthetic_text"},
                        "dialext": {"anchors": segment["anchors"], "source_speaker": segment["speaker"],
                            "target_language": "english", "spoken_language": segment["spoken_language"]}}})
            })
            .collect();
        sqlx::query(
            "INSERT INTO transcripts(id,session_id,words_json,speaker_hints_json) VALUES(?,?,?,'[]')",
        )
        .bind(format!("{id}:reading"))
        .bind(&id)
        .bind(serde_json::to_string(&words).unwrap())
        .execute(db.pool())
        .await
        .unwrap();
        crate::dialext::migrate_recording(db.pool(), vault.path(), &id)
            .await
            .unwrap();
        sqlx::query("INSERT INTO humans(id,name) VALUES('gary-contact','Gary')")
            .execute(db.pool())
            .await
            .unwrap();
        (db, vault, id)
    }

    async fn hints(db: &anlg_db_core::Db, transcript_id: &str) -> Value {
        serde_json::from_str(
            &sqlx::query_scalar::<_, String>(
                "SELECT speaker_hints_json FROM transcripts WHERE id = ?",
            )
            .bind(transcript_id)
            .fetch_one(db.pool())
            .await
            .unwrap(),
        )
        .unwrap()
    }

    fn assigned_word_ids(hints: &Value, human_id: &str) -> Vec<String> {
        hints
            .as_array()
            .unwrap()
            .iter()
            .filter(|hint| hint["type"] == "user_speaker_assignment")
            .filter_map(|hint| {
                let value: Value = serde_json::from_str(hint["value"].as_str()?).ok()?;
                (value["human_id"] == human_id).then(|| {
                    value["word_ids"]
                        .as_array()
                        .unwrap()
                        .iter()
                        .map(|id| id.as_str().unwrap().to_string())
                        .collect::<Vec<_>>()
                })
            })
            .flatten()
            .collect()
    }

    #[tokio::test]
    async fn a_named_speaker_reaches_every_language_account_and_survives_restart() {
        let fixture = include_str!("../../../dialext/fixtures/source-review.json");
        let (db, _vault, id) = recording(fixture).await;

        let key = assign_speaker(
            db.pool(),
            &id,
            &format!("{id}:passage:0"),
            Some("gary-contact"),
            None,
        )
        .await
        .unwrap();
        assert_eq!(key, "gary", "the declared identity, not a provider label");

        // Gary spoke the first and third passages of both readings.
        for transcript in [format!("{id}:reading"), format!("{id}:reading:ga:1")] {
            let assigned = assigned_word_ids(&hints(&db, &transcript).await, "gary-contact");
            assert_eq!(assigned.len(), 2, "{transcript}");
            assert!(
                assigned
                    .iter()
                    .all(|word| word.ends_with(":0") || word.ends_with(":2"))
            );
        }
        // The identity is the durable record; reopening reads it back.
        let stored: Option<String> = sqlx::query_scalar(
            "SELECT human_id FROM dialext_speakers WHERE session_id = ? AND speaker_key = 'gary'",
        )
        .bind(&id)
        .fetch_one(db.pool())
        .await
        .unwrap();
        assert_eq!(stored.as_deref(), Some("gary-contact"));
        let others: Vec<Option<String>> = sqlx::query_scalar(
            "SELECT human_id FROM dialext_speakers WHERE session_id = ? AND speaker_key <> 'gary'",
        )
        .bind(&id)
        .fetch_all(db.pool())
        .await
        .unwrap();
        assert!(others.iter().all(Option::is_none));
    }

    #[tokio::test]
    async fn naming_one_reading_s_voice_never_claims_the_other_reading_s_voice() {
        // language-practice declares no attribution, so every provider label is its
        // own recording speaker and naming one must not name the look-alike.
        let fixture = include_str!("../../../dialext/fixtures/language-practice.json");
        let (db, _vault, id) = recording(fixture).await;
        let key = assign_speaker(
            db.pool(),
            &id,
            &format!("{id}:passage:0"),
            Some("gary-contact"),
            None,
        )
        .await
        .unwrap();
        assert_eq!(key, "irish-asr/voice-a");
        let named: Vec<String> = sqlx::query_scalar(
            "SELECT speaker_key FROM dialext_speakers WHERE session_id = ? AND human_id IS NOT NULL",
        )
        .bind(&id)
        .fetch_all(db.pool())
        .await
        .unwrap();
        assert_eq!(named, vec!["irish-asr/voice-a".to_string()]);
        let assigned =
            assigned_word_ids(&hints(&db, &format!("{id}:reading")).await, "gary-contact");
        assert_eq!(assigned, vec![format!("{id}:passage:0")]);
    }

    #[tokio::test]
    async fn a_stale_or_unavailable_name_is_refused_without_changing_anything() {
        let fixture = include_str!("../../../dialext/fixtures/source-review.json");
        let (db, _vault, id) = recording(fixture).await;
        let word = format!("{id}:passage:0");
        assign_speaker(db.pool(), &id, &word, Some("gary-contact"), None)
            .await
            .unwrap();

        assert!(
            assign_speaker(db.pool(), &id, &word, Some("gary-contact"), None)
                .await
                .is_err(),
            "a second window's stale expectation must be refused"
        );
        assert!(
            assign_speaker(db.pool(), &id, &word, Some("nobody"), Some("gary-contact"))
                .await
                .is_err()
        );
        // An unattributed passage names no recording speaker.
        assert!(
            assign_speaker(
                db.pool(),
                &id,
                &format!("{id}:passage:3"),
                Some("gary-contact"),
                None
            )
            .await
            .is_err()
        );
        let assigned =
            assigned_word_ids(&hints(&db, &format!("{id}:reading")).await, "gary-contact");
        assert_eq!(assigned.len(), 2);
    }

    #[tokio::test]
    async fn clearing_a_name_narrows_the_assignment_and_keeps_other_people() {
        let fixture = include_str!("../../../dialext/fixtures/source-review.json");
        let (db, _vault, id) = recording(fixture).await;
        sqlx::query("INSERT INTO humans(id,name) VALUES('nuala-contact','Nuala')")
            .execute(db.pool())
            .await
            .unwrap();
        assign_speaker(
            db.pool(),
            &id,
            &format!("{id}:passage:0"),
            Some("gary-contact"),
            None,
        )
        .await
        .unwrap();
        assign_speaker(
            db.pool(),
            &id,
            &format!("{id}:passage:1"),
            Some("nuala-contact"),
            None,
        )
        .await
        .unwrap();

        assign_speaker(
            db.pool(),
            &id,
            &format!("{id}:passage:0"),
            None,
            Some("gary-contact"),
        )
        .await
        .unwrap();
        let english = hints(&db, &format!("{id}:reading")).await;
        assert!(assigned_word_ids(&english, "gary-contact").is_empty());
        assert_eq!(
            assigned_word_ids(&english, "nuala-contact"),
            vec![format!("{id}:passage:1")]
        );
    }

    #[tokio::test]
    async fn a_deleted_recording_keeps_its_speakers_and_refuses_naming_until_restored() {
        let fixture = include_str!("../../../dialext/fixtures/source-review.json");
        let (db, _vault, id) = recording(fixture).await;
        let word = format!("{id}:passage:0");
        assign_speaker(db.pool(), &id, &word, Some("gary-contact"), None)
            .await
            .unwrap();
        sqlx::query("UPDATE sessions SET deleted_at = 'deleted' WHERE id = ?")
            .bind(&id)
            .execute(db.pool())
            .await
            .unwrap();
        assert!(
            assign_speaker(db.pool(), &id, &word, None, Some("gary-contact"))
                .await
                .is_err()
        );
        let retained: i64 =
            sqlx::query_scalar("SELECT count(*) FROM dialext_speakers WHERE session_id = ?")
                .bind(&id)
                .fetch_one(db.pool())
                .await
                .unwrap();
        assert_eq!(retained, 2);
        sqlx::query("UPDATE sessions SET deleted_at = NULL WHERE id = ?")
            .bind(&id)
            .execute(db.pool())
            .await
            .unwrap();
        assign_speaker(db.pool(), &id, &word, None, Some("gary-contact"))
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn an_existing_saved_assignment_is_narrowed_rather_than_discarded() {
        let fixture = include_str!("../../../dialext/fixtures/source-review.json");
        let (db, _vault, id) = recording(fixture).await;
        sqlx::query("INSERT INTO humans(id,name) VALUES('earlier','Earlier name')")
            .execute(db.pool())
            .await
            .unwrap();
        // The baseline shape: one saved assignment covering every passage at once.
        let all: Vec<String> = (0..4)
            .map(|index| format!("{id}:passage:{index}"))
            .collect();
        sqlx::query("UPDATE transcripts SET speaker_hints_json = ? WHERE id = ?")
            .bind(
                json!([{ "id": "saved", "word_id": all[0], "type": "user_speaker_assignment",
                    "value": json!({"human_id":"earlier","scope":"segment","word_ids": all}).to_string() }])
                .to_string(),
            )
            .bind(format!("{id}:reading"))
            .execute(db.pool())
            .await
            .unwrap();

        assign_speaker(
            db.pool(),
            &id,
            &format!("{id}:passage:0"),
            Some("gary-contact"),
            None,
        )
        .await
        .unwrap();
        let english = hints(&db, &format!("{id}:reading")).await;
        assert_eq!(
            assigned_word_ids(&english, "earlier"),
            vec![format!("{id}:passage:1"), format!("{id}:passage:3")],
            "the earlier name keeps the passages the new one does not claim"
        );
        assert_eq!(assigned_word_ids(&english, "gary-contact").len(), 2);
    }

    #[test]
    fn declared_attributions_must_name_real_speakers_and_real_labels() {
        for (speakers, mappings) in [
            (
                json!([{ "id": "gary" }]),
                json!([
                    {"source_id": "irish-asr", "provider_label": "voice-z", "speaker_id": "gary"}
                ]),
            ),
            (
                json!([{ "id": "gary" }]),
                json!([
                    {"source_id": "irish-asr", "provider_label": "voice-a", "speaker_id": "nobody"}
                ]),
            ),
            (json!([{ "id": "gary" }]), json!([])),
            (
                json!([{ "id": "with/slash" }]),
                json!([
                    {"source_id": "irish-asr", "provider_label": "voice-a", "speaker_id": "with/slash"}
                ]),
            ),
            (
                json!([{ "id": "gary" }]),
                json!([
                    {"source_id": "irish-asr", "provider_label": "voice-a", "speaker_id": "gary"},
                    {"source_id": "irish-asr", "provider_label": "voice-a", "speaker_id": "gary"},
                ]),
            ),
        ] {
            let mut input = bundle();
            input["speakers"] = speakers;
            input["source_speakers"] = mappings;
            assert!(derive(&input).is_err());
        }
    }

    /// `speaker_index` is what groups passages into speaker blocks for the reader,
    /// the export and search. Each recording-level speaker must therefore have its
    /// own, consistently in every reading.
    async fn speaker_indexes(db: &anlg_db_core::Db, transcript_id: &str) -> Vec<Option<i64>> {
        let hints = hints(db, transcript_id).await;
        let words: Value = serde_json::from_str(
            &sqlx::query_scalar::<_, String>("SELECT words_json FROM transcripts WHERE id = ?")
                .bind(transcript_id)
                .fetch_one(db.pool())
                .await
                .unwrap(),
        )
        .unwrap();
        let indexes = provider_speaker_indexes(&hints);
        words
            .as_array()
            .unwrap()
            .iter()
            .map(|word| indexes.get(word["id"].as_str().unwrap()).copied().flatten())
            .collect()
    }

    #[tokio::test]
    async fn every_recording_speaker_gets_its_own_block_in_both_readings() {
        let fixture = include_str!("../../../dialext/fixtures/source-review.json");
        let (db, _vault, id) = recording(fixture).await;

        // Gary speaks the first and third passages, Nuala the second, and the fourth
        // is attributed to nobody, so it carries no index and stays its own block.
        assert_eq!(
            speaker_indexes(&db, &format!("{id}:reading")).await,
            vec![Some(0), Some(1), Some(0), None],
            "the selected reading the importer wrote must group by recording speaker"
        );
        assert_eq!(
            speaker_indexes(&db, &format!("{id}:reading:ga:1")).await,
            vec![Some(0), Some(1), Some(0), None],
            "an index means the same person in the other reading"
        );
    }

    #[tokio::test]
    async fn two_sources_sharing_a_provider_label_are_not_one_block() {
        // Both readings now label a voice "B", but they are two different people:
        // `irish-asr/B` is Gary and `english-asr/B` is Nuala.
        let fixture =
            include_str!("../../../dialext/fixtures/source-review.json").replace("spk-1", "B");
        let (db, _vault, id) = recording(&fixture).await;

        let indexes = speaker_indexes(&db, &format!("{id}:reading")).await;
        assert_eq!(indexes[0], indexes[2], "both of Gary's passages are Gary");
        assert_ne!(
            indexes[0], indexes[1],
            "a shared label string must not merge two recording speakers"
        );
    }

    #[tokio::test]
    async fn the_index_pass_keeps_a_saved_name_and_settles() {
        let fixture = include_str!("../../../dialext/fixtures/source-review.json");
        let (db, _vault, id) = recording(fixture).await;
        assign_speaker(
            db.pool(),
            &id,
            &format!("{id}:passage:0"),
            Some("gary-contact"),
            None,
        )
        .await
        .unwrap();
        let named = assigned_word_ids(&hints(&db, &format!("{id}:reading")).await, "gary-contact");
        let stamped =
            sqlx::query_scalar::<_, String>("SELECT updated_at FROM transcripts WHERE id = ?")
                .bind(format!("{id}:reading"))
                .fetch_one(db.pool())
                .await
                .unwrap();

        migrate_all_speaker_indexes(db.pool()).await.unwrap();

        assert_eq!(
            assigned_word_ids(&hints(&db, &format!("{id}:reading")).await, "gary-contact"),
            named,
            "a reader's saved name is not a speaker index and must survive verbatim"
        );
        assert_eq!(
            speaker_indexes(&db, &format!("{id}:reading")).await,
            vec![Some(0), Some(1), Some(0), None]
        );
        assert_eq!(
            sqlx::query_scalar::<_, String>("SELECT updated_at FROM transcripts WHERE id = ?")
                .bind(format!("{id}:reading"))
                .fetch_one(db.pool())
                .await
                .unwrap(),
            stamped,
            "a pass with nothing to change must not write"
        );
    }
}
