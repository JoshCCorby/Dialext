import { Trans } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";

import { Button } from "@anlg/ui/components/ui/button";

import { undoDialextPassageEdit } from "./checked-edit";

import { flushDatabaseWrites } from "~/db/write-queue";

/// Undo is another checked, recorded edit to the selected reading, so it is still
/// available after a restart and refuses rather than reverting over newer text.
export function UndoCorrection({
  transcriptId,
  disabled,
}: {
  transcriptId: string;
  disabled: boolean;
}) {
  const mutation = useMutation({
    mutationFn: async () => {
      await flushDatabaseWrites([`transcript:${transcriptId}`]);
      return undoDialextPassageEdit(transcriptId);
    },
  });
  const outcome = mutation.data?.outcome;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-7 px-3 text-sm"
        disabled={disabled || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        <Trans>Undo last correction</Trans>
      </Button>
      {mutation.isPending ? (
        <span role="status">
          <Trans>Undoing…</Trans>
        </span>
      ) : outcome === "applied" ? (
        <span role="status">
          <Trans>Correction undone.</Trans>
        </span>
      ) : outcome === "nothing-to-undo" ? (
        <span role="status">
          <Trans>No correction to undo in this reading.</Trans>
        </span>
      ) : outcome === "stale" ? (
        <span role="alert" className="text-destructive">
          <Trans>
            This reading changed in another window. Nothing was undone.
          </Trans>
        </span>
      ) : null}
      {mutation.error ? (
        <span role="alert" className="text-destructive">
          {mutation.error instanceof Error
            ? mutation.error.message
            : String(mutation.error)}
        </span>
      ) : null}
    </>
  );
}
