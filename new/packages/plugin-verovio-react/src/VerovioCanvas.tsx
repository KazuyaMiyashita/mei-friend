import {
  buildScoreModel,
  type MeiFriend,
  type ScoreModel,
} from "@mei-friend/core";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { VerovioToolkit } from "verovio/esm";
import createModule from "verovio/wasm";

export interface VrvOptions {
  scale?: number;
  breaks?: "auto" | "line" | "encoded" | "none";
  // biome-ignore lint/suspicious/noExplicitAny: Verovio toolkit has many optional parameters
  [key: string]: any;
}

export interface DebugFilters {
  measure?: boolean;
  staff?: boolean;
  note?: boolean;
  caret?: boolean;
}

export interface VerovioCanvasColors {
  background?: string;
  score?: string;
  caret?: string;
  overlay?: string;
}

export interface VerovioCanvasProps {
  meiFriend: MeiFriend;
  options?: VrvOptions;
  currentPage?: number;
  fitMode?: "off" | "width" | "height";
  selectedId?: string | null;
  debugFilters?: DebugFilters;
  colors?: VerovioCanvasColors;
  onSelectionChange?: (id: string | null) => void;
  onTotalPagesChange?: (total: number) => void;
  onRenderCompleted?: () => void;
}

export interface VerovioCanvasHandle {
  getToolkit: () => VerovioToolkit | null;
}

function createOverlayRect(
  bbox: { x: number; y: number; width: number; height: number },
  className: string,
  targetId: string,
  interactive = false,
  color = "rgba(255, 0, 0, 0.2)",
): SVGRectElement {
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", String(bbox.x));
  rect.setAttribute("y", String(bbox.y));
  rect.setAttribute("width", String(bbox.width));
  rect.setAttribute("height", String(bbox.height));
  rect.setAttribute("class", `mf-overlay ${className}`);
  rect.setAttribute("data-target-id", targetId);
  rect.setAttribute(
    "style",
    `fill: ${color}; stroke: none; ${interactive ? "cursor: pointer;" : "pointer-events: none;"}`,
  );
  return rect;
}

function createCaret(
  x: number,
  y: number,
  height: number,
  isDebug = false,
  color = "#ff6b6b",
): SVGRectElement {
  const width = isDebug ? 30 : 80;
  const caret = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  caret.setAttribute("x", String(x - width));
  caret.setAttribute("y", String(y));
  caret.setAttribute("width", String(width));
  caret.setAttribute("height", String(height));
  caret.setAttribute("class", "mf-overlay mf-overlay-caret");
  caret.setAttribute(
    "style",
    `fill: ${color}; opacity: ${isDebug ? "0.3" : "0.6"}; pointer-events: none;`,
  );
  return caret;
}

export const VerovioCanvas = forwardRef<
  VerovioCanvasHandle,
  VerovioCanvasProps
>((props, ref) => {
  const {
    meiFriend,
    options = { scale: 50, breaks: "auto" },
    currentPage = 1,
    fitMode = "off",
    selectedId = null,
    debugFilters = {},
    colors = {},
    onSelectionChange,
    onTotalPagesChange,
    onRenderCompleted,
  } = props;

  const [tk, setTk] = useState<VerovioToolkit | null>(null);
  const [currentSvg, setCurrentSvg] = useState<string>("");
  const [scoreModel, setScoreModel] = useState<ScoreModel | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  const svgContainerRef = useRef<HTMLDivElement>(null);
  const bboxCacheRef = useRef<
    Map<string, { x: number; y: number; width: number; height: number }>
  >(new Map());

  useImperativeHandle(ref, () => ({
    getToolkit: () => tk,
  }));

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

  // Render score when MeiFriend or options change
  useEffect(() => {
    if (!tk || !meiFriend) return;

    const render = () => {
      setIsRendering(true);
      try {
        const xmlContent = meiFriend.toXmlString();
        tk.setOptions({
          ...options,
          adjustPageHeight: true,
          adjustPageWidth: true,
        });
        tk.loadData(xmlContent);
        const pages = tk.getPageCount();
        onTotalPagesChange?.(pages);

        const svg = tk.renderToSVG(currentPage);
        setCurrentSvg(svg);

        setScoreModel(buildScoreModel(meiFriend));
        onRenderCompleted?.();
      } catch (e) {
        console.error("Verovio rendering error:", e);
      } finally {
        setIsRendering(false);
      }
    };

    render();

    // Subscribe to updates
    const unsubscribe = meiFriend.onUpdate(() => {
      render();
    });

    return () => unsubscribe();
  }, [
    tk,
    meiFriend,
    options,
    currentPage,
    onTotalPagesChange,
    onRenderCompleted,
  ]);

  // Apply SVG attributes and fit logic
  useLayoutEffect(() => {
    const container = svgContainerRef.current;
    if (!container || !currentSvg) return;

    const rootSvg = container.querySelector("svg") as SVGSVGElement | null;
    if (!rootSvg) return;

    // 1. Core Styles to avoid flicker and overflow
    rootSvg.style.display = "inline-block";
    rootSvg.style.overflow = "hidden";
    rootSvg.setAttribute("overflow", "hidden");

    // 2. Fit Mode Management - Use CSS ONLY to allow Verovio's intrinsic width/height attributes to handle Scale in 'Off' mode
    if (fitMode === "width") {
      rootSvg.style.setProperty("width", "100%", "important");
      rootSvg.style.setProperty("height", "auto", "important");
      rootSvg.style.setProperty("max-width", "none", "important");
      rootSvg.style.setProperty("max-height", "none", "important");
      container.style.overflowX = "hidden";
      container.style.overflowY = "auto";
    } else if (fitMode === "height") {
      rootSvg.style.setProperty("height", "100%", "important");
      rootSvg.style.setProperty("width", "auto", "important");
      rootSvg.style.setProperty("max-width", "none", "important");
      rootSvg.style.setProperty("max-height", "none", "important");
      container.style.overflowX = "auto";
      container.style.overflowY = "hidden";
    } else {
      // Fit Off - Remove style overrides to respect intrinsic SVG width/height (which changes with Scale)
      rootSvg.style.width = "";
      rootSvg.style.height = "";
      rootSvg.style.maxWidth = "";
      rootSvg.style.maxHeight = "";
      container.style.overflow = "auto";
    }

    // 3. Calculate BBoxes
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
  }, [currentSvg, fitMode]);

  // Render Overlays
  useLayoutEffect(() => {
    const container = svgContainerRef.current;
    if (!container || !currentSvg || !scoreModel) return;

    const rootSvg = container.querySelector("svg") as SVGSVGElement | null;
    if (!rootSvg) return;

    // Apply score color
    if (colors.score) {
      rootSvg.setAttribute(
        "style",
        `fill: ${colors.score}; stroke: ${colors.score};`,
      );
    }

    const innerSvg = rootSvg.querySelector(
      ".definition-scale",
    ) as SVGSVGElement | null;
    if (!innerSvg) return;

    const currentBboxMap = bboxCacheRef.current;

    // Selection Highlight (CSS based fallback)
    container.querySelectorAll("g.selected").forEach((el) => {
      el.classList.remove("selected");
      (el as SVGGraphicsElement).style.filter = "";
    });
    if (selectedId) {
      const el = container.querySelector(
        `g#${CSS.escape(selectedId)}`,
      ) as SVGGraphicsElement | null;
      if (el) {
        el.classList.add("selected");
      }
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

    const overlayColor = colors.overlay || "rgba(255, 0, 0, 0.2)";
    const caretColor = colors.caret || "#ff6b6b";

    for (const [_measureN, measureModel] of scoreModel) {
      const mBbox = currentBboxMap.get(measureModel.xmlId);
      if (mBbox && debugFilters.measure) {
        overlayLayer.appendChild(
          createOverlayRect(
            mBbox,
            "mf-overlay-measure",
            measureModel.xmlId,
            false,
            overlayColor,
          ),
        );
      }

      for (const [_staffN, staff] of measureModel.staves) {
        const sBbox = currentBboxMap.get(staff.xmlId);
        if (sBbox) {
          if (debugFilters.staff) {
            overlayLayer.appendChild(
              createOverlayRect(
                sBbox,
                "mf-overlay-staff",
                staff.xmlId,
                true,
                overlayColor,
              ),
            );
          } else {
            // Invisible interactive area for staff selection if needed
            overlayLayer.appendChild(
              createOverlayRect(
                sBbox,
                "mf-overlay-staff-hitbox",
                staff.xmlId,
                true,
                "transparent",
              ),
            );
          }
        }

        for (const [_lN, layer] of staff.layers) {
          for (const note of layer.notes) {
            const nBbox = currentBboxMap.get(note.id);
            if (!nBbox) continue;

            if (debugFilters.note) {
              overlayLayer.appendChild(
                createOverlayRect(
                  nBbox,
                  "mf-overlay-note",
                  note.id,
                  true,
                  overlayColor,
                ),
              );
            } else {
              overlayLayer.appendChild(
                createOverlayRect(
                  nBbox,
                  "mf-overlay-note-hitbox",
                  note.id,
                  true,
                  "transparent",
                ),
              );
            }

            if (debugFilters.caret && sBbox) {
              overlayLayer.appendChild(
                createCaret(nBbox.x, sBbox.y, sBbox.height, true, caretColor),
              );
            }
          }
        }
      }
    }

    // Caret for selection
    if (selectedId) {
      const elBbox = currentBboxMap.get(selectedId);
      if (elBbox) {
        // Find staff height
        const staffEl = container
          .querySelector(`g#${CSS.escape(selectedId)}`)
          ?.closest("g.staff");
        if (staffEl) {
          const sBbox = currentBboxMap.get(staffEl.id);
          if (sBbox) {
            overlayLayer.appendChild(
              createCaret(elBbox.x, sBbox.y, sBbox.height, false, caretColor),
            );
          }
        }
      }
    }
  }, [currentSvg, scoreModel, debugFilters, selectedId, colors]);

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const targetId = target.getAttribute("data-target-id");
    if (targetId) {
      onSelectionChange?.(targetId);
    } else {
      onSelectionChange?.(null);
    }
  };

  const svgHtml = useMemo(() => {
    return { __html: currentSvg || "" };
  }, [currentSvg]);

  const containerStyle: React.CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.background || "#fff",
    overflow: "hidden",
  };

  const svgAreaStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    cursor: "default",
    overflow: "auto",
    backgroundColor: "#fff",
    textAlign: "center", // Center score horizontally when Fit is Off
  };

  const loadingStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    zIndex: 100,
    fontSize: "1.2rem",
    fontWeight: "bold",
    color: colors.score || "#333",
    pointerEvents: "none",
  };

  return (
    <div style={containerStyle}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Interactive score canvas */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Interactive score canvas */}
      <div
        style={svgAreaStyle}
        ref={svgContainerRef}
        onClick={handleClick}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Verovio generated SVG
        dangerouslySetInnerHTML={svgHtml}
      />
      {(!tk || isRendering) && (
        <div style={loadingStyle}>
          {!tk ? "Loading Verovio..." : "Rendering…"}
        </div>
      )}
    </div>
  );
});
