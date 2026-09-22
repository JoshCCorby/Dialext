import { type ReactNode, useMemo } from "react";

import { deriveBillingInfo } from "@anlg/supabase";

import {
  type BillingAccess,
  BillingContext,
  createLocalFeatureAccess,
} from "./billing-context";

export function PersonalBillingProvider({ children }: { children: ReactNode }) {
  const value = useMemo<BillingAccess>(
    () => ({
      ...deriveBillingInfo(null),
      isReady: true,
      canStartTrial: { data: false, isPending: false },
      upgradeToPro: () => {},
      isUpgradingToPro: false,
      localFeatures: createLocalFeatureAccess(true),
    }),
    [],
  );

  return (
    <BillingContext.Provider value={value}>{children}</BillingContext.Provider>
  );
}
