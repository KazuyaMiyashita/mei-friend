import { MeiFriend } from "@mei-friend/core";
import { describe, expect, it } from "vitest";
import { renderOverlays } from "../src/overlay";
import type { BBox } from "../src/types";

// Vite imports raw file contents
import sampleMei from "./fixtures/sample.mei?raw";
import sampleSvg from "./fixtures/sample.svg?raw";

describe("VerovioCanvas Overlays", () => {
  it("should render overlays without throwing an exception", () => {
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
        { measure: true, staff: true, note: true, caret: true },
        null,
        {},
      );
    }).not.toThrow();

    // Verify that the overlay layer was added
    const overlayLayer = innerSvg!.querySelector("#mf-overlay-layer");
    expect(overlayLayer).not.toBeNull();

    // Cleanup
    document.body.removeChild(container);
  });
});
