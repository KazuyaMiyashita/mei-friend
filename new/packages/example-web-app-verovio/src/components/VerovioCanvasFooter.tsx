import { type Cursor, type MeiFriend, MeiNote } from "@mei-friend/core";
import { useEffect, useState } from "react";
import styles from "./VerovioCanvasFooter.module.css";

interface Props {
  cursor: Cursor | null;
  selectedId: string | null;
  meiFriend: MeiFriend | null;
  enabled: boolean;
}

export function VerovioCanvasFooter({
  cursor,
  selectedId,
  meiFriend,
  enabled,
}: Props) {
  const pos = cursor?.position ?? null;
  const meter =
    enabled && pos && meiFriend
      ? meiFriend.api.getMeterAt(pos.measureIndex)
      : null;

  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!meiFriend) return;
    return meiFriend.onUpdate(() => forceUpdate((n) => n + 1));
  }, [meiFriend]);

  const pitch = (() => {
    if (!enabled || !selectedId || !meiFriend) return null;
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
          style={{ minWidth: "12ch", fontSize: "10px" }}
        >
          {enabled && selectedId ? selectedId : "-"}
        </span>
      </div>

      <div className={styles.statusItem}>
        <span className={styles.statusLabel}>Pitch</span>
        <span className={styles.statusValue} style={{ minWidth: "4ch" }}>
          {pitch ?? "-"}
        </span>
      </div>
    </div>
  );
}
