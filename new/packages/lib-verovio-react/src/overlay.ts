import {
  type Cursor,
  isNavigable,
  type MeiFriend,
  type ScoreModel,
} from "@mei-friend/core";
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

export function getAdjustedStaffBBox(
  staffElement: SVGGElement | null,
  originalBBox: BBox | undefined,
  bboxMap: Map<string, BBox>,
): BBox | null {
  if (!staffElement || !originalBBox) return originalBBox ?? null;

  // 1. Get the 5 paths directly under staff
  const paths = Array.from(staffElement.children).filter(
    (el) => el.tagName.toLowerCase() === "path",
  ) as SVGPathElement[];

  if (paths.length === 0) return originalBBox;

  let highestY = Number.POSITIVE_INFINITY;
  let lowestY = Number.NEGATIVE_INFINITY;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;

  for (const path of paths) {
    const pathBBox = path.getBBox();
    if (pathBBox.y < highestY) highestY = pathBBox.y;
    if (pathBBox.y + pathBBox.height > lowestY)
      lowestY = pathBBox.y + pathBBox.height;
    if (pathBBox.x < minX) minX = pathBBox.x;
    if (pathBBox.x + pathBBox.width > maxX) maxX = pathBBox.x + pathBBox.width;
  }

  if (highestY === Number.POSITIVE_INFINITY) return originalBBox;

  // Height and vertical margins
  const staffHeight = lowestY - highestY;
  const margin = (staffHeight / 5) * 1.5;
  const adjustedTop = highestY - margin;
  const adjustedHeight = staffHeight + margin * 2;

  // Left and Right bounds
  // Find first event X
  let firstEventX = Number.POSITIVE_INFINITY;
  const layers = Array.from(staffElement.children).filter((el) =>
    el.classList.contains("layer"),
  );

  for (const layer of layers) {
    const events = Array.from(layer.children).filter(
      (el) =>
        el.classList.contains("note") ||
        el.classList.contains("rest") ||
        el.classList.contains("mRest") ||
        el.classList.contains("chord"),
    );
    for (const event of events) {
      const bbox = bboxMap.get(event.id);
      if (bbox && bbox.x < firstEventX) {
        firstEventX = bbox.x;
      }
    }
  }

  let leftEdge = minX;
  const signatures = Array.from(staffElement.children).filter(
    (el) =>
      el.classList.contains("clef") ||
      el.classList.contains("keySig") ||
      el.classList.contains("meterSig"),
  );

  for (const sig of signatures) {
    const sigBBox = bboxMap.get(sig.id);
    if (sigBBox) {
      if (sigBBox.x < firstEventX) {
        const sigRight = sigBBox.x + sigBBox.width;
        if (sigRight > leftEdge) {
          leftEdge = sigRight;
        }
      }
    }
  }

  return {
    x: leftEdge,
    y: adjustedTop,
    width: maxX - leftEdge,
    height: adjustedHeight,
  };
}

export function createOverlayRect(
  bbox: BBox,
  className: string,
  targetId: string,
  cursorType: "pointer" | "default" | "none" = "none",
  color = "rgba(255, 0, 0, 0.2)",
): SVGRectElement {
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", String(bbox.x));
  rect.setAttribute("y", String(bbox.y));
  rect.setAttribute("width", String(bbox.width));
  rect.setAttribute("height", String(bbox.height));
  rect.setAttribute("class", `mf-overlay ${className}`);
  rect.setAttribute("data-target-id", targetId);

  let pointerEventsStyle = "";
  if (cursorType === "none") {
    pointerEventsStyle = "pointer-events: none;";
  } else {
    pointerEventsStyle = `cursor: ${cursorType}; pointer-events: auto;`;
  }

  rect.setAttribute(
    "style",
    `fill: ${color}; stroke: none; ${pointerEventsStyle}`,
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
  meiFriend: MeiFriend,
  bboxMap: Map<string, BBox>,
  debugFilters: DebugFilters,
  selectedId: string | null,
  cursor: Cursor | null,
  colors: VerovioCanvasColors,
  highlightId: string | null = null,
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

  // Yellow highlight: directly color the target SVG element.
  // fill covers filled glyphs (noteheads, rests); color sets currentColor
  // which is used by stroke:currentColor (stems, barlines, etc.).
  container.querySelectorAll("g.mf-highlighted").forEach((el) => {
    el.classList.remove("mf-highlighted");
    (el as SVGGraphicsElement).style.fill = "";
    (el as SVGGraphicsElement).style.color = "";
  });
  if (highlightId) {
    const el = container.querySelector(
      `g#${CSS.escape(highlightId)}`,
    ) as SVGGraphicsElement | null;
    if (el) {
      el.classList.add("mf-highlighted");
      el.style.fill = "gold";
      el.style.color = "gold";
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
  const staffColor = colors.staffOverlay || overlayColor;
  const noteColor = colors.noteOverlay || overlayColor;
  const caretColor = colors.caret || "#ff6b6b";

  for (const measureModel of scoreModel.measures) {
    for (const [_staffN, staff] of measureModel.staves) {
      const rawSBbox = bboxMap.get(staff.id);
      let sBbox = rawSBbox;

      const staffElement = container.querySelector(
        `g#${CSS.escape(staff.id)}`,
      ) as SVGGElement | null;
      if (staffElement && rawSBbox) {
        sBbox =
          getAdjustedStaffBBox(staffElement, rawSBbox, bboxMap) || rawSBbox;
      }

      if (sBbox) {
        if (debugFilters.staff) {
          overlayLayer.appendChild(
            createOverlayRect(
              sBbox,
              "mf-overlay-staff",
              staff.id,
              "default",
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
              "default",
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
                "pointer",
                noteColor,
              ),
            );
          } else {
            overlayLayer.appendChild(
              createOverlayRect(
                nBbox,
                "mf-overlay-note-hitbox",
                note.id,
                "pointer",
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

  // Caret for cursor
  if (cursor) {
    const { measureIndex, staffN, offset } = cursor.position;
    const measure = scoreModel.getMeasure(measureIndex);
    if (measure) {
      const staff = measure.staves.get(staffN);
      if (staff) {
        const staffEl = container.querySelector(
          `g#${CSS.escape(staff.id)}`,
        ) as SVGGElement | null;
        const rawSBbox = bboxMap.get(staff.id);
        const sBbox =
          staffEl && rawSBbox
            ? getAdjustedStaffBBox(staffEl, rawSBbox, bboxMap) || rawSBbox
            : rawSBbox;

        if (sBbox) {
          const points: { offset: number; x: number }[] = [];
          const meter = meiFriend.api.getMeterAt(measureIndex);
          const measureLength = meter.beatType.value
            .mul(meter.beats)
            .toDouble();

          // Collect event points first
          const eventPoints = new Map<number, number>();
          for (const [_sN, mStaff] of measure.staves) {
            for (const [_lN, mLayer] of mStaff.layers) {
              for (const event of mLayer.events) {
                if (!isNavigable(meiFriend, event.id)) continue;
                const eBbox = bboxMap.get(event.id);
                if (eBbox) {
                  const off = event.offset.value.toDouble();
                  // For the same offset, we can just use the first one we find
                  if (!eventPoints.has(off)) {
                    eventPoints.set(off, eBbox.x);
                  }
                }
              }
            }
          }

          // Boundary: Offset 0
          const offset0X = eventPoints.get(0);
          if (offset0X !== undefined) {
            points.push({ offset: 0, x: offset0X });
          } else {
            points.push({ offset: 0, x: sBbox.x });
          }

          // Boundary: Measure End
          // The user requested staff's right edge. createCaret(x) draws from x-width to x.
          // So if we want the caret's right edge to be at staff right edge, we pass x = sBbox.x + sBbox.width.
          points.push({ offset: measureLength, x: sBbox.x + sBbox.width });

          // Add all other event points
          for (const [off, x] of eventPoints.entries()) {
            if (off > 0 && off < measureLength) {
              points.push({ offset: off, x });
            }
          }

          points.sort((a, b) => a.offset - b.offset);

          const targetOffset = offset.value.toDouble();
          const exactPoint = points.find(
            (p) => Math.abs(p.offset - targetOffset) < 1e-6,
          );

          let caretX: number;
          if (exactPoint) {
            caretX = exactPoint.x;
          } else {
            let prevPoint = points[0];
            for (const p of points) {
              if (p.offset <= targetOffset) prevPoint = p;
            }
            let nextPoint = points[points.length - 1];
            for (let i = points.length - 1; i >= 0; i--) {
              if (points[i].offset >= targetOffset) nextPoint = points[i];
            }

            if (prevPoint.offset === nextPoint.offset) {
              caretX = prevPoint.x;
            } else {
              const ratio =
                (targetOffset - prevPoint.offset) /
                (nextPoint.offset - prevPoint.offset);
              caretX = prevPoint.x + ratio * (nextPoint.x - prevPoint.x);
            }
          }

          overlayLayer.appendChild(
            createCaret(caretX, sBbox.y, sBbox.height, false, caretColor),
          );
        }
      }
    }
  }
}
