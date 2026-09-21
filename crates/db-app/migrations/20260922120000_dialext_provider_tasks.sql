-- Durable personal provider queue and immutable successful stage cache.
CREATE TABLE dialext_provider_tasks (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL DEFAULT '',
  target_language TEXT NOT NULL DEFAULT 'en' CHECK(target_language IN ('en', 'ga')),
  provider TEXT NOT NULL DEFAULT 'fixture' CHECK(provider = 'fixture'),
  asr_model TEXT NOT NULL DEFAULT 'fixture-asr-v1',
  reconstruction_model TEXT NOT NULL DEFAULT 'fixture-reconstruction-v1',
  prompt_version TEXT NOT NULL DEFAULT 'fixture-reconstruction-prompt-v1',
  audio_sha256 TEXT NOT NULL DEFAULT '' CHECK(length(audio_sha256) = 64),
  input_revision INTEGER NOT NULL DEFAULT 1 CHECK(input_revision > 0),
  attempt INTEGER NOT NULL DEFAULT 1 CHECK(attempt > 0),
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN (
    'queued', 'running', 'cancel_requested', 'cancelled', 'failed', 'interrupted', 'succeeded'
  )),
  current_stage TEXT NOT NULL DEFAULT 'queued' CHECK(current_stage IN (
    'queued', 'asr_ga', 'asr_en', 'reconstruct', 'store', 'done'
  )),
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_at TEXT,
  UNIQUE(session_id, target_language, attempt),
  FOREIGN KEY(session_id) REFERENCES sessions(id)
) STRICT;

CREATE UNIQUE INDEX idx_dialext_provider_tasks_active
  ON dialext_provider_tasks(session_id, target_language)
  WHERE status IN ('queued', 'running', 'cancel_requested');
CREATE INDEX idx_dialext_provider_tasks_session
  ON dialext_provider_tasks(session_id, created_at DESC);

CREATE TABLE dialext_provider_stages (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL DEFAULT '',
  created_by_task_id TEXT NOT NULL DEFAULT '',
  task_attempt INTEGER NOT NULL DEFAULT 1 CHECK(task_attempt > 0),
  input_revision INTEGER NOT NULL DEFAULT 1 CHECK(input_revision > 0),
  kind TEXT NOT NULL DEFAULT 'asr' CHECK(kind IN ('asr', 'reconstruction')),
  source_locale TEXT NOT NULL DEFAULT '',
  target_language TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT 'fixture',
  model TEXT NOT NULL DEFAULT '',
  prompt_version TEXT NOT NULL DEFAULT '',
  request_key TEXT NOT NULL DEFAULT '' CHECK(length(request_key) = 64),
  result_sha256 TEXT NOT NULL DEFAULT '' CHECK(length(result_sha256) = 64),
  result_artifact_path TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(session_id, request_key),
  FOREIGN KEY(session_id) REFERENCES sessions(id),
  FOREIGN KEY(created_by_task_id) REFERENCES dialext_provider_tasks(id)
) STRICT;

CREATE TRIGGER dialext_provider_stage_immutable BEFORE UPDATE ON dialext_provider_stages
BEGIN SELECT RAISE(ABORT, 'dialext provider stage is immutable'); END;
