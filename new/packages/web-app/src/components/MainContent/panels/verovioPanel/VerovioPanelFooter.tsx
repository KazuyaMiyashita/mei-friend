import { type Cursor, type MeiFriend, MeiNote } from "@mei-friend/core";
import { useEffect, useState } from "react";
import styles from "../Footer.module.css";

interface Props {
  cursor: Cursor | null;
  selectedId: string | null;
  meiFriend: MeiFriend | null;
}

export function VerovioPanelFooter({ cursor, selectedId, meiFriend }: Props) {
  const pos = cursor?.position ?? null;
  const meter =
    pos && meiFriend ? meiFriend.api.getMeterAt(pos.measureIndex) : null;

  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!meiFriend) return;
    return meiFriend.onUpdate(() => forceUpdate((n) => n + 1));
  }, [meiFriend]);

  const pitch = (() => {
    if (!selectedId || !meiFriend) return null;
    const el = meiFriend.getElementById(selectedId);
    if (!el) return null;
    return MeiNote.create(el)?.pitch?.toString() ?? null;
  })();

  return (
    <div className={styles.footerToolbar}>
      <div className={styles.statusItem}>
        <span className={styles.statusLabel}>Meter</span>
        <span className={styles.statusValue}>
          {meter
            ? `${meter.beats}/${Math.round(4 / meter.beatType.value.toDouble())}`
            : "-"}
        </span>
      </div>

      <div className={styles.statusItem}>
        <span className={styles.statusLabel}>Measure</span>
        <span className={styles.statusValue}>
          {pos ? pos.measureIndex + 1 : "-"}
        </span>
      </div>

      <div className={styles.statusItem}>
        <span className={styles.statusLabel}>Staff</span>
        <span className={styles.statusValue}>{pos ? pos.staffN : "-"}</span>
      </div>

      <div className={styles.statusItem}>
        <span className={styles.statusLabel}>Layer</span>
        <span className={styles.statusValue}>{pos ? pos.layerN : "-"}</span>
      </div>

      <div className={styles.statusItem}>
        <span className={styles.statusLabel}>Offset</span>
        <span className={`${styles.statusValue} ${styles.statusValueFixed}`}>
          {pos ? pos.offset.toString() : "-"}
        </span>
      </div>

      <div className={styles.statusItem}>
        <span className={styles.statusLabel}>ID</span>
        <span className={`${styles.statusValue}`}>
          {selectedId ? selectedId : "-"}
        </span>
      </div>

      <div className={styles.statusItem}>
        <span className={styles.statusLabel}>Pitch</span>
        <span className={styles.statusValue}>{pitch ?? "-"}</span>
      </div>
    </div>
  );
}
