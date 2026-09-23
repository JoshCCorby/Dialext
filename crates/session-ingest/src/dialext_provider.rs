//! Durable native ownership of the development provider bridge.
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::{SqliteConnection, SqlitePool};
use std::{collections::BTreeMap, path::Path, process::Stdio};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

use crate::dialext::{
    Error, artifact, invalid, read_artifact, sha256, write_artifact, write_artifact_as,
};
use crate::dialext_source::{MAX_SOURCE_AUDIO_BYTES, SOURCE_AUDIO_ID, parse_wav};

pub const PROTOCOL_VERSION: i64 = 1;
pub const MAX_PROTOCOL_BYTES: usize = 2 * 1024 * 1024;
const DEFAULT_USER_ID: &str = "00000000-0000-0000-0000-000000000000";
const PROVIDER: &str = "fixture";
const ASR_MODEL: &str = "fixture-asr-v1";
const RECONSTRUCTION_MODEL: &str = "fixture-reconstruction-v1";
const PROMPT_VERSION: &str = "fixture-reconstruction-prompt-v1";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskStart {
    pub task_id: String,
    pub session_id: String,
}

#[derive(Debug, Clone)]
struct Task {
    id: String,
    session_id: String,
    target_language: String,
    audio_sha256: String,
    input_revision: i64,
    attempt: i64,
}

#[derive(Debug, Clone)]
struct Stage {
    result: Value,
    result_sha256: String,
}

type SourceInterval = (String, i64, i64);
type SourceIndex = BTreeMap<SourceInterval, Option<String>>;

struct StageSpec<'a> {
    kind: &'a str,
    source_locale: &'a str,
    target_language: &'a str,
    model: &'a str,
    prompt_version: &'a str,
    request_key: &'a str,
    evidence: Option<(&'a str, i64)>,
}

struct AsrSpec<'a> {
    source_locale: &'a str,
    source_id: &'a str,
    audio_path: &'a str,
    duration_ms: i64,
}

#[derive(Debug, Deserialize)]
struct HelperResponse {
    protocol_version: i64,
    stage: String,
    result: Value,
}

fn validate_language(language: &str) -> Result<(), Error> {
    if ["en", "ga"].contains(&language) {
        Ok(())
    } else {
        Err(invalid(
            "Dialext supports fixture generation only in English and Irish",
        ))
    }
}

fn request_key(value: Value) -> Result<String, Error> {
    Ok(sha256(&artifact(value)?))
}

pub async fn create_recording_task(
    pool: &SqlitePool,
    vault: &Path,
    title: &str,
    target_language: &str,
    audio: &[u8],
) -> Result<TaskStart, Error> {
    validate_language(target_language)?;
    let title = title.trim();
    if title.is_empty() || title.encode_utf16().count() > 300 {
        return Err(invalid("A short recording title is required"));
    }
    if audio.len() > MAX_SOURCE_AUDIO_BYTES {
        return Err(invalid("Source audio exceeds the bounded prototype limit"));
    }
    let pcm = parse_wav(audio)?;
    let duration_ms = pcm.duration_ms();
    if duration_ms < 2 {
        return Err(invalid("Source audio has no measurable duration"));
    }
    let audio_sha256 = sha256(audio);
    let (audio_path, _) = write_artifact_as(vault, audio, "wav", MAX_SOURCE_AUDIO_BYTES)?;
    let session_id = format!("dialext-generated-{}", uuid::Uuid::new_v4());
    let task_id = uuid::Uuid::new_v4().to_string();
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
    sqlx::query(
        "INSERT INTO sessions(id,workspace_id,owner_user_id,title,language,metadata_json)
         VALUES(?,'dialext-local',?,?,?,?)",
    )
    .bind(&session_id)
    .bind(DEFAULT_USER_ID)
    .bind(title)
    .bind(target_language)
    .bind(json!({"dialext":{"provider_bridge":1,"provider":"fixture"}}).to_string())
    .execute(&mut *tx)
    .await?;
    sqlx::query("INSERT INTO dialext_recordings(id,preferred_language) VALUES(?,?)")
        .bind(&session_id)
        .bind(target_language)
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        "INSERT INTO dialext_evidence(id,session_id,kind,source_id,revision,sha256,artifact_path,duration_ms)
         VALUES(?,?,'audio',?,1,?,?,?)",
    )
    .bind(format!("{session_id}:{SOURCE_AUDIO_ID}:1"))
    .bind(&session_id)
    .bind(SOURCE_AUDIO_ID)
    .bind(&audio_sha256)
    .bind(audio_path)
    .bind(duration_ms)
    .execute(&mut *tx)
    .await?;
    insert_task(
        &mut tx,
        &task_id,
        &session_id,
        target_language,
        &audio_sha256,
        1,
        1,
    )
    .await?;
    tx.commit().await?;
    Ok(TaskStart {
        task_id,
        session_id,
    })
}

pub async fn create_alternate_task(
    pool: &SqlitePool,
    session_id: &str,
    target_language: &str,
) -> Result<TaskStart, Error> {
    validate_language(target_language)?;
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
    let Some((audio_sha256, input_revision)) = sqlx::query_as::<_, (String, i64)>(
        "SELECT e.sha256,e.revision FROM dialext_recordings r
         JOIN sessions s ON s.id=r.id AND s.deleted_at IS NULL
         JOIN dialext_evidence e ON e.session_id=r.id AND e.kind='audio' AND e.source_id=?
         WHERE r.id=?",
    )
    .bind(SOURCE_AUDIO_ID)
    .bind(session_id)
    .fetch_optional(&mut *tx)
    .await?
    else {
        return Err(invalid("This recording has no source audio for generation"));
    };
    if sqlx::query_scalar::<_, i64>(
        "SELECT count(*) FROM dialext_accounts WHERE session_id=? AND target_language=?",
    )
    .bind(session_id)
    .bind(target_language)
    .fetch_one(&mut *tx)
    .await?
        != 0
    {
        return Err(invalid("This reading has already been generated"));
    }
    let attempt: i64 = sqlx::query_scalar(
        "SELECT COALESCE(max(attempt),0)+1 FROM dialext_provider_tasks
         WHERE session_id=? AND target_language=?",
    )
    .bind(session_id)
    .bind(target_language)
    .fetch_one(&mut *tx)
    .await?;
    let task_id = uuid::Uuid::new_v4().to_string();
    insert_task(
        &mut tx,
        &task_id,
        session_id,
        target_language,
        &audio_sha256,
        input_revision,
        attempt,
    )
    .await?;
    tx.commit().await?;
    Ok(TaskStart {
        task_id,
        session_id: session_id.to_string(),
    })
}

async fn insert_task(
    connection: &mut SqliteConnection,
    task_id: &str,
    session_id: &str,
    target_language: &str,
    audio_sha256: &str,
    input_revision: i64,
    attempt: i64,
) -> Result<(), Error> {
    sqlx::query(
        "INSERT INTO dialext_provider_tasks(
            id,session_id,target_language,provider,asr_model,reconstruction_model,
            prompt_version,audio_sha256,input_revision,attempt)
         VALUES(?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(task_id)
    .bind(session_id)
    .bind(target_language)
    .bind(PROVIDER)
    .bind(ASR_MODEL)
    .bind(RECONSTRUCTION_MODEL)
    .bind(PROMPT_VERSION)
    .bind(audio_sha256)
    .bind(input_revision)
    .bind(attempt)
    .execute(connection)
    .await?;
    Ok(())
}

pub async fn cancel_task(pool: &SqlitePool, task_id: &str) -> Result<(), Error> {
    sqlx::query(
        "UPDATE dialext_provider_tasks SET
           status=CASE status WHEN 'queued' THEN 'cancelled' ELSE 'cancel_requested' END,
           error='', completed_at=CASE status WHEN 'queued' THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE completed_at END,
           updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id=? AND status IN ('queued','running')",
    )
    .bind(task_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn recover_interrupted_tasks(pool: &SqlitePool) -> Result<u64, Error> {
    Ok(sqlx::query(
        "UPDATE dialext_provider_tasks SET
           status=CASE status WHEN 'cancel_requested' THEN 'cancelled' ELSE 'interrupted' END,
           error=CASE status WHEN 'cancel_requested' THEN '' ELSE 'The app stopped before this task finished.' END,
           completed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),
           updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE status IN ('queued','running','cancel_requested')",
    )
    .execute(pool)
    .await?
    .rows_affected())
}

async fn load_task(pool: &SqlitePool, task_id: &str) -> Result<Task, Error> {
    let row = sqlx::query_as::<_, (String, String, String, String, i64, i64)>(
        "SELECT id,session_id,target_language,audio_sha256,input_revision,attempt
         FROM dialext_provider_tasks WHERE id=?",
    )
    .bind(task_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| invalid("Dialext provider task not found"))?;
    Ok(Task {
        id: row.0,
        session_id: row.1,
        target_language: row.2,
        audio_sha256: row.3,
        input_revision: row.4,
        attempt: row.5,
    })
}

async fn claim_task(pool: &SqlitePool, task: &Task) -> Result<bool, Error> {
    Ok(sqlx::query(
        "UPDATE dialext_provider_tasks SET status='running',current_stage='asr_ga',error='',
           updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id=? AND attempt=? AND input_revision=? AND status='queued'",
    )
    .bind(&task.id)
    .bind(task.attempt)
    .bind(task.input_revision)
    .execute(pool)
    .await?
    .rows_affected()
        == 1)
}

async fn fenced_running(connection: &mut SqliteConnection, task: &Task) -> Result<bool, Error> {
    Ok(sqlx::query_scalar::<_, i64>(
        "SELECT count(*) FROM dialext_provider_tasks
         WHERE id=? AND attempt=? AND input_revision=? AND audio_sha256=? AND status='running'",
    )
    .bind(&task.id)
    .bind(task.attempt)
    .bind(task.input_revision)
    .bind(&task.audio_sha256)
    .fetch_one(connection)
    .await?
        == 1)
}

async fn advance(pool: &SqlitePool, task: &Task, stage: &str) -> Result<bool, Error> {
    let changed = sqlx::query(
        "UPDATE dialext_provider_tasks SET current_stage=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id=? AND attempt=? AND input_revision=? AND audio_sha256=? AND status='running'",
    )
    .bind(stage)
    .bind(&task.id)
    .bind(task.attempt)
    .bind(task.input_revision)
    .bind(&task.audio_sha256)
    .execute(pool)
    .await?
    .rows_affected();
    if changed == 1 {
        return Ok(true);
    }
    sqlx::query(
        "UPDATE dialext_provider_tasks SET status='cancelled',error='',completed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id=? AND attempt=? AND input_revision=? AND status='cancel_requested'",
    )
    .bind(&task.id)
    .bind(task.attempt)
    .bind(task.input_revision)
    .execute(pool)
    .await?;
    Ok(false)
}

async fn read_limited<R: tokio::io::AsyncRead + Unpin>(
    reader: R,
    limit: usize,
) -> std::io::Result<Vec<u8>> {
    let mut bytes = Vec::new();
    reader
        .take((limit + 1) as u64)
        .read_to_end(&mut bytes)
        .await?;
    Ok(bytes)
}

async fn wait_until_task_stops(pool: &SqlitePool, task: &Task) -> Result<(), Error> {
    loop {
        let status = sqlx::query_scalar::<_, String>(
            "SELECT status FROM dialext_provider_tasks
             WHERE id=? AND attempt=? AND input_revision=? AND audio_sha256=?",
        )
        .bind(&task.id)
        .bind(task.attempt)
        .bind(task.input_revision)
        .bind(&task.audio_sha256)
        .fetch_optional(pool)
        .await?;
        if status.as_deref() != Some("running") {
            return Ok(());
        }
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }
}

async fn invoke_helper(
    pool: &SqlitePool,
    task: &Task,
    helper_path: &Path,
    stage: &str,
    request: Value,
) -> Result<Value, Error> {
    let input = serde_json::to_vec(&json!({
        "protocol_version": PROTOCOL_VERSION,
        "stage": stage,
        "provider": PROVIDER,
        "request": request,
    }))?;
    if input.len() > MAX_PROTOCOL_BYTES {
        return Err(invalid("Provider protocol input exceeds 2 MiB"));
    }
    let mut child = tokio::process::Command::new("node")
        .arg(helper_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| invalid("Provider stdin unavailable"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| invalid("Provider stdout unavailable"))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| invalid("Provider stderr unavailable"))?;
    let stdout_task = tokio::spawn(read_limited(stdout, MAX_PROTOCOL_BYTES));
    let stderr_task = tokio::spawn(read_limited(stderr, 32 * 1024));
    stdin.write_all(&input).await?;
    drop(stdin);
    let (status, stopped) = tokio::select! {
        status = child.wait() => (status?, false),
        result = wait_until_task_stops(pool, task) => {
            result?;
            child.start_kill()?;
            (child.wait().await?, true)
        }
    };
    let stdout = stdout_task
        .await
        .map_err(|_| invalid("Provider output reader stopped"))??;
    let stderr = stderr_task
        .await
        .map_err(|_| invalid("Provider diagnostic reader stopped"))??;
    if stdout.len() > MAX_PROTOCOL_BYTES {
        return Err(invalid("Provider protocol output exceeds 2 MiB"));
    }
    if stopped {
        return Err(invalid("Provider task stopped"));
    }
    if !status.success() {
        let diagnostic = String::from_utf8_lossy(&stderr);
        return Err(invalid(&format!(
            "Provider helper failed: {}",
            diagnostic.trim().chars().take(500).collect::<String>()
        )));
    }
    let response: HelperResponse = serde_json::from_slice(&stdout)?;
    if response.protocol_version != PROTOCOL_VERSION || response.stage != stage {
        return Err(invalid(
            "Provider helper returned an unsupported protocol message",
        ));
    }
    Ok(response.result)
}

fn validate_source(value: &Value, expected_source: &str, duration_ms: i64) -> Result<(), Error> {
    if value["source_id"] != expected_source
        || (!value["provider"].is_null() && value["provider"] != PROVIDER)
    {
        return Err(invalid("Provider ASR source identity is invalid"));
    }
    let segments = value["segments"]
        .as_array()
        .filter(|segments| !segments.is_empty() && segments.len() <= 2000)
        .ok_or_else(|| invalid("Provider ASR result has no bounded segments"))?;
    let mut previous = -1;
    for segment in segments {
        let start = segment["start_ms"]
            .as_i64()
            .ok_or_else(|| invalid("Provider ASR segment has no start"))?;
        let end = segment["end_ms"]
            .as_i64()
            .ok_or_else(|| invalid("Provider ASR segment has no end"))?;
        let text = segment["text"].as_str().unwrap_or("").trim();
        if start < previous
            || start < 0
            || end <= start
            || end > duration_ms
            || text.is_empty()
            || text.encode_utf16().count() > 4000
        {
            return Err(invalid("Provider ASR segment is invalid"));
        }
        previous = end;
    }
    Ok(())
}

fn source_segments(sources: &[Value]) -> Result<SourceIndex, Error> {
    let mut result = BTreeMap::new();
    for source in sources {
        let source_id = source["source_id"]
            .as_str()
            .ok_or_else(|| invalid("ASR source identity is missing"))?;
        for segment in source["segments"]
            .as_array()
            .ok_or_else(|| invalid("ASR source segments are missing"))?
        {
            let start = segment["start_ms"].as_i64().unwrap_or(-1);
            let end = segment["end_ms"].as_i64().unwrap_or(-1);
            let speaker = segment["speaker"].as_str().map(str::to_string);
            if result
                .insert((source_id.to_string(), start, end), speaker)
                .is_some()
            {
                return Err(invalid("ASR source intervals are ambiguous"));
            }
        }
    }
    Ok(result)
}

fn validate_account(result: &Value, sources: &[Value], target_language: &str) -> Result<(), Error> {
    let segments = result
        .as_array()
        .filter(|segments| !segments.is_empty() && segments.len() <= 2000)
        .ok_or_else(|| invalid("Provider reconstruction has no bounded passages"))?;
    let evidence = source_segments(sources)?;
    let expected_language = if target_language == "ga" {
        "irish"
    } else {
        "english"
    };
    let mut previous = -1;
    for segment in segments {
        let start = segment["start_ms"].as_i64().unwrap_or(-1);
        let end = segment["end_ms"].as_i64().unwrap_or(-1);
        let text = segment["text"].as_str().unwrap_or("").trim();
        if segment["language"] != expected_language
            || start < previous
            || start < 0
            || end <= start
            || text.is_empty()
            || text.encode_utf16().count() > 4000
        {
            return Err(invalid("Provider reconstruction passage is invalid"));
        }
        previous = end;
        let anchors = segment["anchors"]
            .as_array()
            .filter(|anchors| !anchors.is_empty() && anchors.len() <= 8)
            .ok_or_else(|| invalid("Provider reconstruction passage is unanchored"))?;
        let mut first = i64::MAX;
        let mut last = -1;
        for anchor in anchors {
            let source = anchor["source_id"].as_str().unwrap_or("");
            let anchor_start = anchor["start_ms"].as_i64().unwrap_or(-1);
            let anchor_end = anchor["end_ms"].as_i64().unwrap_or(-1);
            let Some(source_speaker) =
                evidence.get(&(source.to_string(), anchor_start, anchor_end))
            else {
                return Err(invalid(
                    "Provider reconstruction anchor does not exactly resolve",
                ));
            };
            if let (Some(passage_speaker), Some(source_speaker)) =
                (segment["speaker"].as_str(), source_speaker.as_deref())
                && passage_speaker != source_speaker
            {
                return Err(invalid(
                    "Provider reconstruction speaker contradicts its evidence",
                ));
            }
            first = first.min(anchor_start);
            last = last.max(anchor_end);
        }
        if first != start || last != end {
            return Err(invalid(
                "Provider reconstruction interval disagrees with its anchors",
            ));
        }
    }
    Ok(())
}

async fn task_audio(pool: &SqlitePool, vault: &Path, task: &Task) -> Result<(String, i64), Error> {
    let Some((path, digest, duration)) = sqlx::query_as::<_, (String, String, i64)>(
        "SELECT artifact_path,sha256,duration_ms FROM dialext_evidence
         WHERE session_id=? AND kind='audio' AND source_id=? AND revision=?",
    )
    .bind(&task.session_id)
    .bind(SOURCE_AUDIO_ID)
    .bind(task.input_revision)
    .fetch_optional(pool)
    .await?
    else {
        return Err(invalid("Task source audio is unavailable"));
    };
    if digest != task.audio_sha256 {
        return Err(invalid("Task source audio revision changed"));
    }
    read_artifact(vault, &path, &digest)?;
    Ok((path, duration))
}

async fn load_stage(
    pool: &SqlitePool,
    vault: &Path,
    session_id: &str,
    key: &str,
) -> Result<Option<Stage>, Error> {
    let Some((digest, path)) = sqlx::query_as::<_, (String, String)>(
        "SELECT result_sha256,result_artifact_path FROM dialext_provider_stages
         WHERE session_id=? AND request_key=?",
    )
    .bind(session_id)
    .bind(key)
    .fetch_optional(pool)
    .await?
    else {
        return Ok(None);
    };
    let bytes = read_artifact(vault, &path, &digest)?;
    Ok(Some(Stage {
        result: serde_json::from_slice(&bytes)?,
        result_sha256: digest,
    }))
}

async fn persist_stage(
    pool: &SqlitePool,
    vault: &Path,
    task: &Task,
    spec: StageSpec<'_>,
    result: &Value,
) -> Result<Option<Stage>, Error> {
    let bytes = artifact(result.clone())?;
    let (path, digest) = write_artifact(vault, &bytes)?;
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
    if !fenced_running(&mut tx, task).await? {
        return Ok(None);
    }
    if let Some((source_id, duration_ms)) = spec.evidence {
        sqlx::query(
            "INSERT OR IGNORE INTO dialext_evidence(
               id,session_id,kind,source_id,revision,sha256,artifact_path,duration_ms)
             VALUES(?,?,'asr',?,1,?,?,?)",
        )
        .bind(format!("{}:{source_id}:1", task.session_id))
        .bind(&task.session_id)
        .bind(source_id)
        .bind(&digest)
        .bind(&path)
        .bind(duration_ms)
        .execute(&mut *tx)
        .await?;
        let stored: String = sqlx::query_scalar(
            "SELECT sha256 FROM dialext_evidence WHERE session_id=? AND source_id=? AND revision=1",
        )
        .bind(&task.session_id)
        .bind(source_id)
        .fetch_one(&mut *tx)
        .await?;
        if stored != digest {
            return Err(invalid("A different immutable ASR result already exists"));
        }
    }
    sqlx::query(
        "INSERT OR IGNORE INTO dialext_provider_stages(
           id,session_id,created_by_task_id,task_attempt,input_revision,kind,source_locale,
           target_language,provider,model,prompt_version,request_key,result_sha256,result_artifact_path)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&task.session_id)
    .bind(&task.id)
    .bind(task.attempt)
    .bind(task.input_revision)
    .bind(spec.kind)
    .bind(spec.source_locale)
    .bind(spec.target_language)
    .bind(PROVIDER)
    .bind(spec.model)
    .bind(spec.prompt_version)
    .bind(spec.request_key)
    .bind(&digest)
    .bind(&path)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    load_stage(pool, vault, &task.session_id, spec.request_key).await
}

async fn stored_source(
    pool: &SqlitePool,
    vault: &Path,
    task: &Task,
    source_id: &str,
) -> Result<Option<Stage>, Error> {
    let Some((digest, path, duration)) = sqlx::query_as::<_, (String, String, i64)>(
        "SELECT sha256,artifact_path,duration_ms FROM dialext_evidence
         WHERE session_id=? AND kind='asr' AND source_id=? AND revision=1",
    )
    .bind(&task.session_id)
    .bind(source_id)
    .fetch_optional(pool)
    .await?
    else {
        return Ok(None);
    };
    let bytes = read_artifact(vault, &path, &digest)?;
    let wrapper: Value = serde_json::from_slice(&bytes)?;
    let source = wrapper.get("source").cloned().unwrap_or(wrapper);
    validate_source(&source, source_id, duration)?;
    Ok(Some(Stage {
        result: source,
        result_sha256: digest,
    }))
}

async fn asr_stage(
    pool: &SqlitePool,
    vault: &Path,
    helper_path: &Path,
    task: &Task,
    spec: AsrSpec<'_>,
) -> Result<Option<Stage>, Error> {
    if let Some(source) = stored_source(pool, vault, task, spec.source_id).await? {
        return Ok(Some(source));
    }
    let key = request_key(json!({
        "audio_sha256":task.audio_sha256,"source_locale":spec.source_locale,
        "provider":PROVIDER,"model":ASR_MODEL
    }))?;
    if let Some(stage) = load_stage(pool, vault, &task.session_id, &key).await? {
        validate_source(&stage.result, spec.source_id, spec.duration_ms)?;
        return Ok(Some(stage));
    }
    let result = invoke_helper(
        pool,
        task,
        helper_path,
        "asr",
        json!({
            "source_locale":spec.source_locale,"model":ASR_MODEL,
            "audio_path":vault.join(spec.audio_path),"audio_sha256":task.audio_sha256,
            "duration_ms":spec.duration_ms
        }),
    )
    .await?;
    validate_source(&result, spec.source_id, spec.duration_ms)?;
    let wrapped = json!({"format":"dialext-asr-evidence","version":1,"source":result});
    let stage = persist_stage(
        pool,
        vault,
        task,
        StageSpec {
            kind: "asr",
            source_locale: spec.source_locale,
            target_language: "",
            model: ASR_MODEL,
            prompt_version: "",
            request_key: &key,
            evidence: Some((spec.source_id, spec.duration_ms)),
        },
        &wrapped,
    )
    .await?;
    Ok(stage.map(|mut stage| {
        stage.result = stage.result["source"].clone();
        stage
    }))
}

async fn store_account(
    pool: &SqlitePool,
    vault: &Path,
    task: &Task,
    sources: &[Stage],
    account: &Value,
) -> Result<bool, Error> {
    let evidence: Vec<Value> = sources
        .iter()
        .map(|source| {
            let id = source.result["source_id"].as_str().unwrap_or("");
            json!({"source_id":id,"revision":1,"sha256":source.result_sha256})
        })
        .collect();
    let evidence_digest = sha256(&artifact(json!({
        "format":"dialext-evidence-set","version":1,"sources":evidence
    }))?);
    let original = json!({
        "format":"dialext-account-original","version":1,
        "target_language":task.target_language,"evidence":evidence,
        "account":{"segments":account}
    });
    let (original_path, original_sha256) = write_artifact(vault, &artifact(original)?)?;
    let segments = account
        .as_array()
        .ok_or_else(|| invalid("Provider account is not a list of passages"))?;
    let words: Vec<Value> = segments
        .iter()
        .enumerate()
        .map(|(index, segment)| {
            json!({
                "id":format!("{}:{}:passage:{index}",task.session_id,task.target_language),
                "text":segment["text"],"start_ms":segment["start_ms"],"end_ms":segment["end_ms"],"channel":0,
                "metadata":{"timing":{"source":"synthetic_text"},"dialext":{
                    "anchors":segment["anchors"],"source_speaker":segment["speaker"],
                    "target_language":task.target_language,
                    "spoken_language":segment.get("spoken_language").cloned().unwrap_or(json!("unknown")),
                    "timing":"passage"
                }}
            })
        })
        .collect();
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
    if !fenced_running(&mut tx, task).await? {
        return Ok(false);
    }
    if sqlx::query_scalar::<_, i64>(
        "SELECT count(*) FROM dialext_accounts WHERE session_id=? AND target_language=?",
    )
    .bind(&task.session_id)
    .bind(&task.target_language)
    .fetch_one(&mut *tx)
    .await?
        != 0
    {
        return Err(invalid("This reading was generated by another task"));
    }
    let generation: i64 = sqlx::query_scalar(
        "SELECT COALESCE(max(generation),0)+1 FROM dialext_accounts WHERE session_id=? AND target_language=?",
    )
    .bind(&task.session_id)
    .bind(&task.target_language)
    .fetch_one(&mut *tx)
    .await?;
    let account_id = format!(
        "{}:account:{}:{generation}",
        task.session_id, task.target_language
    );
    let transcript_id = format!(
        "{}:reading:{}:{generation}",
        task.session_id, task.target_language
    );
    let (workspace, owner): (String, String) = sqlx::query_as(
        "SELECT workspace_id,owner_user_id FROM sessions WHERE id=? AND deleted_at IS NULL",
    )
    .bind(&task.session_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| invalid("The recording was deleted before generation finished"))?;
    sqlx::query(
        "INSERT INTO transcripts(id,workspace_id,owner_user_id,session_id,source,provider,model,language,
           started_at_ms,ended_at_ms,words_json,speaker_hints_json,metadata_json)
         VALUES(?,?,?,?,'dialext','fixture',?,?,0,?,?,'[]',?)",
    )
    .bind(&transcript_id)
    .bind(workspace)
    .bind(owner)
    .bind(&task.session_id)
    .bind(RECONSTRUCTION_MODEL)
    .bind(&task.target_language)
    .bind(segments.last().and_then(|segment| segment["end_ms"].as_i64()))
    .bind(serde_json::to_string(&words)?)
    .bind(json!({"dialext":{"kind":"readable_account","target_language":task.target_language,"provider":"fixture"}}).to_string())
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO dialext_accounts(id,session_id,transcript_id,target_language,generation,
           input_evidence_digest,original_artifact_path,original_sha256)
         VALUES(?,?,?,?,?,?,?,?)",
    )
    .bind(&account_id)
    .bind(&task.session_id)
    .bind(&transcript_id)
    .bind(&task.target_language)
    .bind(generation)
    .bind(evidence_digest)
    .bind(original_path)
    .bind(original_sha256)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "UPDATE dialext_recordings SET active_account_id=?,preferred_language=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
    )
    .bind(account_id)
    .bind(&task.target_language)
    .bind(&task.session_id)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "UPDATE dialext_provider_tasks SET status='succeeded',current_stage='done',error='',
           completed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id=? AND attempt=? AND input_revision=? AND status='running'",
    )
    .bind(&task.id)
    .bind(task.attempt)
    .bind(task.input_revision)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(true)
}

async fn run_inner(
    pool: &SqlitePool,
    vault: &Path,
    helper_path: &Path,
    task: &Task,
) -> Result<(), Error> {
    let (audio_path, duration_ms) = task_audio(pool, vault, task).await?;
    let mut sources = Vec::new();
    for (stage_name, locale, source_id) in [
        ("asr_ga", "ga-IE", "irish-asr"),
        ("asr_en", "en-IE", "english-asr"),
    ] {
        if !advance(pool, task, stage_name).await? {
            return Ok(());
        }
        let Some(stage) = asr_stage(
            pool,
            vault,
            helper_path,
            task,
            AsrSpec {
                source_locale: locale,
                source_id,
                audio_path: &audio_path,
                duration_ms,
            },
        )
        .await?
        else {
            advance(pool, task, "done").await?;
            return Ok(());
        };
        sources.push(stage);
    }
    if !advance(pool, task, "reconstruct").await? {
        return Ok(());
    }
    let key = request_key(json!({
        "evidence":sources.iter().map(|source| &source.result_sha256).collect::<Vec<_>>(),
        "provider":PROVIDER,"model":RECONSTRUCTION_MODEL,
        "prompt_version":PROMPT_VERSION,"target_language":task.target_language
    }))?;
    let account = if let Some(stage) = load_stage(pool, vault, &task.session_id, &key).await? {
        stage.result
    } else {
        let source_values: Vec<Value> =
            sources.iter().map(|source| source.result.clone()).collect();
        let result = invoke_helper(
            pool,
            task,
            helper_path,
            "reconstruct",
            json!({
                "target_language":task.target_language,"model":RECONSTRUCTION_MODEL,
                "prompt_version":PROMPT_VERSION,"transcript":{"sources":source_values}
            }),
        )
        .await?;
        validate_account(&result, &source_values, &task.target_language)?;
        let Some(stage) = persist_stage(
            pool,
            vault,
            task,
            StageSpec {
                kind: "reconstruction",
                source_locale: "",
                target_language: &task.target_language,
                model: RECONSTRUCTION_MODEL,
                prompt_version: PROMPT_VERSION,
                request_key: &key,
                evidence: None,
            },
            &result,
        )
        .await?
        else {
            return Ok(());
        };
        stage.result
    };
    let source_values: Vec<Value> = sources.iter().map(|source| source.result.clone()).collect();
    validate_account(&account, &source_values, &task.target_language)?;
    if advance(pool, task, "store").await? {
        store_account(pool, vault, task, &sources, &account).await?;
    }
    Ok(())
}

pub async fn run_task(
    pool: &SqlitePool,
    vault: &Path,
    helper_path: &Path,
    task_id: &str,
) -> Result<(), Error> {
    let task = load_task(pool, task_id).await?;
    if !claim_task(pool, &task).await? {
        return Ok(());
    }
    if let Err(error) = run_inner(pool, vault, helper_path, &task).await {
        let message = error.to_string();
        let settled = sqlx::query_scalar::<_, String>(
            "UPDATE dialext_provider_tasks SET
               status=CASE status WHEN 'cancel_requested' THEN 'cancelled' ELSE 'failed' END,
               error=CASE status WHEN 'cancel_requested' THEN '' ELSE ? END,
               completed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
             WHERE id=? AND attempt=? AND input_revision=? AND status IN ('running','cancel_requested')
             RETURNING status",
        )
        .bind(message)
        .bind(&task.id)
        .bind(task.attempt)
        .bind(task.input_revision)
        .fetch_optional(pool)
        .await?;
        if settled.as_deref() == Some("cancelled") {
            return Ok(());
        }
        return Err(error);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn database() -> anlg_db_core::Db {
        let db = anlg_db_core::Db::connect_memory_plain().await.unwrap();
        anlg_db_app::prepare_schema(&db).await.unwrap();
        db
    }

    fn helper() -> std::path::PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../dialext/engine/provider-helper.mjs")
    }

    fn slow_helper(directory: &Path) -> std::path::PathBuf {
        let path = directory.join("slow-provider.mjs");
        std::fs::write(
            &path,
            "process.stdin.resume(); setInterval(() => {}, 1_000);",
        )
        .unwrap();
        path
    }

    fn wav(duration_ms: usize) -> Vec<u8> {
        let sample_rate = 8_000usize;
        let samples = sample_rate * duration_ms / 1_000;
        let mut bytes = vec![0; 44 + samples * 2];
        bytes[0..4].copy_from_slice(b"RIFF");
        bytes[4..8].copy_from_slice(&(36 + samples as u32 * 2).to_le_bytes());
        bytes[8..16].copy_from_slice(b"WAVEfmt ");
        bytes[16..20].copy_from_slice(&16u32.to_le_bytes());
        bytes[20..22].copy_from_slice(&1u16.to_le_bytes());
        bytes[22..24].copy_from_slice(&1u16.to_le_bytes());
        bytes[24..28].copy_from_slice(&(sample_rate as u32).to_le_bytes());
        bytes[28..32].copy_from_slice(&(sample_rate as u32 * 2).to_le_bytes());
        bytes[32..34].copy_from_slice(&2u16.to_le_bytes());
        bytes[34..36].copy_from_slice(&16u16.to_le_bytes());
        bytes[36..40].copy_from_slice(b"data");
        bytes[40..44].copy_from_slice(&(samples as u32 * 2).to_le_bytes());
        bytes
    }

    async fn status(pool: &SqlitePool, id: &str) -> (String, String) {
        sqlx::query_as("SELECT status,current_stage FROM dialext_provider_tasks WHERE id=?")
            .bind(id)
            .fetch_one(pool)
            .await
            .unwrap()
    }

    #[tokio::test]
    async fn preferred_then_alternate_generation_reuses_both_asr_stages() {
        let db = database().await;
        let vault = tempfile::tempdir().unwrap();
        let first = create_recording_task(db.pool(), vault.path(), "Fixture", "en", &wav(1_000))
            .await
            .unwrap();
        run_task(db.pool(), vault.path(), &helper(), &first.task_id)
            .await
            .unwrap();
        assert_eq!(
            status(db.pool(), &first.task_id).await,
            ("succeeded".into(), "done".into())
        );
        assert_eq!(
            sqlx::query_scalar::<_, i64>(
                "SELECT count(*) FROM dialext_provider_stages WHERE kind='asr'"
            )
            .fetch_one(db.pool())
            .await
            .unwrap(),
            2
        );

        let alternate = create_alternate_task(db.pool(), &first.session_id, "ga")
            .await
            .unwrap();
        run_task(db.pool(), vault.path(), &helper(), &alternate.task_id)
            .await
            .unwrap();

        assert_eq!(
            sqlx::query_scalar::<_, i64>(
                "SELECT count(*) FROM dialext_provider_stages WHERE kind='asr'"
            )
            .fetch_one(db.pool())
            .await
            .unwrap(),
            2,
            "an alternate reconstruction must not rerun successful ASR"
        );
        let languages: Vec<String> = sqlx::query_scalar(
            "SELECT target_language FROM dialext_accounts WHERE session_id=? ORDER BY target_language",
        )
        .bind(&first.session_id)
        .fetch_all(db.pool())
        .await
        .unwrap();
        assert_eq!(languages, ["en", "ga"]);
    }

    #[tokio::test]
    async fn cancellation_stops_an_in_flight_helper() {
        let db = database().await;
        let vault = tempfile::tempdir().unwrap();
        let helper_directory = tempfile::tempdir().unwrap();
        let started =
            create_recording_task(db.pool(), vault.path(), "Cancel helper", "en", &wav(1_000))
                .await
                .unwrap();
        let pool = db.pool().clone();
        let vault_path = vault.path().to_path_buf();
        let helper_path = slow_helper(helper_directory.path());
        let task_id = started.task_id.clone();
        let worker =
            tokio::spawn(async move { run_task(&pool, &vault_path, &helper_path, &task_id).await });
        for _ in 0..100 {
            if status(db.pool(), &started.task_id).await.0 == "running" {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
        assert_eq!(status(db.pool(), &started.task_id).await.0, "running");
        cancel_task(db.pool(), &started.task_id).await.unwrap();
        tokio::time::timeout(std::time::Duration::from_secs(2), worker)
            .await
            .expect("cancelled helper did not stop")
            .unwrap()
            .unwrap();
        assert_eq!(status(db.pool(), &started.task_id).await.0, "cancelled");
        assert_eq!(
            sqlx::query_scalar::<_, i64>("SELECT count(*) FROM dialext_provider_stages")
                .fetch_one(db.pool())
                .await
                .unwrap(),
            0
        );
    }

    #[tokio::test]
    async fn cancellation_and_restart_fence_late_work_but_keep_finished_asr() {
        let db = database().await;
        let vault = tempfile::tempdir().unwrap();
        let started = create_recording_task(db.pool(), vault.path(), "Cancel", "en", &wav(1_000))
            .await
            .unwrap();
        let task = load_task(db.pool(), &started.task_id).await.unwrap();
        assert!(claim_task(db.pool(), &task).await.unwrap());
        let (audio_path, duration) = task_audio(db.pool(), vault.path(), &task).await.unwrap();
        assert!(
            asr_stage(
                db.pool(),
                vault.path(),
                &helper(),
                &task,
                AsrSpec {
                    source_locale: "ga-IE",
                    source_id: "irish-asr",
                    audio_path: &audio_path,
                    duration_ms: duration,
                },
            )
            .await
            .unwrap()
            .is_some()
        );
        cancel_task(db.pool(), &task.id).await.unwrap();
        assert!(!advance(db.pool(), &task, "asr_en").await.unwrap());
        assert_eq!(status(db.pool(), &task.id).await.0, "cancelled");
        assert_eq!(
            sqlx::query_scalar::<_, i64>("SELECT count(*) FROM dialext_evidence WHERE kind='asr'")
                .fetch_one(db.pool())
                .await
                .unwrap(),
            1
        );

        let restarted = create_alternate_task(db.pool(), &task.session_id, "en")
            .await
            .unwrap();
        let restarted_task = load_task(db.pool(), &restarted.task_id).await.unwrap();
        assert!(claim_task(db.pool(), &restarted_task).await.unwrap());
        assert!(
            asr_stage(
                db.pool(),
                vault.path(),
                &helper(),
                &restarted_task,
                AsrSpec {
                    source_locale: "ga-IE",
                    source_id: "irish-asr",
                    audio_path: &audio_path,
                    duration_ms: duration,
                },
            )
            .await
            .unwrap()
            .is_some()
        );
        assert_eq!(
            sqlx::query_scalar::<_, i64>("SELECT count(*) FROM dialext_evidence WHERE kind='asr'")
                .fetch_one(db.pool())
                .await
                .unwrap(),
            1,
            "the successful pre-cancel stage is reused"
        );
        assert_eq!(recover_interrupted_tasks(db.pool()).await.unwrap(), 1);
        assert_eq!(status(db.pool(), &restarted.task_id).await.0, "interrupted");
    }

    #[tokio::test]
    async fn failed_reconstruction_retry_does_not_repeat_successful_asr() {
        let db = database().await;
        let vault = tempfile::tempdir().unwrap();
        let started = create_recording_task(db.pool(), vault.path(), "Retry", "en", &wav(1_000))
            .await
            .unwrap();
        let task = load_task(db.pool(), &started.task_id).await.unwrap();
        assert!(claim_task(db.pool(), &task).await.unwrap());
        let (audio_path, duration) = task_audio(db.pool(), vault.path(), &task).await.unwrap();
        for (locale, source) in [("ga-IE", "irish-asr"), ("en-IE", "english-asr")] {
            asr_stage(
                db.pool(),
                vault.path(),
                &helper(),
                &task,
                AsrSpec {
                    source_locale: locale,
                    source_id: source,
                    audio_path: &audio_path,
                    duration_ms: duration,
                },
            )
            .await
            .unwrap();
        }
        sqlx::query("UPDATE dialext_provider_tasks SET status='queued' WHERE id=?")
            .bind(&task.id)
            .execute(db.pool())
            .await
            .unwrap();
        assert!(
            run_task(
                db.pool(),
                vault.path(),
                Path::new("/missing/helper.mjs"),
                &task.id
            )
            .await
            .is_err()
        );
        assert_eq!(status(db.pool(), &task.id).await.0, "failed");

        let retry = create_alternate_task(db.pool(), &task.session_id, "en")
            .await
            .unwrap();
        run_task(db.pool(), vault.path(), &helper(), &retry.task_id)
            .await
            .unwrap();
        assert_eq!(status(db.pool(), &retry.task_id).await.0, "succeeded");
        assert_eq!(
            sqlx::query_scalar::<_, i64>(
                "SELECT count(*) FROM dialext_provider_stages WHERE kind='asr'"
            )
            .fetch_one(db.pool())
            .await
            .unwrap(),
            2
        );
    }
}
