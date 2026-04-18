import type { ScoreModel } from "@mei-friend/core";
import type { BBox, DebugFilters, VerovioCanvasColors } from "./types.js";

export function applySvgFitStyles(
  container: HTMLElement,
  fitMode: "off" | "width" | "height",
) {
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
}

export function createOverlayRect(
  bbox: BBox,
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

export function createCaret(
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

export function renderOverlays(
  container: HTMLElement,
  scoreModel: ScoreModel,
  bboxMap: Map<string, BBox>,
  debugFilters: DebugFilters,
  selectedId: string | null,
  colors: VerovioCanvasColors,
) {
  const rootSvg = container.querySelector("svg") as SVGSVGElement | null;
  if (!rootSvg) {
    return;
  }

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
  if (!innerSvg) {
    return;
  }

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
  let overlayLayer = innerSvg.querySelector(`#${CSS.escape(baseClass)}-layer`);
  if (!overlayLayer) {
    overlayLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
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
  const measureColor = colors.measureOverlay || overlayColor;
  const staffColor = colors.staffOverlay || overlayColor;
  const noteColor = colors.noteOverlay || overlayColor;
  const caretColor = colors.caret || "#ff6b6b";

  for (const measureModel of scoreModel.measures) {
    const mBbox = bboxMap.get(measureModel.id);
    if (mBbox) {
      if (debugFilters.measure) {
        overlayLayer.appendChild(
          createOverlayRect(
            mBbox,
            "mf-overlay-measure",
            measureModel.id,
            true, // Make interactive so it can be clicked
            measureColor,
          ),
        );
      } else {
        overlayLayer.appendChild(
          createOverlayRect(
            mBbox,
            "mf-overlay-measure-hitbox",
            measureModel.id,
            true,
            "transparent",
          ),
        );
      }
    }

    for (const [_staffN, staff] of measureModel.staves) {
      const sBbox = bboxMap.get(staff.id);
      if (sBbox) {
        if (debugFilters.staff) {
          overlayLayer.appendChild(
            createOverlayRect(
              sBbox,
              "mf-overlay-staff",
              staff.id,
              true,
              staffColor,
            ),
          );
        } else {
          // Invisible interactive area for staff selection if needed
          overlayLayer.appendChild(
            createOverlayRect(
              sBbox,
              "mf-overlay-staff-hitbox",
              staff.id,
              true,
              "transparent",
            ),
          );
        }
      }

      for (const [_lN, layer] of staff.layers) {
        for (const note of layer.events) {
          const nBbox = bboxMap.get(note.id);
          if (!nBbox) continue;

          if (debugFilters.note) {
            overlayLayer.appendChild(
              createOverlayRect(
                nBbox,
                "mf-overlay-note",
                note.id,
                true,
                noteColor,
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
    const elBbox = bboxMap.get(selectedId);
    if (elBbox) {
      // Find staff height
      const staffEl = container
        .querySelector(`g#${CSS.escape(selectedId)}`)
        ?.closest("g.staff");
      if (staffEl) {
        const sBbox = bboxMap.get(staffEl.id);
        if (sBbox) {
          overlayLayer.appendChild(
            createCaret(elBbox.x, sBbox.y, sBbox.height, false, caretColor),
          );
        }
      }
    }
  }
}
