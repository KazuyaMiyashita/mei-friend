import type {
  DebugFilters,
  VrvOptions,
} from "@mei-friend/plugin-verovio-react";
import styles from "./VerovioCanvasHeader.module.css";

interface Props {
  fitMode: "off" | "width" | "height";
  setFitMode: (mode: "off" | "width" | "height") => void;
  vrvOptions: VrvOptions;
  setVrvOptions: React.Dispatch<React.SetStateAction<VrvOptions>>;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  totalPages: number;
  debugFilters: DebugFilters;
  setDebugFilters: React.Dispatch<React.SetStateAction<DebugFilters>>;
}

export function VerovioCanvasHeader({
  fitMode,
  setFitMode,
  vrvOptions,
  setVrvOptions,
  currentPage,
  setCurrentPage,
  totalPages,
  debugFilters,
  setDebugFilters,
}: Props) {
  return (
    <div className={styles.toolbar}>
      <label className={styles.ctrlLabel}>
        <span className={styles.ctrlLabelText}>Fit</span>
        <select
          value={fitMode}
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
          type="range"
          min={10}
          max={200}
          step={5}
          value={vrvOptions.scale}
          onChange={(e) =>
            setVrvOptions((prev) => ({
              ...prev,
              scale: Number(e.target.value),
            }))
          }
        />
        <span>{vrvOptions.scale}%</span>
      </label>

      <label className={styles.ctrlLabel}>
        <span className={styles.ctrlLabelText}>Breaks</span>
        <select
          value={vrvOptions.breaks}
          onChange={(e) =>
            setVrvOptions((prev) => ({
              ...prev,
              breaks: e.target.value as VrvOptions["breaks"],
            }))
          }
        >
          <option value="none">None</option>
          <option value="auto">Auto</option>
          <option value="line">Line</option>
          <option value="encoded">Encoded</option>
        </select>
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <button
          type="button"
          className={styles.ctrlBtn}
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
        >
          &lt;
        </button>
        <span style={{ fontSize: "11px" }}>
          {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          className={styles.ctrlBtn}
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage >= totalPages}
        >
          &gt;
        </button>
      </div>

      <div className={styles.debugGroup}>
        <span className={styles.ctrlLabelText} style={{ marginRight: "4px" }}>
          Debug:
        </span>
        {(["measure", "staff", "note", "caret"] as const).map((key) => (
          <button
            type="button"
            key={key}
            className={styles.ctrlBtn}
            onClick={() =>
              setDebugFilters((prev) => ({
                ...prev,
                [key]: !prev[key],
              }))
            }
            style={{
              backgroundColor: debugFilters[key] ? "#ff6b6b" : undefined,
              color: debugFilters[key] ? "white" : undefined,
            }}
          >
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
