"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchStoreSettings, type StoreSettings } from "./api";
import { useAuth } from "./auth-context";

interface StoreSettingsContextValue {
  settings: StoreSettings | null;
  setSettings: (settings: StoreSettings) => void;
}

const StoreSettingsContext = createContext<StoreSettingsContextValue | null>(null);

const DEFAULT_STORE_NAME = "Sawo Shop";

export function StoreSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<StoreSettings | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchStoreSettings()
      .then(setSettings)
      .catch(() =>
        setSettings({
          storeName: DEFAULT_STORE_NAME,
          logoUrl: null,
          allowPartialRefunds: false,
          defaultCarrier: "USPS",
          deliveryProvider: "EASYPOST",
          shipFromName: null,
          shipFromPhone: null,
          shipFromStreet1: null,
          shipFromStreet2: null,
          shipFromCity: null,
          shipFromState: null,
          shipFromZip: null,
          shipFromCountry: null,
          apiEnvironment: "SANDBOX",
          stripeSecretKeyTestSet: false,
          stripeWebhookSecretTestSet: false,
          easypostApiKeyTestSet: false,
          shipstationApiKeyTestSet: false,
          stripeSecretKeyLiveSet: false,
          stripeWebhookSecretLiveSet: false,
          easypostApiKeyLiveSet: false,
          shipstationApiKeyLiveSet: false,
          // Real value is fetched live per-account from ShipEngine (see
          // settings.service.ts) — this only applies if that fetch itself
          // failed, so it defaults to "none known" rather than optimistically
          // claiming carriers are connected when we can't actually confirm it.
          shipEngineSupportedCarriers: [],
        })
      );
  }, [user]);

  return (
    <StoreSettingsContext.Provider value={{ settings, setSettings }}>
      {children}
    </StoreSettingsContext.Provider>
  );
}

export function useStoreSettings() {
  const ctx = useContext(StoreSettingsContext);
  if (!ctx) throw new Error("useStoreSettings must be used within a StoreSettingsProvider");
  return ctx;
}
