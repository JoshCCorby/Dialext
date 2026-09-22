import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useAuth } from "./auth-context";
import { useBillingAccess } from "./billing-context";
import { PersonalBillingProvider } from "./personal-billing";
import { PersonalAuthProvider } from "./personal-context";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <PersonalAuthProvider>
      <PersonalBillingProvider>{children}</PersonalBillingProvider>
    </PersonalAuthProvider>
  );
}

describe("personal shell providers", () => {
  it("keeps the account contract signed out without granting hosted access", () => {
    const { result } = renderHook(
      () => ({ auth: useAuth(), billing: useBillingAccess() }),
      { wrapper },
    );

    expect(result.current.auth.supabase).toBeNull();
    expect(result.current.auth.session).toBeNull();
    expect(result.current.auth.getHeaders()).toBeNull();
    expect(result.current.billing).toMatchObject({
      isReady: true,
      isPaid: false,
      isPro: false,
      plan: "free",
      canStartTrial: { data: false, isPending: false },
      localFeatures: {
        playbackSpeed: true,
        dictionary: true,
        autoTemplateCustomization: true,
        localAutomations: true,
      },
    });
  });
});
