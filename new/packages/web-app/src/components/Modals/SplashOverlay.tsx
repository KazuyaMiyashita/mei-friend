import logoUrl from "../../assets/menu-logo.svg";
import { usePersistedAppSettings } from "../../context/PersistedAppSettingsContext";
import styles from "./Modals.module.css";

interface SplashOverlayProps {
  onDismiss: () => void;
}

const VERSION = "6.0.0";

export default function SplashOverlay({ onDismiss }: SplashOverlayProps) {
  const { settings, updateSettings } = usePersistedAppSettings();

  return (
    <div className={styles.overlayBackdrop}>
      <div className={styles.splash}>
        <div className={styles.splashHeader}>
          <img src={logoUrl} alt="mei-friend" />
        </div>
        <hr
          className={styles.dropdownLine}
          style={{ borderColor: "rgba(255,255,255,0.4)" }}
        />
        <div className={styles.splashBodyContainer}>
          <div
            className={styles.splashUpdateIndicator}
            id="splashUpdateIndicator"
          />
          <div>
            <p>
              <strong>mei-friend</strong> is a &ldquo;last mile&rdquo; editor
              for MEI music encodings. It is intended to alleviate common tasks
              such as cleaning up encodings generated via optical music
              recognition or conversion from other formats.
            </p>
            <p>
              Open a file via <strong>File → Open file</strong>, or drag and
              drop a MEI file onto the application to get started.
            </p>
          </div>
        </div>
        <div className={styles.splashFooter}>
          <div className={styles.splashVersion}>
            Version:{" "}
            <a
              href={`https://github.com/mei-friend/mei-friend/releases/tag/v${VERSION}`}
            >
              {VERSION}
            </a>
          </div>
          <button
            type="button"
            className={styles.splashConfirmButton}
            onClick={onDismiss}
          >
            OK
          </button>
          <span className={styles.splashAlwaysShowCtrl}>
            <input
              id="splashAlwaysShow"
              type="checkbox"
              checked={settings.showSplash}
              onChange={(e) => updateSettings({ showSplash: e.target.checked })}
              title="Always show this splash screen on application load"
            />
            <label
              htmlFor="splashAlwaysShow"
              title="Always show this splash screen on application load"
            >
              Always show
            </label>
          </span>
        </div>
      </div>
    </div>
  );
}
