-- Recording-level speaker identity, distinct from every provider's own diarised label
-- and from a reusable contact. Personal-only; outside enabled CloudSync.
CREATE TABLE dialext_speakers (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL DEFAULT '',
  speaker_key TEXT NOT NULL DEFAULT '',
  display_index INTEGER NOT NULL DEFAULT 0 CHECK(display_index >= 0),
  human_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(session_id, speaker_key),
  UNIQUE(session_id, display_index),
  FOREIGN KEY(session_id) REFERENCES sessions(id),
  FOREIGN KEY(human_id) REFERENCES humans(id)
) STRICT;
-- A provider label belongs to one independent source. Two sources' labels become one
-- recording speaker only where a prepared recording says so; never by matching strings.
CREATE TABLE dialext_source_speakers (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL DEFAULT '',
  source_id TEXT NOT NULL DEFAULT '',
  provider_label TEXT NOT NULL DEFAULT '',
  speaker_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(session_id, source_id, provider_label),
  FOREIGN KEY(session_id) REFERENCES sessions(id),
  FOREIGN KEY(speaker_id) REFERENCES dialext_speakers(id)
) STRICT;
CREATE TRIGGER dialext_source_speaker_owner_insert BEFORE INSERT ON dialext_source_speakers
WHEN NOT EXISTS(SELECT 1 FROM dialext_speakers WHERE id = NEW.speaker_id AND session_id = NEW.session_id)
BEGIN SELECT RAISE(ABORT, 'dialext source speaker ownership'); END;
-- The attribution is read from immutable evidence, so it is immutable too. Naming a
-- person changes dialext_speakers.human_id, never which provider label they spoke as.
CREATE TRIGGER dialext_source_speaker_immutable BEFORE UPDATE ON dialext_source_speakers
BEGIN SELECT RAISE(ABORT, 'dialext source speaker attribution is immutable'); END;
CREATE TRIGGER dialext_speaker_identity_immutable BEFORE UPDATE OF id, session_id, speaker_key, display_index ON dialext_speakers
BEGIN SELECT RAISE(ABORT, 'dialext speaker identity is immutable'); END;
