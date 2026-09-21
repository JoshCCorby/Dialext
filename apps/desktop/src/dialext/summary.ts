import { executeTransaction, liveQueryClient } from "~/db";
import { enqueueDatabaseWrite } from "~/db/write-queue";

/// A deterministic Dialext output: one block per passage of the selected reading,
/// with no model call. It is a fixture-grade output for checking corrections and
/// proposals end to end, not a summary of what was said.
///
/// Each block carries the passage's own word id as its identity, so a correction to
/// that passage can propose a change to exactly that block, whatever the reader has
/// since added, removed or rewritten around it.
export type DialextSummaryPassage = { wordId: string; text: string };

export async function isDialextRecording(sessionId: string): Promise<boolean> {
  const rows = await liveQueryClient.execute<{ found: number }>(
    `SELECT 1 AS found FROM dialext_recordings
     JOIN sessions ON sessions.id = dialext_recordings.id AND sessions.deleted_at IS NULL
     WHERE dialext_recordings.id = ? LIMIT 1`,
    [sessionId],
  );
  return rows.length > 0;
}

export async function loadDialextSummaryPassages(
  sessionId: string,
): Promise<DialextSummaryPassage[]> {
  const rows = await liveQueryClient.execute<{ words_json: string }>(
    `SELECT transcripts.words_json FROM dialext_recordings
     JOIN dialext_accounts ON dialext_accounts.id = dialext_recordings.active_account_id
       AND dialext_accounts.session_id = dialext_recordings.id
     JOIN transcripts ON transcripts.id = dialext_accounts.transcript_id
       AND transcripts.deleted_at IS NULL
     WHERE dialext_recordings.id = ? LIMIT 1`,
    [sessionId],
  );
  const words = parseWords(rows[0]?.words_json);
  return words.flatMap((word) =>
    typeof word.id === "string" &&
    word.id &&
    typeof word.text === "string" &&
    word.text.trim() &&
    hasDialextAnchors(word)
      ? [{ wordId: word.id, text: word.text.trim() }]
      : [],
  );
}

export function buildDialextSummaryDocument(
  title: string,
  passages: DialextSummaryPassage[],
) {
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: title }],
      },
      ...passages.map((passage) => ({
        type: "dialextBlock",
        attrs: { id: passage.wordId },
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: passage.text }],
          },
        ],
      })),
    ],
  };
}

/// Writes only into an output that is still empty, so generating can never replace
/// what the reader already has in it.
export function writeDialextSummaryIfEmpty(input: {
  sessionId: string;
  noteId: string;
  body: string;
}): Promise<boolean> {
  return enqueueDatabaseWrite(`session:${input.sessionId}`, async () => {
    const [updated = 0] = await executeTransaction([
      {
        sql: `
          UPDATE session_documents
          SET body = ?, body_format = 'prosemirror_json', updated_at = ?
          WHERE id = ? AND session_id = ? AND body = '' AND deleted_at IS NULL
            AND kind IN ('summary', 'template_output')
        `,
        params: [
          input.body,
          new Date().toISOString(),
          input.noteId,
          input.sessionId,
        ],
      },
    ]);
    return updated === 1;
  });
}

function parseWords(
  value: string | undefined,
): Array<{ id?: unknown; text?: unknown; metadata?: unknown }> {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function hasDialextAnchors(word: { metadata?: unknown }): boolean {
  const metadata = word.metadata as { dialext?: { anchors?: unknown } } | null;
  const anchors = metadata?.dialext?.anchors;
  return Array.isArray(anchors) && anchors.length > 0;
}
