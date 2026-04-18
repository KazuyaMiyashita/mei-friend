import { MeiFriend } from "@mei-friend/core";
import { describe, expect, it } from "vitest";
import { renderOverlays } from "../src/overlay";
import type { BBox } from "../src/types";

// Vite imports raw file contents
import sampleMei from "./fixtures/sample.mei?raw";
import sampleSvg from "./fixtures/sample.svg?raw";

describe("VerovioCanvas Overlays", () => {
  it("should render overlays and adjust staff and caret boundaries correctly", () => {
    // 1. Create ScoreModel from MEI
    const meiFriend = MeiFriend.fromXmlString(sampleMei);
    const scoreModel = meiFriend.getScoreModel();

    // 2. Set up DOM
    const container = document.createElement("div");
    container.innerHTML = sampleSvg;
    document.body.appendChild(container);

    // 3. Calculate BBox Map
    const rootSvg = container.querySelector("svg");
    expect(rootSvg).not.toBeNull();
    const innerSvg = rootSvg!.querySelector(".definition-scale");
    expect(innerSvg).not.toBeNull();

    const bboxMap = new Map<string, BBox>();
    const elements = Array.from(innerSvg!.querySelectorAll("g[id]"));

    for (const el of elements) {
      // In Vitest browser mode, getBBox() works because it runs in a real browser
      const bbox = (el as SVGGraphicsElement).getBBox();
      bboxMap.set(el.id, {
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
      });
    }

    // 4. Call renderOverlays and ensure no exception
    expect(() => {
      renderOverlays(
        container,
        scoreModel,
        bboxMap,
        { staff: true, note: true, caret: true },
        "n-1-1-2", // set selectedId to a note to verify caret height
        {},
      );
    }).not.toThrow();

    // Verify that the overlay layer was added
    const overlayLayer = innerSvg!.querySelector("#mf-overlay-layer");
    expect(overlayLayer).not.toBeNull();

    // Verify Staff Overlay Dimensions for staff "s-1-1"
    const staffRect = overlayLayer!.querySelector(
      '.mf-overlay-staff[data-target-id="s-1-1"]',
    ) as SVGRectElement;
    expect(staffRect).not.toBeNull();

    const y = Number.parseFloat(staffRect.getAttribute("y")!);
    const height = Number.parseFloat(staffRect.getAttribute("height")!);

    // For s-1-1, top line is 1269, bottom line is 1989.
    // staffHeight = 720. margin = (720 / 5) * 1.5 = 216.
    // top (y) should be 1269 - 216 = 1053
    // height should be 720 + 216 * 2 = 1152
    expect(y).toBeCloseTo(1053, -1);
    expect(height).toBeCloseTo(1152, -1);

    const x = Number.parseFloat(staffRect.getAttribute("x")!);
    const width = Number.parseFloat(staffRect.getAttribute("width")!);

    // minX is 0. but signatures (clef, keySig, meterSig) push leftEdge.
    // meterSig ends around 1445 based on translating 1283 and its width.
    // So x should be substantially larger than 1200.
    expect(x).toBeGreaterThan(1200);
    // Right edge is 4288
    expect(x + width).toBeCloseTo(4288, -1);

    // Verify Caret
    // Since we selected "n-1-1-2" in the first staff, the active caret should exist
    const caretRect = overlayLayer!.querySelector(
      ".mf-overlay-caret",
    ) as SVGRectElement;
    expect(caretRect).not.toBeNull();

    const caretHeight = Number.parseFloat(caretRect.getAttribute("height")!);
    expect(caretHeight).toBeCloseTo(1152, -1);

    // Verify measure overlay is gone
    const measureRect = overlayLayer!.querySelector(".mf-overlay-measure");
    expect(measureRect).toBeNull();

    // Cleanup
    document.body.removeChild(container);
  });
});
