import { useState } from "react";
import panelStyles from "../Panel.module.css";

export type AppSettings = {
  showSplash: boolean;
  workspaceStorageMode: "browser" | "local" | null;
};

const DEFAULT_SETTINGS: AppSettings = {
  showSplash: true,
  workspaceStorageMode: null,
};

export default function SettingsPanel() {
  const [settings, updateSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  return (
    <section className={panelStyles.panelContaioner} aria-label="Settings">
      <div className={panelStyles.panelTitle}>SETTINGS</div>

      <div className={panelStyles.panelSection}>
        <div className={panelStyles.panelSectionHeader}>General:</div>
        <div className={panelStyles.panelSectionContent}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              color: "var(--color-fg)",
              fontSize: "13px",
            }}
          >
            <input
              type="checkbox"
              checked={settings.showSplash}
              onChange={(e) =>
                updateSettings((settings) => ({
                  ...settings,
                  showSplash: e.target.checked,
                }))
              }
            />
            Always show splash screen
          </label>
        </div>
      </div>
    </section>
  );
}
