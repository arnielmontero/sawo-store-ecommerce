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
        setSettings({ storeName: DEFAULT_STORE_NAME, logoUrl: null, allowPartialRefunds: false, defaultCarrier: "USPS" })
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
