import { Trans } from "@lingui/react/macro";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { applySessionIngest } from "@anlg/plugin-db";
import { Button } from "@anlg/ui/components/ui/button";

import { prepareDialextImport, type ReadingLanguage } from "./recording-import";

import { liveQueryClient } from "~/db";
import { useSettingsReady, useStoredSettingValue } from "~/settings/queries";
import { DEFAULT_USER_ID } from "~/shared/utils";
import { useTabs } from "~/store/zustand/tabs";

export function ImportDialextRecording() {
  const input = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const openCurrent = useTabs((state) => state.openCurrent);
  const settingsReady = useSettingsReady();
  const { value: preferredLanguage } = useStoredSettingValue(
    "dialext_reading_language",
  );
  const form = useForm({
    defaultValues: {
      language: (preferredLanguage === "ga"
        ? "irish"
        : "english") as ReadingLanguage,
    },
  });
  const mutation = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 2 * 1024 * 1024) {
        throw new Error(
          "This recording bundle is larger than the 2 MB prototype import limit.",
        );
      }
      const content = await file.text();
      const recordingId: unknown = JSON.parse(content)?.recording?.id;
      const existing =
        typeof recordingId === "string" &&
        /^[a-zA-Z0-9_-]{1,100}$/.test(recordingId)
          ? await liveQueryClient.execute<{ language: string | null }>(
              "SELECT json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.dialext.selected_language') AS language FROM sessions WHERE id = ?",
              [`dialext-${recordingId}`],
            )
          : [];
      // Finalized ingest pins its initial envelope; repeat import uses that language while the native fingerprint still rejects changed originals.
      const initialLanguage =
        existing[0]?.language === "english" || existing[0]?.language === "irish"
          ? existing[0].language
          : form.state.values.language;
      const prepared = prepareDialextImport(content, initialLanguage, {
        workspaceId: "dialext-local",
        ownerUserId: DEFAULT_USER_ID,
      });
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
          Import prepared language accounts. Your original readings are
          preserved. Importing again keeps saved edits and the recording’s
          selected language.
        </Trans>
      </p>
      <form.Field name="language">
        {(field) => (
          <label className="flex items-center gap-3 text-sm">
            <Trans>Reading language</Trans>
            <select
              value={field.state.value}
              disabled={!settingsReady || mutation.isPending}
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
        disabled={!settingsReady || mutation.isPending}
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
