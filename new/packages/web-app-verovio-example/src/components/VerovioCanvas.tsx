import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { VerovioToolkit } from "verovio/esm";
import createModule from "verovio/wasm";
import { buildScoreModel, type ScoreModel } from "../utils/scoreModel";
import styles from "./VerovioCanvas.module.css";

interface Props {
  xmlContent: string;
}

interface VrvOptions {
  scale: number;
  breaks: "auto" | "line" | "encoded" | "none";
}

interface DebugFilters {
  measure: boolean;
  staff: boolean;
  note: boolean;
  caret: boolean;
}

function createOverlayRect(
  bbox: { x: number; y: number; width: number; height: number },
  className: string,
  targetId: string,
  interactive = false,
): SVGRectElement {
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", String(bbox.x));
  rect.setAttribute("y", String(bbox.y));
  rect.setAttribute("width", String(bbox.width));
  rect.setAttribute("height", String(bbox.height));
  rect.setAttribute("class", `mf-overlay ${className}`);
  rect.setAttribute("data-target-id", targetId);
  if (!interactive) rect.setAttribute("style", "pointer-events: none;");
  return rect;
}

function createCaret(
  x: number,
  y: number,
  height: number,
  isDebug = false,
): SVGRectElement {
  const caret = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  caret.setAttribute("x", String(x));
  caret.setAttribute("y", String(y));
  caret.setAttribute("width", isDebug ? "30" : "80");
  caret.setAttribute("height", String(height));
  caret.setAttribute(
    "class",
    `mf-overlay mf-overlay-caret${isDebug ? " mf-overlay-caret--debug" : ""}`,
  );
  caret.setAttribute("style", "pointer-events: none;");
  return caret;
}

export function VerovioCanvas({ xmlContent }: Props) {
  const [tk, setTk] = useState<VerovioToolkit | null>(null);
  const [currentSvg, setCurrentSvg] = useState<string>("");
  const [scoreModel, setScoreModel] = useState<ScoreModel | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [vrvOptions, setVrvOptions] = useState<VrvOptions>({
    scale: 50,
    breaks: "auto",
  });
  const [debugFilters, setDebugFilters] = useState<DebugFilters>({
    measure: false,
    staff: false,
    note: false,
    caret: false,
  });
  const [selection, setSelection] = useState<string | null>(null);
  const [fitMode, setFitMode] = useState<"off" | "width" | "height">("off");

  const svgContainerRef = useRef<HTMLDivElement>(null);
  const bboxCacheRef = useRef<
    Map<string, { x: number; y: number; width: number; height: number }>
  >(new Map());

  // Initialize Verovio
  useEffect(() => {
    let active = true;
    // biome-ignore lint/suspicious/noExplicitAny: Required for VerovioToolkit initialization
    createModule().then((VerovioModule: any) => {
      if (active) {
        setTk(new VerovioToolkit(VerovioModule));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Render score when XML or options change
  useEffect(() => {
    if (!tk || !xmlContent) return;

    setIsRendering(true);
    try {
      tk.setOptions({
        scale: vrvOptions.scale,
        breaks: vrvOptions.breaks,
        adjustPageHeight: true,
      });
      tk.loadData(xmlContent);
      setTotalPages(tk.getPageCount());
      const svg = tk.renderToSVG(currentPage);
      setCurrentSvg(svg);

      // Build ScoreModel for overlays
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlContent, "application/xml");
      setScoreModel(buildScoreModel(doc));
    } catch (e) {
      console.error("Verovio rendering error:", e);
    } finally {
      setIsRendering(false);
    }
  }, [tk, xmlContent, vrvOptions, currentPage]);

  // Calculate BBoxes
  useLayoutEffect(() => {
    const container = svgContainerRef.current;
    if (!container || !currentSvg) return;

    const rootSvg = container.querySelector("svg");
    if (!rootSvg) return;
    const innerSvg = rootSvg.querySelector(
      ".definition-scale",
    ) as SVGSVGElement | null;
    if (!innerSvg) return;

    const newBboxMap = new Map<
      string,
      { x: number; y: number; width: number; height: number }
    >();
    for (const el of Array.from(innerSvg.querySelectorAll("g[id]"))) {
      const bbox = (el as SVGGraphicsElement).getBBox();
      newBboxMap.set(el.id, {
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
      });
    }
    bboxCacheRef.current = newBboxMap;
  }, [currentSvg]);

  // Render Overlays
  useLayoutEffect(() => {
    const container = svgContainerRef.current;
    if (!container || !currentSvg || !scoreModel) return;

    const rootSvg = container.querySelector("svg");
    if (!rootSvg) return;
    const innerSvg = rootSvg.querySelector(
      ".definition-scale",
    ) as SVGSVGElement | null;
    if (!innerSvg) return;

    const currentBboxMap = bboxCacheRef.current;

    // Selection Highlight
    container.querySelectorAll("g.selected").forEach((el) => {
      el.classList.remove("selected");
    });
    if (selection) {
      const el = container.querySelector(`g#${CSS.escape(selection)}`);
      if (el) el.classList.add("selected");
    }

    // Overlay Layer
    const baseClass = "mf-overlay";
    let overlayLayer = innerSvg.querySelector(
      `#${CSS.escape(baseClass)}-layer`,
    );
    if (!overlayLayer) {
      overlayLayer = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "g",
      );
      overlayLayer.id = `${baseClass}-layer`;
      innerSvg.appendChild(overlayLayer);
    }
    overlayLayer.innerHTML = "";

    const pageMarginGroup = innerSvg.querySelector("g.page-margin");
    if (pageMarginGroup) {
      const transform = pageMarginGroup.getAttribute("transform");
      if (transform) overlayLayer.setAttribute("transform", transform);
    }

    for (const [_measureN, measureModel] of scoreModel) {
      const mBbox = currentBboxMap.get(measureModel.xmlId);
      if (mBbox && debugFilters.measure) {
        overlayLayer.appendChild(
          createOverlayRect(mBbox, "mf-overlay-measure", measureModel.xmlId),
        );
      }

      for (const [_staffN, staff] of measureModel.staves) {
        const sBbox = currentBboxMap.get(staff.xmlId);
        if (sBbox) {
          overlayLayer.appendChild(
            createOverlayRect(
              sBbox,
              `mf-overlay-staff${debugFilters.staff ? " mf-overlay-staff--debug" : ""}`,
              staff.xmlId,
              true,
            ),
          );
        }

        for (const [_lN, layer] of staff.layers) {
          for (const note of layer.notes) {
            const nBbox = currentBboxMap.get(note.id);
            if (!nBbox) continue;

            overlayLayer.appendChild(
              createOverlayRect(
                nBbox,
                `mf-overlay-note${debugFilters.note ? " mf-overlay-note--debug" : ""}`,
                note.id,
                true,
              ),
            );

            if (debugFilters.caret && sBbox) {
              overlayLayer.appendChild(
                createCaret(nBbox.x, sBbox.y, sBbox.height, true),
              );
            }
          }
        }
      }
    }

    // Caret for selection
    if (selection) {
      const elBbox = currentBboxMap.get(selection);
      if (elBbox) {
        // Find staff height
        const staffEl = container
          .querySelector(`g#${CSS.escape(selection)}`)
          ?.closest("g.staff");
        if (staffEl) {
          const sBbox = currentBboxMap.get(staffEl.id);
          if (sBbox) {
            overlayLayer.appendChild(
              createCaret(elBbox.x, sBbox.y, sBbox.height),
            );
          }
        }
      }
    }
  }, [currentSvg, scoreModel, debugFilters, selection]);

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const targetId = target.getAttribute("data-target-id");
    if (targetId) {
      setSelection(targetId);
    } else {
      setSelection(null);
    }
  };

  const svgHtml = useMemo(() => {
    return { __html: currentSvg || "" };
  }, [currentSvg]);

  return (
    <div className={styles.notationPanel}>
      <div className={styles.notationControls}>
        <label className={styles.ctrlLabel}>
          <span className={styles.ctrlLabelText}>Fit</span>
          <select
            value={fitMode}
            onChange={(e) =>
              setFitMode(e.target.value as "off" | "width" | "height")
            }
          >
            <option value="off">OFF</option>
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
            className={styles.ctrlRange}
          />
          <span className={styles.ctrlValue}>{vrvOptions.scale}%</span>
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

        <div style={{ display: "flex", gap: "4px", marginLeft: "auto" }}>
          {(["measure", "staff", "note", "caret"] as const).map((key) => (
            <button
              type="button"
              key={key}
              className={styles.ctrlBtn}
              onClick={() =>
                setDebugFilters((prev) => ({ ...prev, [key]: !prev[key] }))
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
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Interactive score canvas */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Interactive score canvas */}
      <div
        className={`${styles.notationSvgArea} ${
          fitMode === "width"
            ? styles.fitWidth
            : fitMode === "height"
              ? styles.fitHeight
              : ""
        }`}
        ref={svgContainerRef}
        onClick={handleClick}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Verovio generated SVG
        dangerouslySetInnerHTML={svgHtml}
      />{" "}
      {isRendering && (
        <div className={styles.notationRendering}>Rendering…</div>
      )}
    </div>
  );
}
