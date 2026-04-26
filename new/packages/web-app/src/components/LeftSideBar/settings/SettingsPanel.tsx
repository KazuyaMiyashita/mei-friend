import { useWorkspaceContext } from "../../../context/WorkspaceContext";
import panelStyles from "../Panel.module.css";

export default function SettingsPanel() {
  const { settings, updateSettings } = useWorkspaceContext();

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
              onChange={(e) => updateSettings({ showSplash: e.target.checked })}
            />
            Always show splash screen
          </label>
        </div>
      </div>
    </section>
  );
}
