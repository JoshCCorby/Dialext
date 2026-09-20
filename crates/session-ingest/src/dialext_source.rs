//! Source review: measured synthetic audio and exact anchor resolution.
//!
//! An anchor names `(source_id, start_ms, end_ms)` against an immutable ASR reading.
//! Nothing here resolves a near match, a containing interval or a text similarity: a
//! passage either names a stored interval exactly or it cannot be reviewed.
use serde_json::{Value, json};
use sqlx::SqlitePool;
use std::path::Path;

use crate::dialext::{Error, invalid, read_artifact_bounded, sha256, write_artifact_as};

/// Source audio is app-owned evidence, not a session attachment: the upstream session
/// directory resolver refuses a non-UUID session id, which every Dialext recording has.
pub const SOURCE_AUDIO_ID: &str = "source-audio";
pub const MAX_SOURCE_AUDIO_BYTES: usize = 32 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct SourceAudio {
    pub sha256: String,
    pub artifact_path: String,
    pub duration_ms: i64,
}

/// Why an interval cannot be played. Each reason is a separate refusal rather than a
/// silent absence, so the panel can say which check failed.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AudioUnavailable {
    NoSourceAudio,
    AudioMissingOrCorrupt,
    IntervalBeyondMeasuredAudio,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct SourceIntervalAudio {
    pub measured_duration_ms: i64,
    pub clip_wav: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct SourceInterval {
    pub source_id: String,
    pub revision: i64,
    pub evidence_sha256: String,
    pub start_ms: i64,
    pub end_ms: i64,
    /// The provider's own words for this interval, never the readable account's prose.
    pub evidence_text: String,
    /// The provider's own diarised label, scoped to this source alone.
    pub provider_label: Option<String>,
    pub speaker_key: Option<String>,
    pub speaker_display_index: Option<i64>,
    pub human_id: Option<String>,
    pub audio: Option<SourceIntervalAudio>,
    pub audio_unavailable: Option<AudioUnavailable>,
}

fn refuse(reason: &str) -> Error {
    invalid(reason)
}

// ---------------------------------------------------------------------------
// 16-bit PCM WAV. The fixture format is fixed deliberately: measuring and slicing
// without a decoder keeps "the real measured interval" an exact sample range.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy)]
pub(crate) struct Pcm16 {
    pub channels: u16,
    pub sample_rate: u32,
    pub data_offset: usize,
    pub data_len: usize,
}

impl Pcm16 {
    fn frame_bytes(&self) -> usize {
        usize::from(self.channels) * 2
    }

    pub(crate) fn duration_ms(&self) -> i64 {
        let frames = (self.data_len / self.frame_bytes()) as i64;
        frames * 1000 / i64::from(self.sample_rate)
    }
}

fn u16_at(bytes: &[u8], at: usize) -> Option<u16> {
    Some(u16::from_le_bytes(bytes.get(at..at + 2)?.try_into().ok()?))
}

fn u32_at(bytes: &[u8], at: usize) -> Option<u32> {
    Some(u32::from_le_bytes(bytes.get(at..at + 4)?.try_into().ok()?))
}

pub(crate) fn parse_wav(bytes: &[u8]) -> Result<Pcm16, Error> {
    if bytes.len() < 12 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
        return Err(refuse("Source audio must be a RIFF WAVE file"));
    }
    let mut cursor = 12;
    let mut format: Option<(u16, u32)> = None;
    while cursor + 8 <= bytes.len() {
        let id = &bytes[cursor..cursor + 4];
        let size =
            u32_at(bytes, cursor + 4).ok_or_else(|| refuse("Truncated source audio"))? as usize;
        let body = cursor + 8;
        if body + size > bytes.len() {
            return Err(refuse("Truncated source audio"));
        }
        if id == b"fmt " {
            if size < 16 {
                return Err(refuse("Unsupported source audio format"));
            }
            let tag = u16_at(bytes, body).ok_or_else(|| refuse("Truncated source audio"))?;
            let channels =
                u16_at(bytes, body + 2).ok_or_else(|| refuse("Truncated source audio"))?;
            let sample_rate =
                u32_at(bytes, body + 4).ok_or_else(|| refuse("Truncated source audio"))?;
            let bits = u16_at(bytes, body + 14).ok_or_else(|| refuse("Truncated source audio"))?;
            if tag != 1 || bits != 16 || channels == 0 || channels > 2 || sample_rate == 0 {
                return Err(refuse(
                    "Source audio must be 16-bit PCM with one or two channels",
                ));
            }
            format = Some((channels, sample_rate));
        } else if id == b"data" {
            let (channels, sample_rate) =
                format.ok_or_else(|| refuse("Source audio data precedes its format"))?;
            let pcm = Pcm16 {
                channels,
                sample_rate,
                data_offset: body,
                data_len: size - size % (usize::from(channels) * 2),
            };
            if pcm.data_len == 0 {
                return Err(refuse("Source audio contains no samples"));
            }
            return Ok(pcm);
        }
        cursor = body + size + (size % 2);
    }
    Err(refuse("Source audio has no data chunk"))
}

pub(crate) fn slice_wav(bytes: &[u8], pcm: &Pcm16, start_ms: i64, end_ms: i64) -> Vec<u8> {
    let frame = pcm.frame_bytes();
    let frames = pcm.data_len / frame;
    let at = |ms: i64| -> usize {
        let index = (ms.max(0) as u128 * u128::from(pcm.sample_rate) / 1000) as usize;
        index.min(frames)
    };
    let first = at(start_ms);
    let last = at(end_ms).max(first);
    let from = pcm.data_offset + first * frame;
    let to = pcm.data_offset + last * frame;
    let body = &bytes[from..to];
    let byte_rate = u32::from(pcm.channels) * pcm.sample_rate * 2;
    let mut wav = Vec::with_capacity(44 + body.len());
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&((36 + body.len()) as u32).to_le_bytes());
    wav.extend_from_slice(b"WAVEfmt ");
    wav.extend_from_slice(&16u32.to_le_bytes());
    wav.extend_from_slice(&1u16.to_le_bytes());
    wav.extend_from_slice(&pcm.channels.to_le_bytes());
    wav.extend_from_slice(&pcm.sample_rate.to_le_bytes());
    wav.extend_from_slice(&byte_rate.to_le_bytes());
    wav.extend_from_slice(&(pcm.channels * 2).to_le_bytes());
    wav.extend_from_slice(&16u16.to_le_bytes());
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&(body.len() as u32).to_le_bytes());
    wav.extend_from_slice(body);
    wav
}

// ---------------------------------------------------------------------------
// Attachment
// ---------------------------------------------------------------------------

/// Publishes measured source audio as immutable app-owned evidence. An identical
/// repeat returns the stored row; different bytes under the same identity are refused
/// rather than replacing evidence an account was already anchored against.
pub async fn attach_source_audio(
    pool: &SqlitePool,
    vault: &Path,
    session_id: &str,
    bytes: &[u8],
) -> Result<SourceAudio, Error> {
    if bytes.len() > MAX_SOURCE_AUDIO_BYTES {
        return Err(refuse("Source audio exceeds the bounded prototype limit"));
    }
    let pcm = parse_wav(bytes)?;
    let duration_ms = pcm.duration_ms();
    if duration_ms <= 0 {
        return Err(refuse("Source audio has no measurable duration"));
    }
    let digest = sha256(bytes);

    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
    if sqlx::query_scalar::<_, i64>(
        "SELECT count(*) FROM dialext_recordings r JOIN sessions s ON s.id = r.id AND s.deleted_at IS NULL WHERE r.id = ?",
    )
    .bind(session_id)
    .fetch_one(&mut *tx)
    .await?
        != 1
    {
        return Err(refuse("This recording has no registered Dialext accounts"));
    }
    if let Some((stored, path, stored_duration)) = sqlx::query_as::<_, (String, String, Option<i64>)>(
        "SELECT sha256, artifact_path, duration_ms FROM dialext_evidence WHERE session_id = ? AND source_id = ? AND kind = 'audio'",
    )
    .bind(session_id)
    .bind(SOURCE_AUDIO_ID)
    .fetch_optional(&mut *tx)
    .await?
    {
        if stored != digest {
            return Err(refuse(
                "Different source audio is already stored for this recording",
            ));
        }
        return Ok(SourceAudio {
            sha256: stored,
            artifact_path: path,
            duration_ms: stored_duration.unwrap_or(duration_ms),
        });
    }
    let transcribed = last_transcribed_ms(&mut tx, session_id).await?;
    if duration_ms < transcribed {
        return Err(refuse(
            "Source audio is shorter than the readings recorded against it",
        ));
    }
    // Bytes publish before the row that names them, so a crash can leave an unreferenced
    // file but never a reference to a partial one.
    let (artifact_path, _) = write_artifact_as(vault, bytes, "wav", MAX_SOURCE_AUDIO_BYTES)?;
    sqlx::query(
        "INSERT INTO dialext_evidence(id,session_id,kind,source_id,revision,sha256,artifact_path,duration_ms) VALUES(?,?,'audio',?,1,?,?,?)",
    )
    .bind(format!("{session_id}:{SOURCE_AUDIO_ID}:1"))
    .bind(session_id)
    .bind(SOURCE_AUDIO_ID)
    .bind(&digest)
    .bind(&artifact_path)
    .bind(duration_ms)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(SourceAudio {
        sha256: digest,
        artifact_path,
        duration_ms,
    })
}

async fn last_transcribed_ms(
    tx: &mut sqlx::SqliteConnection,
    session_id: &str,
) -> Result<i64, Error> {
    Ok(sqlx::query_scalar::<_, Option<i64>>(
        "SELECT max(duration_ms) FROM dialext_evidence WHERE session_id = ? AND kind = 'asr'",
    )
    .bind(session_id)
    .fetch_one(&mut *tx)
    .await?
    .unwrap_or(0))
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/// Resolves one anchor exactly. Foreign sources, near matches, ambiguous evidence
/// versions and corrupt artefacts are separate refusals; missing audio is a reported
/// state on an otherwise resolved interval, because the provider's words are still
/// evidence worth reading.
pub async fn read_source_interval(
    pool: &SqlitePool,
    vault: &Path,
    session_id: &str,
    source_id: &str,
    start_ms: i64,
    end_ms: i64,
) -> Result<SourceInterval, Error> {
    if start_ms < 0 || end_ms <= start_ms {
        return Err(refuse("Invalid source interval"));
    }
    let rows = sqlx::query_as::<_, (i64, String, String)>(
        "SELECT revision, sha256, artifact_path FROM dialext_evidence WHERE session_id = ? AND source_id = ? AND kind = 'asr' ORDER BY revision",
    )
    .bind(session_id)
    .bind(source_id)
    .fetch_all(pool)
    .await?;
    let [(revision, evidence_sha256, artifact_path)] = rows.as_slice() else {
        return Err(refuse(if rows.is_empty() {
            "This recording has no reading from that source"
        } else {
            "This source has more than one stored reading; an anchor cannot name one of them"
        }));
    };
    assert_pinned_evidence(pool, session_id).await?;

    let bytes = read_artifact_bounded(
        vault,
        artifact_path,
        evidence_sha256,
        crate::MAX_SESSION_INGEST_BYTES,
    )?;
    let stored: Value = serde_json::from_slice(&bytes)?;
    let segments = crate::dialext::array(&stored["source"], "segments")?;
    let Some(segment) = segments.iter().find(|segment| {
        segment["start_ms"].as_i64() == Some(start_ms) && segment["end_ms"].as_i64() == Some(end_ms)
    }) else {
        return Err(refuse(
            "That passage does not name a stored interval of this reading",
        ));
    };
    let provider_label = segment["speaker"].as_str().map(str::to_string);
    let speaker =
        match &provider_label {
            Some(label) => sqlx::query_as::<_, (String, i64, Option<String>)>(
                "SELECT s.speaker_key, s.display_index, s.human_id FROM dialext_source_speakers m
             JOIN dialext_speakers s ON s.id = m.speaker_id AND s.session_id = m.session_id
             WHERE m.session_id = ? AND m.source_id = ? AND m.provider_label = ?",
            )
            .bind(session_id)
            .bind(source_id)
            .bind(label)
            .fetch_optional(pool)
            .await?,
            None => None,
        };

    let (audio, audio_unavailable) =
        read_interval_audio(pool, vault, session_id, start_ms, end_ms).await?;
    Ok(SourceInterval {
        source_id: source_id.to_string(),
        revision: *revision,
        evidence_sha256: evidence_sha256.clone(),
        start_ms,
        end_ms,
        evidence_text: crate::dialext::text(segment, "text")?.to_string(),
        provider_label,
        speaker_key: speaker.as_ref().map(|row| row.0.clone()),
        speaker_display_index: speaker.as_ref().map(|row| row.1),
        human_id: speaker.and_then(|row| row.2),
        audio,
        audio_unavailable,
    })
}

/// The account being read must have been generated from exactly the evidence still
/// stored, so an anchor cannot resolve against a reading the account never saw.
async fn assert_pinned_evidence(pool: &SqlitePool, session_id: &str) -> Result<(), Error> {
    let stored = sqlx::query_as::<_, (String, i64, String)>(
        "SELECT source_id, revision, sha256 FROM dialext_evidence WHERE session_id = ? AND kind = 'asr' ORDER BY source_id",
    )
    .bind(session_id)
    .fetch_all(pool)
    .await?;
    let sources: Vec<Value> = stored
        .iter()
        .map(|(source_id, revision, sha256)| {
            json!({"source_id": source_id, "revision": revision, "sha256": sha256})
        })
        .collect();
    let digest = sha256_of_evidence_set(&sources)?;
    let pinned: Vec<String> = sqlx::query_scalar(
        "SELECT a.input_evidence_digest FROM dialext_accounts a
         JOIN dialext_recordings r ON r.id = a.session_id AND r.active_account_id = a.id
         WHERE a.session_id = ?",
    )
    .bind(session_id)
    .fetch_all(pool)
    .await?;
    if pinned.iter().any(|value| *value != digest) {
        return Err(refuse(
            "The stored readings are not the ones this account was generated from",
        ));
    }
    Ok(())
}

pub(crate) fn sha256_of_evidence_set(sources: &[Value]) -> Result<String, Error> {
    Ok(sha256(&crate::dialext::artifact(
        json!({"format":"dialext-evidence-set","version":1,"sources":sources}),
    )?))
}

async fn read_interval_audio(
    pool: &SqlitePool,
    vault: &Path,
    session_id: &str,
    start_ms: i64,
    end_ms: i64,
) -> Result<(Option<SourceIntervalAudio>, Option<AudioUnavailable>), Error> {
    let Some((digest, artifact_path, duration_ms)) =
        sqlx::query_as::<_, (String, String, Option<i64>)>(
            "SELECT sha256, artifact_path, duration_ms FROM dialext_evidence WHERE session_id = ? AND source_id = ? AND kind = 'audio'",
        )
        .bind(session_id)
        .bind(SOURCE_AUDIO_ID)
        .fetch_optional(pool)
        .await?
    else {
        return Ok((None, Some(AudioUnavailable::NoSourceAudio)));
    };
    let Ok(bytes) = read_artifact_bounded(vault, &artifact_path, &digest, MAX_SOURCE_AUDIO_BYTES)
    else {
        return Ok((None, Some(AudioUnavailable::AudioMissingOrCorrupt)));
    };
    let Ok(pcm) = parse_wav(&bytes) else {
        return Ok((None, Some(AudioUnavailable::AudioMissingOrCorrupt)));
    };
    let measured_duration_ms = duration_ms.unwrap_or_else(|| pcm.duration_ms());
    if end_ms > pcm.duration_ms() {
        return Ok((None, Some(AudioUnavailable::IntervalBeyondMeasuredAudio)));
    }
    Ok((
        Some(SourceIntervalAudio {
            measured_duration_ms,
            clip_wav: slice_wav(&bytes, &pcm, start_ms, end_ms),
        }),
        None,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    pub(crate) fn tone_wav(duration_ms: i64, sample_rate: u32) -> Vec<u8> {
        let frames = (duration_ms as u32 * sample_rate / 1000) as usize;
        let mut body = Vec::with_capacity(frames * 2);
        for frame in 0..frames {
            let phase = frame as f64 * 440.0 * std::f64::consts::TAU / f64::from(sample_rate);
            body.extend_from_slice(&((phase.sin() * 8000.0) as i16).to_le_bytes());
        }
        let pcm = Pcm16 {
            channels: 1,
            sample_rate,
            data_offset: 0,
            data_len: body.len(),
        };
        slice_wav(&body, &pcm, 0, duration_ms)
    }

    #[test]
    fn measures_and_slices_the_real_interval() {
        let wav = tone_wav(9000, 16_000);
        let pcm = parse_wav(&wav).unwrap();
        assert_eq!(pcm.duration_ms(), 9000);
        assert_eq!(pcm.sample_rate, 16_000);

        let clip = slice_wav(&wav, &pcm, 4500, 8500);
        let clip_pcm = parse_wav(&clip).unwrap();
        assert_eq!(clip_pcm.duration_ms(), 4000);
        // 16 kHz mono 16-bit: one millisecond is 16 frames of two bytes.
        let from = pcm.data_offset + 4500 * 32;
        assert_eq!(
            &clip[clip_pcm.data_offset..],
            &wav[from..from + 4000 * 32],
            "the clip must be the stored samples for that interval, not a re-synthesis"
        );
    }

    async fn adopted(vault: &Path) -> (anlg_db_core::Db, String) {
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
        (db, id)
    }

    #[tokio::test]
    async fn attaching_measured_audio_is_idempotent_and_never_replaced() {
        let vault = tempfile::tempdir().unwrap();
        let (db, id) = adopted(vault.path()).await;
        let wav = tone_wav(9000, 16_000);

        let stored = attach_source_audio(db.pool(), vault.path(), &id, &wav)
            .await
            .unwrap();
        assert_eq!(stored.duration_ms, 9000);
        assert!(stored.artifact_path.ends_with(".wav"));
        assert_eq!(
            attach_source_audio(db.pool(), vault.path(), &id, &wav)
                .await
                .unwrap(),
            stored
        );
        assert!(
            attach_source_audio(db.pool(), vault.path(), &id, &tone_wav(9000, 22_050))
                .await
                .is_err(),
            "different bytes under one identity must not replace stored evidence"
        );
        let rows: i64 =
            sqlx::query_scalar("SELECT count(*) FROM dialext_evidence WHERE kind = 'audio'")
                .fetch_one(db.pool())
                .await
                .unwrap();
        assert_eq!(rows, 1);
    }

    #[tokio::test]
    async fn refuses_audio_shorter_than_the_readings_and_foreign_recordings() {
        let vault = tempfile::tempdir().unwrap();
        let (db, id) = adopted(vault.path()).await;
        assert!(
            attach_source_audio(db.pool(), vault.path(), &id, &tone_wav(4000, 16_000))
                .await
                .is_err()
        );
        assert!(
            attach_source_audio(db.pool(), vault.path(), "unknown", &tone_wav(9000, 16_000))
                .await
                .is_err()
        );
    }

    #[tokio::test]
    async fn resolves_only_an_exact_anchor_and_plays_its_measured_interval() {
        let vault = tempfile::tempdir().unwrap();
        let (db, id) = adopted(vault.path()).await;
        attach_source_audio(db.pool(), vault.path(), &id, &tone_wav(9000, 16_000))
            .await
            .unwrap();

        let resolved = read_source_interval(db.pool(), vault.path(), &id, "irish-asr", 0, 4000)
            .await
            .unwrap();
        assert_eq!(resolved.evidence_text, "Ba mhaith liom caife a ordú.");
        assert_eq!(resolved.provider_label.as_deref(), Some("voice-a"));
        assert_eq!(resolved.speaker_key.as_deref(), Some("irish-asr/voice-a"));
        assert_eq!(resolved.human_id, None);
        let audio = resolved.audio.expect("measured interval");
        assert_eq!(audio.measured_duration_ms, 9000);
        assert_eq!(parse_wav(&audio.clip_wav).unwrap().duration_ms(), 4000);

        // The English reading's own label for the same interval stays its own speaker.
        let english = read_source_interval(db.pool(), vault.path(), &id, "english-asr", 0, 4000)
            .await
            .unwrap();
        assert_eq!(english.speaker_key.as_deref(), Some("english-asr/voice-a"));
        assert_ne!(english.speaker_key, resolved.speaker_key);
        assert_eq!(english.evidence_text, "I would like to order coffee.");

        for (source, start, end) in [
            ("irish-asr", 0, 3999),
            ("irish-asr", 1, 4000),
            ("irish-asr", 0, 8500),
            ("welsh-asr", 0, 4000),
        ] {
            assert!(
                read_source_interval(db.pool(), vault.path(), &id, source, start, end)
                    .await
                    .is_err(),
                "{source} {start}-{end} must not resolve"
            );
        }
    }

    #[tokio::test]
    async fn reports_each_missing_audio_reason_without_hiding_the_evidence() {
        let vault = tempfile::tempdir().unwrap();
        let (db, id) = adopted(vault.path()).await;
        let absent = read_source_interval(db.pool(), vault.path(), &id, "irish-asr", 0, 4000)
            .await
            .unwrap();
        assert_eq!(
            absent.audio_unavailable,
            Some(AudioUnavailable::NoSourceAudio)
        );
        assert_eq!(absent.evidence_text, "Ba mhaith liom caife a ordú.");

        attach_source_audio(db.pool(), vault.path(), &id, &tone_wav(9000, 16_000))
            .await
            .unwrap();
        let path: String =
            sqlx::query_scalar("SELECT artifact_path FROM dialext_evidence WHERE kind = 'audio'")
                .fetch_one(db.pool())
                .await
                .unwrap();
        std::fs::write(vault.path().join(&path), b"corrupt").unwrap();
        let corrupt = read_source_interval(db.pool(), vault.path(), &id, "irish-asr", 0, 4000)
            .await
            .unwrap();
        assert_eq!(
            corrupt.audio_unavailable,
            Some(AudioUnavailable::AudioMissingOrCorrupt)
        );
        assert_eq!(corrupt.evidence_text, "Ba mhaith liom caife a ordú.");
    }

    #[tokio::test]
    async fn refuses_a_reading_the_account_was_not_generated_from() {
        let vault = tempfile::tempdir().unwrap();
        let (db, id) = adopted(vault.path()).await;
        sqlx::query("INSERT INTO dialext_evidence(id,session_id,kind,source_id,revision,sha256,artifact_path) VALUES(?,?,'asr','later-asr',1,?,'dialext/artifacts/v1/x.json')")
            .bind(format!("{id}:later"))
            .bind(&id)
            .bind("0".repeat(64))
            .execute(db.pool())
            .await
            .unwrap();
        assert!(
            read_source_interval(db.pool(), vault.path(), &id, "irish-asr", 0, 4000)
                .await
                .is_err()
        );
    }

    #[test]
    fn refuses_audio_that_is_not_bounded_16_bit_pcm() {
        assert!(parse_wav(b"not audio").is_err());
        let mut truncated = tone_wav(100, 16_000);
        truncated.truncate(30);
        assert!(parse_wav(&truncated).is_err());
        let mut eight_bit = tone_wav(100, 16_000);
        eight_bit[34] = 8;
        assert!(parse_wav(&eight_bit).is_err());
    }
}
