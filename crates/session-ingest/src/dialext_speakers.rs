//! Recording-level speaker identity.
//!
//! Two independent readings diarise separately, so `irish-asr/voice-a` and
//! `english-asr/voice-a` are two provider labels and not one person. A prepared
//! recording may declare that some of them are the same person; where it does not,
//! each provider label stays its own recording-level speaker. Nothing here merges
//! labels because their strings match.
use serde_json::Value;
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
}
