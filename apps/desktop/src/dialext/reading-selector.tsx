import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { selectDialextAccount } from "@anlg/plugin-db";
import { Button } from "@anlg/ui/components/ui/button";
import { ButtonGroup } from "@anlg/ui/components/ui/button-group";

import { useDialextAccounts } from "./account-query";
import { UndoCorrection } from "./undo-correction";

import { flushDatabaseWrites } from "~/db/write-queue";

export function ReadingSelector({
  sessionId,
  editing = false,
}: {
  sessionId: string;
  editing?: boolean;
}) {
  const { t } = useLingui();
  const query = useDialextAccounts(sessionId);
  const rows = query.data ?? [];
  const previous = rows[0]?.active_account_id ?? null;
  const selected = rows.find((row) => row.id === previous);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (accountId: string) => {
      if (selected?.transcript_id)
        await flushDatabaseWrites([`transcript:${selected.transcript_id}`]);
      await selectDialextAccount(sessionId, accountId, previous);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["open-note-search"] }),
  });
  if (rows.length === 0) return null;

  return (
    <div className="flex shrink-0 flex-col gap-2 border-b px-6 py-3 text-sm">
      <div className="flex items-center gap-3">
        <Trans>Reading language</Trans>
        <ButtonGroup aria-label={t`Reading language`}>
          {(["en", "ga"] as const).map((language) => {
            const account =
              rows.find(
                (row) =>
                  row.target_language === language && row.id === previous,
              ) ??
              rows.find(
                (row) => row.target_language === language && row.usable,
              );
            return (
              <Button
                key={language}
                aria-pressed={Boolean(
                  account?.usable && account.id === previous,
                )}
                variant={account?.id === previous ? "secondary" : "outline"}
                disabled={editing || mutation.isPending || !account?.usable}
                onClick={() => {
                  if (account?.id && account.id !== previous)
                    mutation.mutate(account.id);
                }}
                className="h-7 px-3 text-sm"
              >
                {language === "en" ? "English" : "Gaeilge"}
                {!account?.usable ? t` (unavailable)` : ""}
              </Button>
            );
          })}
        </ButtonGroup>
        {mutation.isPending && (
          <span role="status">
            <Trans>Saving…</Trans>
          </span>
        )}
        {selected?.usable && selected.transcript_id ? (
          <UndoCorrection
            key={selected.transcript_id}
            transcriptId={selected.transcript_id}
            disabled={editing || mutation.isPending}
          />
        ) : null}
      </div>
      {editing && (
        <p className="text-muted-foreground">
          <Trans>Finish editing before switching languages.</Trans>
        </p>
      )}
      {!selected?.usable && (
        <p role="status">
          <Trans>
            This recording has no usable selected reading. Saved accounts are
            retained.
          </Trans>
        </p>
      )}
      {mutation.error && (
        <p role="alert" className="text-destructive">
          {String(
            mutation.error instanceof Error
              ? mutation.error.message
              : mutation.error,
          )}
        </p>
      )}
    </div>
  );
}
