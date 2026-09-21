-- Stored evidence for each block of a generated Dialext output, pinned when the output
-- is generated. Provenance is never inferred later from a block's position or wording.
-- Personal-only; outside enabled CloudSync.
--
-- `block_text` is the block's text as generated (or as last replaced by an accepted,
-- version-checked correction proposal). A reader sees the association as verified only
-- while the block still reads exactly that; once they rewrite the block it is shown as
-- the source of the generated wording, not of their edit.
CREATE TABLE dialext_block_evidence (
  id TEXT PRIMARY KEY NOT NULL,
  document_id TEXT NOT NULL DEFAULT '',
  block_id TEXT NOT NULL DEFAULT '',
  session_id TEXT NOT NULL DEFAULT '',
  account_id TEXT NOT NULL DEFAULT '',
  -- The account transcript's trigger-maintained content_version the block was taken from.
  account_content_version TEXT NOT NULL DEFAULT '',
  passage_word_id TEXT NOT NULL DEFAULT '',
  block_text TEXT NOT NULL DEFAULT '',
  -- [{"source_id":…,"start_ms":…,"end_ms":…}], exactly as the passage stored them.
  anchors_json TEXT NOT NULL DEFAULT '[]',
  spoken_language TEXT NOT NULL DEFAULT 'unknown',
  target_language TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(document_id, block_id),
  FOREIGN KEY(document_id) REFERENCES session_documents(id),
  FOREIGN KEY(session_id) REFERENCES sessions(id),
  FOREIGN KEY(account_id) REFERENCES dialext_accounts(id)
) STRICT;
CREATE INDEX idx_dialext_block_evidence_session
  ON dialext_block_evidence (session_id, document_id);
