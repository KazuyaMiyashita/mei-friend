import type { SyncState } from "@mei-friend/lib-codemirror";
import styles from "./Header.module.css";

interface Props {
  syncState: SyncState;
  onApply: () => void;
  onRefresh: () => void;
  disabled?: boolean;
}

export function CodeMirrorPanelHeader({
  syncState,
  onApply,
  onRefresh,
  disabled = false,
}: Props) {
  const isDirty = syncState.status === "dirty";

  const renderError = () => {
    if (syncState.status !== "invalid") return null;
    return (
      <span className={styles.invalidBadge} title={syncState.error}>
        Error: {syncState.error}
      </span>
    );
  };

  return (
    <div className={`${styles.header} ${styles["space-between"]}`}>
      <div className={styles.left}>{renderError()}</div>
      <div className={styles.right}>
        <button
          className={`${styles.button} ${styles.textBtn} ${isDirty ? styles.applyBtnActive : ""}`}
          onClick={onApply}
          title="Apply changes to model"
          type="button"
          disabled={disabled || !isDirty}
        >
          Apply
        </button>
        <span className={styles.shortcut}>⌘↵</span>
        <span className={styles.headerDivider} />
        <button
          className={`${styles.button} ${styles.textBtn}`}
          onClick={onRefresh}
          title="Overwrite from MeiFriend Model"
          type="button"
          disabled={disabled || syncState.status === "idle"}
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
