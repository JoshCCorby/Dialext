import { Trans } from "@lingui/react/macro";

import { AppIconSelector } from "./app-icon";
import { ANARLOG_APP_ICONS_ENABLED } from "./app-icon-access";
import { SidebarItemFieldsSettings } from "./sidebar-item-fields";
import { ThemeSelector } from "./theme";

import { SettingsPageTitle } from "~/settings/page-title";

export function SettingsAppearance() {
  return (
    <div className="flex max-w-5xl flex-col gap-10">
      <SettingsPageTitle title={<Trans>Appearance</Trans>} />
      <ThemeSelector />
      {ANARLOG_APP_ICONS_ENABLED ? <AppIconSelector /> : null}
      <SidebarItemFieldsSettings />
    </div>
  );
}
