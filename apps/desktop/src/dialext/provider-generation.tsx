import { Trans } from "@lingui/react/macro";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";

import {
  cancelDialextProviderTask,
  createDialextProviderTask,
  startDialextProviderTask,
} from "@anlg/plugin-db";
import { Button } from "@anlg/ui/components/ui/button";

import {
  providerTaskLabel,
  useDialextProviderTask,
} from "./provider-task";
import {
  READING_CODES,
  READING_NAMES,
  type ReadingCode,
} from "./reading-languages";

import { useStoredSettingValue } from "~/settings/queries";
import { useTabs } from "~/store/zustand/tabs";

export function DialextProviderGeneration() {
  const input = useRef<HTMLInputElement>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const task = useDialextProviderTask(taskId);
  const openCurrent = useTabs((state) => state.openCurrent);
  const { value: preferredLanguage } = useStoredSettingValue(
    "dialext_reading_language",
  );
  const defaultLanguage: ReadingCode = preferredLanguage === "ga" ? "ga" : "en";
  const form = useForm({ defaultValues: { title: "", language: defaultLanguage } });
  const create = useMutation({
    mutationFn: async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".wav")) {
        throw new Error("Choose a 16-bit PCM .wav recording.");
      }
      if (file.size > 32 * 1024 * 1024) {
        throw new Error(
          "This recording is larger than the 32 MB prototype limit.",
        );
      }
      const title =
        form.state.values.title.trim() || file.name.replace(/\.wav$/i, "");
      return createDialextProviderTask(title, form.state.values.language, [
        ...new Uint8Array(await file.arrayBuffer()),
      ]);
    },
    onSuccess: (started) => setTaskId(started.taskId),
  });
  const cancel = useMutation({
    mutationFn: () =>
      taskId ? cancelDialextProviderTask(taskId) : Promise.resolve(),
  });
  const retry = useMutation({
    mutationFn: () => {
      if (!task) throw new Error("There is no task to retry.");
      return startDialextProviderTask(task.session_id, task.target_language);
    },
    onSuccess: (started) => setTaskId(started.taskId),
  });
  const active =
    task?.status === "queued" ||
    task?.status === "running" ||
    task?.status === "cancel_requested";
  const retryable = task?.status === "failed" || task?.status === "interrupted";

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="font-medium">
        <Trans>Generate a Dialext reading</Trans>
      </h2>
      <p className="text-muted-foreground text-sm">
        <Trans>
          Run the deterministic development provider on a WAV recording. It
          makes no paid call and does not assess transcription quality.
        </Trans>
      </p>
      <form.Field name="title">
        {(field) => (
          <label className="flex flex-col gap-1 text-sm">
            <Trans>Recording title</Trans>
            <input
              value={field.state.value}
              disabled={create.isPending || active}
              placeholder="Uses the filename when blank"
              onChange={(event) => field.handleChange(event.target.value)}
              className="bg-background rounded-md border px-2 py-1"
            />
          </label>
        )}
      </form.Field>
      <form.Field name="language">
        {(field) => (
          <label className="flex items-center gap-3 text-sm">
            <Trans>First reading</Trans>
            <select
              value={field.state.value}
              disabled={create.isPending || active}
              onChange={(event) =>
                field.handleChange(event.target.value === "ga" ? "ga" : "en")
              }
              className="bg-background rounded-md border px-2 py-1"
            >
              {READING_CODES.map((language) => (
                <option key={language} value={language}>
                  {READING_NAMES[language]}
                </option>
              ))}
            </select>
          </label>
        )}
      </form.Field>
      <input
        ref={input}
        type="file"
        accept=".wav,audio/wav"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) create.mutate(file);
          event.target.value = "";
        }}
      />
      <div className="flex items-center gap-2">
        <Button
          className="w-fit"
          disabled={create.isPending || active}
          onClick={() => input.current?.click()}
        >
          {create.isPending ? (
            <Trans>Starting…</Trans>
          ) : (
            <Trans>Choose WAV recording</Trans>
          )}
        </Button>
        {active && task?.status !== "cancel_requested" ? (
          <Button
            variant="outline"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate()}
          >
            <Trans>Cancel</Trans>
          </Button>
        ) : null}
        {retryable ? (
          <Button
            variant="outline"
            disabled={retry.isPending}
            onClick={() => retry.mutate()}
          >
            <Trans>Retry</Trans>
          </Button>
        ) : null}
        {task?.status === "succeeded" ? (
          <Button
            variant="outline"
            onClick={() =>
              openCurrent({ id: task.session_id, type: "sessions" })
            }
          >
            <Trans>Open recording</Trans>
          </Button>
        ) : null}
      </div>
      {task ? <p role="status">{providerTaskLabel(task)}</p> : null}
      {create.error || retry.error || cancel.error ? (
        <p role="alert" className="text-destructive text-sm">
          {String(create.error || retry.error || cancel.error)}
        </p>
      ) : null}
    </section>
  );
}
