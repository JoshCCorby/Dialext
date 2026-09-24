import { env } from "~/env";

export type DialextService = { apiUrl: string; appUrl: string };

/// The server behind hosted connections: meeting imports through Nango, and Google or
/// Outlook calendars. Dialext has none yet, so this is null unless a Dialext server is
/// configured, and it never falls back to Anarlog's endpoints. Callers treat null as
/// "the feature is unavailable" and make no request.
export function dialextService(): DialextService | null {
  const apiUrl = env.VITE_DIALEXT_SERVICE_URL;
  if (!apiUrl) return null;
  return { apiUrl, appUrl: env.VITE_DIALEXT_SERVICE_APP_URL ?? apiUrl };
}
