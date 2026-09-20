import { editDialextPassage, undoDialextEdit } from "@anlg/plugin-db";

import { liveQueryClient } from "~/db";

/// A Dialext correction is pinned to the reading it was typed against. The generic
/// transcript update re-reads and re-applies against whatever it finds, which would
/// land the reader's text on a base that moved. Everything here submits the account
/// and its `content_version` and lets the native owner refuse.
///
/// `stale` is an expected answer, not a failure: the caller keeps what was typed.
export type DialextEditAttempt =
  | { outcome: "applied" | "unchanged"; contentVersion: string }
  | { outcome: "stale"; contentVersion: string }
  | { outcome: "nothing-to-undo" }
  /// Not a Dialext account, so the ordinary transcript path still owns this edit.
  | { outcome: "not-dialext" };

type TargetRow = {
  session_id: string;
  account_id: string;
  content_version: string;
};

export async function loadDialextEditTarget(
  transcriptId: string,
): Promise<TargetRow | null> {
  const rows = await liveQueryClient.execute<TargetRow>(
    `
      SELECT dialext_accounts.session_id,
        dialext_accounts.id AS account_id,
        transcripts.content_version
      FROM dialext_accounts
      JOIN transcripts ON transcripts.id = dialext_accounts.transcript_id
        AND transcripts.session_id = dialext_accounts.session_id
        AND transcripts.deleted_at IS NULL
      JOIN sessions ON sessions.id = dialext_accounts.session_id
        AND sessions.deleted_at IS NULL
      WHERE dialext_accounts.transcript_id = ?
      LIMIT 1
    `,
    [transcriptId],
  );
  return rows[0] ?? null;
}

export async function editDialextPassageText(input: {
  transcriptId: string;
  wordIds: string[];
  text: string;
}): Promise<DialextEditAttempt> {
  const target = await loadDialextEditTarget(input.transcriptId);
  if (!target) {
    return { outcome: "not-dialext" };
  }
  const result = await editDialextPassage(
    target.session_id,
    target.account_id,
    target.content_version,
    input.wordIds,
    input.text,
  );
  return attempt(result);
}

export async function undoDialextPassageEdit(
  transcriptId: string,
): Promise<DialextEditAttempt> {
  const target = await loadDialextEditTarget(transcriptId);
  if (!target) {
    return { outcome: "not-dialext" };
  }
  const result = await undoDialextEdit(
    target.session_id,
    target.account_id,
    target.content_version,
  );
  // Nothing recorded to revert reads back as unchanged; say so plainly rather than
  // reporting a correction that did not happen.
  return result.outcome === "unchanged"
    ? { outcome: "nothing-to-undo" }
    : attempt(result);
}

function attempt(result: {
  outcome: string;
  contentVersion: string;
}): DialextEditAttempt {
  return result.outcome === "stale"
    ? { outcome: "stale", contentVersion: result.contentVersion }
    : {
        outcome: result.outcome === "applied" ? "applied" : "unchanged",
        contentVersion: result.contentVersion,
      };
}
