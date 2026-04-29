import { createContext, useContext, useState } from "react";

interface AppSettingsContextValue {
  navigateEnabled: boolean;
  setNavigateEnabled: (enabled: boolean) => void;
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [navigateEnabled, setNavigateEnabled] = useState(false);

  return (
    <AppSettingsContext.Provider
      value={{ navigateEnabled, setNavigateEnabled }}
    >
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error("useAppSettings must be used within AppSettingsProvider");
  }
  return context;
}
