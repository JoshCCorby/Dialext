import { useQuery } from "@tanstack/react-query";

import { ANARLOG_ACCOUNT_SERVICES_ENABLED } from "~/auth/account-services";
import { BUNDLED_TEMPLATES } from "~/templates/bundled";

export function useWebResources<T>(endpoint: string) {
  return useQuery({
    queryKey: [
      "settings",
      endpoint,
      "suggestions",
      ANARLOG_ACCOUNT_SERVICES_ENABLED ? "account" : "bundled",
    ],
    queryFn: async () => {
      if (!ANARLOG_ACCOUNT_SERVICES_ENABLED) {
        return (endpoint === "templates" ? BUNDLED_TEMPLATES : []) as T[];
      }
      const response = await fetch(`https://anarlog.so/api/${endpoint}`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        return [];
      }
      return response.json() as Promise<T[]>;
    },
  });
}
