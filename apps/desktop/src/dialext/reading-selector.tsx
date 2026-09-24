import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  cancelDialextProviderTask,
  selectDialextAccount,
  startDialextProviderTask,
} from "@anlg/plugin-db";
import { Button } from "@anlg/ui/components/ui/button";
import { ButtonGroup } from "@anlg/ui/components/ui/button-group";

import { useDialextAccounts } from "./account-query";
import {
  providerTaskLabel,
  useLatestDialextProviderTask,
} from "./provider-task";
import { READING_CODES, READING_NAMES } from "./reading-languages";
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
  const providerTask = useLatestDialextProviderTask(sessionId);
  const mutation = useMutation({
    mutationFn: async (accountId: string) => {
      if (selected?.transcript_id)
        await flushDatabaseWrites([`transcript:${selected.transcript_id}`]);
      await selectDialextAccount(sessionId, accountId, previous);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["open-note-search"] }),
  });
  const generation = useMutation({
    mutationFn: (language: "en" | "ga") =>
      startDialextProviderTask(sessionId, language),
    onSuccess: () => queryClient.invalidateQueries(),
  });
  const cancel = useMutation({
    mutationFn: () =>
      providerTask
        ? cancelDialextProviderTask(providerTask.id)
        : Promise.resolve(),
  });
  const generationActive =
    providerTask?.status === "queued" ||
    providerTask?.status === "running" ||
    providerTask?.status === "cancel_requested";
  if (rows.length === 0) return null;

  return (
    <div className="flex shrink-0 flex-col gap-2 border-b px-6 py-3 text-sm">
      <div className="flex items-center gap-3">
        <Trans>Reading language</Trans>
        <ButtonGroup aria-label={t`Reading language`}>
          {READING_CODES.map((language) => {
            const account =
              rows.find(
                (row) =>
                  row.target_language === language && row.id === previous,
              ) ??
              rows.find(
                (row) => row.target_language === language && row.usable,
              );
            const canGenerate =
              !account?.usable && Boolean(rows[0]?.has_source_audio);
            const generatingThis =
              generationActive && providerTask?.target_language === language;
            return (
              <Button
                key={language}
                aria-pressed={Boolean(
                  account?.usable && account.id === previous,
                )}
                variant={account?.id === previous ? "secondary" : "outline"}
                disabled={
                  editing ||
                  mutation.isPending ||
                  generation.isPending ||
                  (account?.usable ? false : !canGenerate || generationActive)
                }
                onClick={() => {
                  if (account?.id && account.id !== previous)
                    mutation.mutate(account.id);
                  else if (canGenerate) generation.mutate(language);
                }}
                className="h-7 px-3 text-sm"
              >
                {READING_NAMES[language]}
                {!account?.usable
                  ? generatingThis
                    ? t` (generating…)`
                    : canGenerate
                      ? t` (generate)`
                      : t` (unavailable)`
                  : ""}
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
      {providerTask && providerTask.status !== "succeeded" ? (
        <div className="flex items-center gap-2">
          <p role="status">{providerTaskLabel(providerTask)}</p>
          {generationActive && providerTask.status !== "cancel_requested" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              <Trans>Cancel</Trans>
            </Button>
          ) : null}
        </div>
      ) : null}
      {!selected?.usable && (
        <p role="status">
          <Trans>
            This recording has no usable selected reading. Saved accounts are
            retained.
          </Trans>
        </p>
      )}
      {(mutation.error || generation.error || cancel.error) && (
        <p role="alert" className="text-destructive">
          {String(mutation.error || generation.error || cancel.error)}
        </p>
      )}
    </div>
  );
}
