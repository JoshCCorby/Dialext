import { type ReactNode, useMemo } from "react";

import { type AuthContextType, AuthContext } from "./auth-context";

export function PersonalAuthProvider({ children }: { children: ReactNode }) {
  const value = useMemo<AuthContextType>(
    () => ({
      supabase: null,
      session: null,
      isRefreshingSession: false,
      signIn: async () => {},
      signOut: async () => {},
      refreshSession: async () => null,
      getSessionForRequest: async () => null,
      handleAuthCallback: async () => {},
      setSessionFromTokens: async () => {},
      getHeaders: () => null,
      getAvatarUrl: async () => null,
    }),
    [],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
