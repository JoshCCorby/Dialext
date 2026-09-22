import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";

import { useSetSettingValue } from "~/settings/queries";
import { SettingSwitchRow } from "~/settings/setting-row";
import { useConfigValue } from "~/shared/config";
import { commands } from "~/types/tauri.gen";

/// The performance bar and its render outlines are troubleshooting tools. They are
/// off unless chosen here, and the choice only exists in builds that can show them.
export function DeveloperDiagnosticsSection() {
  const available = useQuery({
    queryKey: ["devtools-panel", "enabled"],
    queryFn: commands.showDevtool,
    staleTime: Infinity,
  });
  const enabled = useConfigValue("show_developer_diagnostics");
  const setEnabled = useSetSettingValue("show_developer_diagnostics");

  if (available.data !== true) {
    return null;
  }

  return (
    <SettingSwitchRow
      title={<Trans>Show developer diagnostics</Trans>}
      description={
        <Trans>
          A bar at the bottom of the window with memory, delay and render
          counts. For troubleshooting; nothing is sent anywhere.
        </Trans>
      }
      checked={enabled}
      onChange={setEnabled}
    />
  );
}
