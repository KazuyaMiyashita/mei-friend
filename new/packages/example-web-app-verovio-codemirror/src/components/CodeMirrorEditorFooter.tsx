import type { EditorCursorInfo } from "@mei-friend/lib-codemirror";
import styles from "./footer.module.css";

interface Props {
  cursorInfo: EditorCursorInfo | null;
  enabled: boolean;
}

export function CodeMirrorEditorFooter({ cursorInfo, enabled }: Props) {
  return (
    <div className={styles.footerToolbar}>
      <div className={styles.statusItem}>
        <span className={styles.statusLabel}>Ln</span>
        <span className={`${styles.statusValue} ${styles.statusValueFixed}`}>
          {enabled && cursorInfo ? cursorInfo.line : "-"}
        </span>
      </div>

      <div className={styles.statusItem}>
        <span className={styles.statusLabel}>Col</span>
        <span className={`${styles.statusValue} ${styles.statusValueFixed}`}>
          {enabled && cursorInfo ? cursorInfo.col : "-"}
        </span>
      </div>

      <div className={styles.statusItem}>
        <span className={styles.statusLabel}>ID</span>
        <span className={`${styles.statusValue} ${styles.statusValueId}`}>
          {enabled && cursorInfo?.xmlId ? cursorInfo.xmlId : "-"}
        </span>
      </div>
    </div>
  );
}
