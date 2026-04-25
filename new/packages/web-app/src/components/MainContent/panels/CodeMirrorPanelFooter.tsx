import type { EditorCursorInfo } from "@mei-friend/lib-codemirror";
import styles from "./Footer.module.css";

interface Props {
  cursorInfo: EditorCursorInfo | null;
}

export function CodeMirrorPanelFooter({ cursorInfo }: Props) {
  return (
    <div className={styles.footerToolbar}>
      <div className={styles.statusItem}>
        <span className={styles.statusLabel}>Ln</span>
        <span className={`${styles.statusValue} ${styles.statusValueFixed}`}>
          {cursorInfo ? cursorInfo.line : "-"}
        </span>
      </div>

      <div className={styles.statusItem}>
        <span className={styles.statusLabel}>Col</span>
        <span className={`${styles.statusValue} ${styles.statusValueFixed}`}>
          {cursorInfo ? cursorInfo.col : "-"}
        </span>
      </div>

      <div className={styles.statusItem}>
        <span className={styles.statusLabel}>ID</span>
        <span className={`${styles.statusValue} ${styles.statusValueId}`}>
          {cursorInfo?.xmlId ? cursorInfo.xmlId : "-"}
        </span>
      </div>
    </div>
  );
}
