-- Version pins and block targets for a Dialext correction-driven summary proposal.
--
-- The existing accept path compares `base_updated_at`, a timestamp, then writes the
-- document and the proposal status separately, replacing the whole body from markdown.
-- These columns let one native transaction compare both trigger-maintained tokens and
-- replace only the blocks the proposal names, so a manual edit to an untargeted block
-- survives acceptance and a stale proposal leaves the document alone.
--
-- Additive with defaults, so an older build still opens this database and an existing
-- proposal keeps its current behaviour: empty pins mean nothing to compare.
ALTER TABLE session_proposals ADD COLUMN base_document_version TEXT NOT NULL DEFAULT '';
ALTER TABLE session_proposals ADD COLUMN base_transcript_version TEXT NOT NULL DEFAULT '';
-- [{"block_id":…,"text":…}] naming only the blocks this proposal changes.
ALTER TABLE session_proposals ADD COLUMN target_blocks_json TEXT NOT NULL DEFAULT '[]';
-- The account whose correction prompted this proposal, for the transcript pin above.
ALTER TABLE session_proposals ADD COLUMN account_id TEXT NOT NULL DEFAULT '';
