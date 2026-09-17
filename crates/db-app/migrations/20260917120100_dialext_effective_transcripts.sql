-- One effective transcript seam for desktop, context, search and native access.
-- Full table names let the existing EXPLAIN-based live-query analyzer resolve view dependencies.
CREATE VIEW effective_transcripts AS
SELECT transcripts.* FROM transcripts
JOIN sessions ON sessions.id = transcripts.session_id AND sessions.deleted_at IS NULL
LEFT JOIN dialext_recordings ON dialext_recordings.id = sessions.id
LEFT JOIN dialext_accounts ON dialext_accounts.id = dialext_recordings.active_account_id AND dialext_accounts.session_id = sessions.id
WHERE transcripts.deleted_at IS NULL AND (
  (dialext_recordings.id IS NULL AND json_type(CASE WHEN json_valid(sessions.metadata_json) THEN sessions.metadata_json ELSE '{}' END, '$.dialext.original') IS NULL)
  OR (dialext_recordings.id IS NOT NULL AND dialext_accounts.transcript_id = transcripts.id AND json_valid(transcripts.words_json)
      AND json_type(transcripts.words_json) = 'array' AND json_array_length(transcripts.words_json) > 0)
);
CREATE TRIGGER dialext_selection_search_insert AFTER INSERT ON dialext_recordings
BEGIN
  INSERT INTO search_index_dirty(entity_type,entity_id) VALUES('session',NEW.id)
  ON CONFLICT(entity_type,entity_id) DO UPDATE SET generation = search_index_dirty.generation + 1, queued_at = strftime('%Y-%m-%dT%H:%M:%fZ','now');
END;
CREATE TRIGGER dialext_selection_search_update AFTER UPDATE OF active_account_id ON dialext_recordings
WHEN NEW.active_account_id IS NOT OLD.active_account_id
BEGIN
  INSERT INTO search_index_dirty(entity_type,entity_id) VALUES('session',NEW.id)
  ON CONFLICT(entity_type,entity_id) DO UPDATE SET generation = search_index_dirty.generation + 1, queued_at = strftime('%Y-%m-%dT%H:%M:%fZ','now');
END;
CREATE TRIGGER dialext_selection_search_delete AFTER DELETE ON dialext_recordings
BEGIN
  INSERT INTO search_index_dirty(entity_type,entity_id) VALUES('session',OLD.id)
  ON CONFLICT(entity_type,entity_id) DO UPDATE SET generation = search_index_dirty.generation + 1, queued_at = strftime('%Y-%m-%dT%H:%M:%fZ','now');
END;
