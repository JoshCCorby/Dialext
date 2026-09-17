-- Prevent a generic transcript writer from moving a registered account to another session.
CREATE TRIGGER dialext_transcript_owner BEFORE UPDATE OF session_id ON transcripts
WHEN NEW.session_id IS NOT OLD.session_id AND EXISTS(SELECT 1 FROM dialext_accounts WHERE transcript_id = OLD.id)
BEGIN SELECT RAISE(ABORT, 'dialext registered transcript ownership'); END;
