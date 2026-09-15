import { Trans } from "@lingui/react/macro";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { applySessionIngest } from "@anlg/plugin-db";
import { Button } from "@anlg/ui/components/ui/button";

import { prepareDialextImport, type ReadingLanguage } from "./recording-import";

import { DEFAULT_USER_ID } from "~/shared/utils";
import { useTabs } from "~/store/zustand/tabs";

export function ImportDialextRecording() {
  const input = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const openCurrent = useTabs((state) => state.openCurrent);
  const form = useForm({
    defaultValues: { language: "english" as ReadingLanguage },
  });
  const mutation = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 2 * 1024 * 1024) {
        throw new Error(
          "This recording bundle is larger than the 2 MB prototype import limit.",
        );
      }
      const prepared = prepareDialextImport(
        await file.text(),
        form.state.values.language,
        {
          workspaceId: "dialext-local",
          ownerUserId: DEFAULT_USER_ID,
        },
      );
      const result = await applySessionIngest(
        "dialext-local",
        prepared.envelope,
      );
      if (result === "rejected") {
        throw new Error(
          "This recording could not be imported. If it already exists, its saved edits have been preserved.",
        );
      }
      return prepared.sessionId;
    },
    onSuccess: async (sessionId) => {
      await queryClient.invalidateQueries();
      openCurrent({ id: sessionId, type: "sessions" });
    },
  });

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="font-medium">
        <Trans>Import a Dialext recording</Trans>
      </h2>
      <p className="text-muted-foreground text-sm">
        <Trans>
          Choose a prepared language reading. Your original readings are
          preserved, and importing again will not replace saved edits.
        </Trans>
      </p>
      <form.Field name="language">
        {(field) => (
          <label className="flex items-center gap-3 text-sm">
            <Trans>Reading language</Trans>
            <select
              value={field.state.value}
              disabled={mutation.isPending}
              onChange={(event) =>
                field.handleChange(event.target.value as ReadingLanguage)
              }
              className="bg-background rounded-md border px-2 py-1"
            >
              <option value="english">English</option>
              <option value="irish">Gaeilge</option>
            </select>
          </label>
        )}
      </form.Field>
      <input
        ref={input}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) mutation.mutate(file);
          event.target.value = "";
        }}
      />
      <Button
        className="w-fit"
        disabled={mutation.isPending}
        onClick={() => input.current?.click()}
      >
        {mutation.isPending ? (
          <Trans>Importing…</Trans>
        ) : (
          <Trans>Choose recording file</Trans>
        )}
      </Button>
      {mutation.error && (
        <p role="alert" className="text-destructive text-sm">
          {mutation.error.message}
        </p>
      )}
    </section>
  );
}
