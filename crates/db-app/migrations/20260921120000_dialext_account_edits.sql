-- Append-only history for version-pinned Dialext account edits. One row per accepted
-- edit action, including undos, so an undo is another checked edit rather than an
-- in-memory stack that a restart forgets. Personal-only; outside enabled CloudSync.
--
-- The pinned tokens are the trigger-maintained transcripts.content_version, not
-- content_revision: a writer that changes words_json without bumping the counter
-- still changes the token, so a stale write is refused rather than silently retried.
CREATE TABLE dialext_account_edits (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL DEFAULT '',
  account_id TEXT NOT NULL DEFAULT '',
  sequence INTEGER NOT NULL DEFAULT 1 CHECK(sequence > 0),
  base_content_version TEXT NOT NULL DEFAULT '',
  result_content_version TEXT NOT NULL DEFAULT '',
  -- [{"word_id":…,"previous_text":…,"next_text":…}], in account word order.
  changes_json TEXT NOT NULL DEFAULT '[]',
  undoes_edit_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(session_id, account_id, sequence),
  FOREIGN KEY(session_id) REFERENCES sessions(id),
  FOREIGN KEY(account_id) REFERENCES dialext_accounts(id),
  FOREIGN KEY(undoes_edit_id) REFERENCES dialext_account_edits(id)
) STRICT;
-- History is evidence of what the reader did. Correcting it would lose that.
CREATE TRIGGER dialext_account_edit_immutable BEFORE UPDATE ON dialext_account_edits
BEGIN SELECT RAISE(ABORT, 'dialext edit history is append-only'); END;
-- An edit is undone at most once, so the undo stack cannot double-revert one action.
CREATE UNIQUE INDEX idx_dialext_account_edits_undoes
  ON dialext_account_edits (undoes_edit_id) WHERE undoes_edit_id IS NOT NULL;
CREATE INDEX idx_dialext_account_edits_account
  ON dialext_account_edits (session_id, account_id, sequence);
