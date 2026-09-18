import { useLiveQuery } from "~/db";

type AccountRow = {
  active_account_id: string | null;
  id: string | null;
  transcript_id: string | null;
  target_language: string | null;
  usable: number;
};

export function useDialextAccounts(sessionId: string) {
  return useLiveQuery<AccountRow, AccountRow[]>({
    sql: `
      SELECT dialext_recordings.active_account_id, dialext_accounts.id,
        dialext_accounts.transcript_id, dialext_accounts.target_language,
        CASE WHEN transcripts.deleted_at IS NULL AND json_valid(transcripts.words_json)
          AND json_type(transcripts.words_json) = 'array' AND json_array_length(transcripts.words_json) > 0
          THEN 1 ELSE 0 END AS usable
      FROM sessions
      LEFT JOIN dialext_recordings ON dialext_recordings.id = sessions.id
      LEFT JOIN dialext_accounts ON dialext_accounts.session_id = sessions.id
      LEFT JOIN transcripts ON transcripts.id = dialext_accounts.transcript_id
      WHERE sessions.id = ? AND sessions.deleted_at IS NULL AND (
        dialext_recordings.id IS NOT NULL OR
        json_type(CASE WHEN json_valid(sessions.metadata_json) THEN sessions.metadata_json ELSE '{}' END, '$.dialext.original') IS NOT NULL
      )
      ORDER BY dialext_accounts.generation DESC, dialext_accounts.id
    `,
    params: [sessionId],
    enabled: Boolean(sessionId),
  });
}
