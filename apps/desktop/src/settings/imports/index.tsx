import { Trans } from "@lingui/react/macro";

import { commands as openerCommands } from "@anlg/plugin-opener2";
import { ArrowSquareOut } from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";

import { ANARLOG_ACCOUNT_SERVICES_ENABLED } from "~/auth/account-services";
import { ImportDialextRecording } from "~/dialext/import-recording";
import { DialextProviderGeneration } from "~/dialext/provider-generation";
import { MeetingImportScreen } from "~/imports/screen";
import { SettingsPageTitle } from "~/settings/page-title";

const IMPORTS_DOCUMENTATION_URL = "https://docs.anarlog.so/imports";

export function SettingsImports() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <SettingsPageTitle title={<Trans>Imports</Trans>} />
        {/* Anarlog's documentation, not Dialext's; hidden until Dialext has its own. */}
        {ANARLOG_ACCOUNT_SERVICES_ENABLED && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              void openerCommands.openUrl(IMPORTS_DOCUMENTATION_URL, null)
            }
          >
            <Trans>Documentation</Trans>
            <ArrowSquareOut className="size-3.5" />
          </Button>
        )}
      </div>
      <DialextProviderGeneration />
      <ImportDialextRecording />
      <MeetingImportScreen />
    </div>
  );
}
