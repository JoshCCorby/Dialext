import { generateDialextOutput } from "@anlg/plugin-db";

import { liveQueryClient } from "~/db";

export async function isDialextRecording(sessionId: string): Promise<boolean> {
  const rows = await liveQueryClient.execute<{ found: number }>(
    `SELECT 1 AS found FROM dialext_recordings
     JOIN sessions ON sessions.id = dialext_recordings.id AND sessions.deleted_at IS NULL
     WHERE dialext_recordings.id = ? LIMIT 1`,
    [sessionId],
  );
  return rows.length > 0;
}

/// A deterministic Dialext output: one block per anchored passage of the selected
/// reading, with no model call. It is a fixture-grade output for checking
/// corrections, proposals and sources end to end, not a summary of what was said.
///
/// The native owner writes it only into a still-empty output and pins each block's
/// evidence in the same transaction, so a block's source is a stored fact rather
/// than something inferred later from its position or wording.
export async function generateDialextOutputIfEmpty(input: {
  sessionId: string;
  noteId: string;
  title: string;
}): Promise<"written" | "already_has_text" | "no_passages"> {
  const result = await generateDialextOutput(
    input.sessionId,
    input.noteId,
    input.title,
  );
  if (
    result.outcome === "written" ||
    result.outcome === "already_has_text" ||
    result.outcome === "no_passages"
  ) {
    return result.outcome;
  }
  throw new Error(`Unexpected Dialext output outcome: ${result.outcome}`);
}
