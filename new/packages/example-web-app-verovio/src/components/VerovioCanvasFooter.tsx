import type { Position } from "@mei-friend/core";
import styles from "./VerovioCanvasFooter.module.css";

interface Props {
  position: Position | null;
  selectedId: string | null;
  enabled: boolean;
}

export function VerovioCanvasFooter({ position, selectedId, enabled }: Props) {
  return (
    <div className={styles.footerToolbar}>
      <div className={styles.statusItem}>
        <span className={styles.statusLabel}>Measure</span>
        <span className={styles.statusValue}>
          {enabled && position ? position.measureIndex + 1 : "-"}
        </span>
      </div>

      <div className={styles.statusItem}>
        <span className={styles.statusLabel}>Staff</span>
        <span className={styles.statusValue}>
          {enabled && position ? position.staff : "-"}
        </span>
      </div>

      <div className={styles.statusItem}>
        <span className={styles.statusLabel}>Layer</span>
        <span className={styles.statusValue}>
          {enabled && position ? position.layer : "-"}
        </span>
      </div>

      <div className={styles.statusItem}>
        <span className={styles.statusLabel}>Offset</span>
        <span className={styles.statusValue} style={{ minWidth: "40px" }}>
          {enabled && position ? position.offset.toString() : "-"}
        </span>
      </div>

      <div className={styles.statusItem}>
        <span className={styles.statusLabel}>ID</span>
        <span
          className={styles.statusValue}
          style={{ minWidth: "80px", fontSize: "10px" }}
        >
          {enabled && selectedId ? selectedId : "-"}
        </span>
      </div>
    </div>
  );
}
