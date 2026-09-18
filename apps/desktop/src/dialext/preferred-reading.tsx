import { Trans } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";

import { Button } from "@anlg/ui/components/ui/button";
import { ButtonGroup } from "@anlg/ui/components/ui/button-group";

import {
  setSettingValues,
  useSettingsReady,
  useStoredSettingValue,
} from "~/settings/queries";
import { SettingRow } from "~/settings/setting-row";

export function PreferredReadingLanguage() {
  const settingsReady = useSettingsReady();
  const { value } = useStoredSettingValue("dialext_reading_language");
  const mutation = useMutation({
    mutationFn: (language: string) =>
      setSettingValues({ dialext_reading_language: language }),
  });
  return (
    <div>
      <SettingRow
        title={<Trans>Preferred reading language</Trans>}
        description={
          <Trans>
            Use this language for new Dialext recordings. Existing readings and
            summaries keep their saved language.
          </Trans>
        }
      >
        {(labelProps) => (
          <ButtonGroup {...labelProps}>
            {(["en", "ga"] as const).map((language) => {
              const selected = (value === "ga" ? "ga" : "en") === language;
              return (
                <Button
                  key={language}
                  aria-pressed={selected}
                  variant={selected ? "secondary" : "outline"}
                  disabled={!settingsReady || mutation.isPending}
                  onClick={() => {
                    if (!selected) mutation.mutate(language);
                  }}
                  className="h-9 px-3"
                >
                  {language === "en" ? "English" : "Gaeilge"}
                </Button>
              );
            })}
          </ButtonGroup>
        )}
      </SettingRow>
      {mutation.error && (
        <p role="alert" className="text-destructive text-sm">
          {mutation.error.message}
        </p>
      )}
    </div>
  );
}
