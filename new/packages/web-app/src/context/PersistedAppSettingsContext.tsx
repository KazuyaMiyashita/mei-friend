import { createContext, useCallback, useContext, useState } from "react";

export type AppSettings = {
  showSplash: boolean;
};

const DEFAULT_SETTINGS: AppSettings = { showSplash: true };
const SETTINGS_KEY = "mei-friend:settings";

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw)
      return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as AppSettings) };
  } catch {
    // Ignore malformed JSON — fall back to defaults.
  }
  return DEFAULT_SETTINGS;
}

function persistSettings(s: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

interface PersistedAppSettingsContextValue {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

const PersistedAppSettingsContext =
  createContext<PersistedAppSettingsContextValue | null>(null);

export function PersistedAppSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      persistSettings(next);
      return next;
    });
  }, []);

  return (
    <PersistedAppSettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </PersistedAppSettingsContext.Provider>
  );
}

export function usePersistedAppSettings() {
  const context = useContext(PersistedAppSettingsContext);
  if (!context) {
    throw new Error(
      "usePersistedAppSettings must be used within PersistedAppSettingsProvider",
    );
  }
  return context;
}
