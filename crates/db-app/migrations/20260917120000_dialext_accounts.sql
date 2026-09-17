-- Personal-only registry. Editable prose remains in transcripts.
CREATE TABLE dialext_evidence (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'asr' CHECK(kind IN ('audio', 'asr')),
  source_id TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
  sha256 TEXT NOT NULL DEFAULT '' CHECK(length(sha256) = 64),
  artifact_path TEXT NOT NULL DEFAULT '',
  duration_ms INTEGER CHECK(duration_ms > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(session_id, source_id, revision),
  FOREIGN KEY(session_id) REFERENCES sessions(id)
) STRICT;
CREATE TABLE dialext_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL DEFAULT '',
  transcript_id TEXT NOT NULL DEFAULT '' UNIQUE,
  target_language TEXT NOT NULL DEFAULT 'en' CHECK(target_language IN ('en', 'ga')),
  generation INTEGER NOT NULL DEFAULT 1 CHECK(generation > 0),
  input_evidence_digest TEXT NOT NULL DEFAULT '' CHECK(length(input_evidence_digest) = 64),
  original_artifact_path TEXT NOT NULL DEFAULT '',
  original_sha256 TEXT NOT NULL DEFAULT '' CHECK(length(original_sha256) = 64),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(session_id, target_language, generation),
  FOREIGN KEY(session_id) REFERENCES sessions(id),
  FOREIGN KEY(transcript_id) REFERENCES transcripts(id)
) STRICT;
CREATE TABLE dialext_recordings (
  id TEXT PRIMARY KEY NOT NULL,
  active_account_id TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK(preferred_language IN ('en', 'ga')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY(id) REFERENCES sessions(id),
  FOREIGN KEY(active_account_id) REFERENCES dialext_accounts(id)
) STRICT;
CREATE TRIGGER dialext_account_owner_insert BEFORE INSERT ON dialext_accounts
WHEN NOT EXISTS(SELECT 1 FROM transcripts WHERE id = NEW.transcript_id AND session_id = NEW.session_id AND deleted_at IS NULL)
BEGIN SELECT RAISE(ABORT, 'dialext account transcript ownership'); END;
CREATE TRIGGER dialext_account_immutable BEFORE UPDATE ON dialext_accounts
BEGIN SELECT RAISE(ABORT, 'dialext account generation is immutable'); END;
CREATE TRIGGER dialext_evidence_immutable BEFORE UPDATE ON dialext_evidence
BEGIN SELECT RAISE(ABORT, 'dialext evidence is immutable'); END;
CREATE TRIGGER dialext_active_owner_insert BEFORE INSERT ON dialext_recordings
WHEN NEW.active_account_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM dialext_accounts a JOIN transcripts t ON t.id = a.transcript_id
  WHERE a.id = NEW.active_account_id AND a.session_id = NEW.id AND t.session_id = NEW.id AND t.deleted_at IS NULL)
BEGIN SELECT RAISE(ABORT, 'dialext active account ownership'); END;
CREATE TRIGGER dialext_active_owner_update BEFORE UPDATE OF active_account_id, id ON dialext_recordings
WHEN NEW.active_account_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM dialext_accounts a JOIN transcripts t ON t.id = a.transcript_id
  WHERE a.id = NEW.active_account_id AND a.session_id = NEW.id AND t.session_id = NEW.id AND t.deleted_at IS NULL)
BEGIN SELECT RAISE(ABORT, 'dialext active account ownership'); END;
