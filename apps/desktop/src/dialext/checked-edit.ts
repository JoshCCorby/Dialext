import { editDialextPassage, undoDialextEdit } from "@anlg/plugin-db";

import { liveQueryClient, useLiveQuery } from "~/db";

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

/// The account version behind the words currently on screen. It is a live query
/// on the same invalidation as the rendered transcript, so it moves exactly when the
/// displayed words move. A change made where this window cannot see it leaves both
/// behind together, and the pin then refuses instead of writing over that change.
export function useDialextEditVersion(transcriptId: string): string | null {
  const { data = null } = useLiveQuery<
    { content_version: string },
    string | null
  >({
    sql: `
      SELECT transcripts.content_version
      FROM dialext_accounts
      JOIN transcripts ON transcripts.id = dialext_accounts.transcript_id
        AND transcripts.session_id = dialext_accounts.session_id
        AND transcripts.deleted_at IS NULL
      WHERE dialext_accounts.transcript_id = ?
      LIMIT 1
    `,
    params: [transcriptId],
    enabled: Boolean(transcriptId),
    mapRows: (rows) => rows[0]?.content_version ?? null,
  });
  return transcriptId ? data : null;
}

/// `expectedContentVersion` is the version the reader was looking at. A version read
/// now, at submission, would describe the database rather than the screen, and the
/// pin would never refuse anything.
export async function editDialextPassageText(input: {
  transcriptId: string;
  wordIds: string[];
  text: string;
  expectedContentVersion: string | null;
}): Promise<DialextEditAttempt> {
  const target = await loadDialextEditTarget(input.transcriptId);
  if (!target) {
    return { outcome: "not-dialext" };
  }
  if (!input.expectedContentVersion) {
    // No version was on screen to pin; refuse rather than guess one.
    return { outcome: "stale", contentVersion: target.content_version };
  }
  const result = await editDialextPassage(
    target.session_id,
    target.account_id,
    input.expectedContentVersion,
    input.wordIds,
    input.text,
  );
  return attempt(result);
}

export async function undoDialextPassageEdit(
  transcriptId: string,
  expectedContentVersion: string | null,
): Promise<DialextEditAttempt> {
  const target = await loadDialextEditTarget(transcriptId);
  if (!target) {
    return { outcome: "not-dialext" };
  }
  if (!expectedContentVersion) {
    return { outcome: "stale", contentVersion: target.content_version };
  }
  const result = await undoDialextEdit(
    target.session_id,
    target.account_id,
    expectedContentVersion,
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
