import type { Cursor } from "@mei-friend/core";
import styles from "./VerovioCanvasFooter.module.css";

interface Props {
  cursor: Cursor | null;
  selectedId: string | null;
  enabled: boolean;
}

export function VerovioCanvasFooter({ cursor, selectedId, enabled }: Props) {
  const pos = cursor?.position ?? null;
  return (
    <div className={styles.footerToolbar}>
      <div className={styles.statusItem}>
        <span className={styles.statusLabel}>Measure</span>
        <span className={styles.statusValue}>
          {enabled && pos ? pos.measureIndex + 1 : "-"}
        </span>
      </div>

      <div className={styles.statusItem}>
        <span className={styles.statusLabel}>Staff</span>
        <span className={styles.statusValue}>
          {enabled && pos ? pos.staffN : "-"}
        </span>
      </div>

      <div className={styles.statusItem}>
        <span className={styles.statusLabel}>Layer</span>
        <span className={styles.statusValue}>
          {enabled && pos ? pos.layerN : "-"}
        </span>
      </div>

      <div className={styles.statusItem}>
        <span className={styles.statusLabel}>Offset</span>
        <span className={styles.statusValue} style={{ minWidth: "40px" }}>
          {enabled && pos ? pos.offset.toString() : "-"}
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
