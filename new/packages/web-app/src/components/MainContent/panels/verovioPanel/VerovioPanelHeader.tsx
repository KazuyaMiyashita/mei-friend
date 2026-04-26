import type React from "react";
import type { VerovioOptions } from "verovio";
import styles from "../Header.module.css";

interface Props {
  currentPage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  fitMode: "off" | "width" | "height";
  setFitMode: (mode: "off" | "width" | "height") => void;
  vrvOptions: VerovioOptions;
  setVrvOptions: React.Dispatch<React.SetStateAction<VerovioOptions>>;
  enabled: boolean;
}

export function VerovioPanelHeader({
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
  fitMode,
  setFitMode,
  vrvOptions,
  setVrvOptions,
  enabled,
}: Props) {
  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <label className={styles.ctrlLabel}>
          <span className={styles.ctrlLabelText}>Fit</span>
          <select
            className={styles.select}
            value={fitMode}
            disabled={!enabled}
            onChange={(e) =>
              setFitMode(e.target.value as "off" | "width" | "height")
            }
          >
            <option value="off">Off</option>
            <option value="width">Width</option>
            <option value="height">Height</option>
          </select>
        </label>

        <label className={styles.ctrlLabel}>
          <span className={styles.ctrlLabelText}>Scale</span>
          <input
            className={styles.range}
            type="range"
            min={10}
            max={200}
            step={5}
            value={vrvOptions.scale}
            disabled={!enabled}
            onChange={(e) =>
              setVrvOptions((prev) => ({
                ...prev,
                scale: Number(e.target.value),
              }))
            }
          />
        </label>

        <label className={styles.ctrlLabel}>
          <span className={styles.ctrlLabelText}>Breaks</span>
          <select
            className={styles.select}
            value={vrvOptions.breaks}
            disabled={!enabled}
            onChange={(e) =>
              setVrvOptions((prev) => ({
                ...prev,
                breaks: e.target.value as VerovioOptions["breaks"],
              }))
            }
          >
            <option value="none">None</option>
            <option value="auto">Auto</option>
            <option value="line">Line</option>
            <option value="encoded">Encoded</option>
          </select>
        </label>
      </div>

      <div className={styles.right}>
        <button
          type="button"
          className={`${styles.button} ${styles.iconBtn}`}
          onClick={onPrevPage}
          disabled={!enabled || currentPage <= 1}
        >
          ‹
        </button>
        <span className={styles.pageInfo}>
          {enabled ? `${currentPage} / ${totalPages}` : "- / -"}
        </span>
        <button
          type="button"
          className={`${styles.button} ${styles.iconBtn}`}
          onClick={onNextPage}
          disabled={!enabled || currentPage >= totalPages}
        >
          ›
        </button>
      </div>
    </div>
  );
}
