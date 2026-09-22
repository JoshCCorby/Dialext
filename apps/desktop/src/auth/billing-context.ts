import { createContext, useContext } from "react";

import type { BillingInfo } from "@anlg/supabase";

export type LocalFeatureAccess = {
  playbackSpeed: boolean;
  dictionary: boolean;
  autoTemplateCustomization: boolean;
  localAutomations: boolean;
};

export type BillingAccess = BillingInfo & {
  isReady: boolean;
  canStartTrial: { data: boolean; isPending: boolean };
  upgradeToPro: () => void;
  isUpgradingToPro: boolean;
  localFeatures: LocalFeatureAccess;
};

export function createLocalFeatureAccess(allowed: boolean): LocalFeatureAccess {
  return {
    playbackSpeed: allowed,
    dictionary: allowed,
    autoTemplateCustomization: allowed,
    localAutomations: allowed,
  };
}

export const BillingContext = createContext<BillingAccess | null>(null);

export function useBillingAccess() {
  const context = useContext(BillingContext);

  if (!context) {
    throw new Error("useBillingAccess must be used within BillingProvider");
  }

  return context;
}
