import { useState } from "react";
import styles from "./Modals.module.css";

interface EnableLocalWriteDialogProps {
  onConfirm: (mode: "browser" | "local") => void;
  onCancel: () => void;
}

export default function EnableLocalWriteDialog({
  onConfirm,
  onCancel,
}: EnableLocalWriteDialogProps) {
  const [mode, setMode] = useState<"browser" | "local">("browser");

  return (
    <div className={styles.overlayBackdrop}>
      <div className={styles.dialog} style={{ maxWidth: "500px" }}>
        <h2>Workspace Storage Mode</h2>
        <div className={styles.dialogForm}>
          <p style={{ color: "var(--color-fg)", lineHeight: "1.5" }}>
            When editing files in the workspace, there are two ways to save your
            changes: saving only within the browser memory, or allowing the
            browser to access your device's file system to edit files directly.
            Which method would you like to use?
          </p>

          <div
            style={{
              marginTop: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="workspaceMode"
                value="browser"
                checked={mode === "browser"}
                onChange={() => setMode("browser")}
              />
              Browser only
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="workspaceMode"
                value="local"
                checked={mode === "local"}
                onChange={() => setMode("local")}
              />
              Save to device (Local file system)
            </label>
          </div>

          <p
            style={{
              visibility: mode === "local" ? "visible" : "hidden",
              color: "var(--color-warning, #d29922)",
              fontSize: "13px",
              marginTop: "16px",
              backgroundColor:
                "var(--color-warning-bg, rgba(210, 153, 34, 0.1))",
              padding: "12px",
              borderRadius: "6px",
              border: "1px solid var(--color-warning, #d29922)",
            }}
          >
            ⚠️ This application will have full read and write access to the
            selected directory.
          </p>
        </div>

        <div className={styles.dialogActions}>
          <button
            type="button"
            className={styles.buttonSecondary}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.buttonPrimary}
            onClick={() => onConfirm(mode)}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
