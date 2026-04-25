import { describe, expect, it } from "vitest";
import {
  Duration,
  Offset,
  ScoreModel,
  ScorePositionIterator,
} from "../../src/models/index.js";
import type { MeasureModel, Position } from "../../src/models/score.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(id: string, offset: number, duration = 1) {
  return {
    id,
    offset: Offset.of(offset),
    duration: Duration.of(1, duration),
  };
}

function makeLayer(
  id: string,
  layerN: number,
  eventDefs: { id: string; offset: number; duration?: number }[],
) {
  return {
    id,
    layerN,
    events: eventDefs.map((e) => makeEvent(e.id, e.offset, e.duration ?? 1)),
  };
}

/**
 * Two-measure score, each measure has one staff (staffN=1) with two layers.
 */
function makeTwoMeasureScore(): ScoreModel {
  const makeMeasure = (idx: number): MeasureModel => ({
    id: `m${idx}`,
    measureIndex: idx,
    measureN: String(idx + 1),
    staves: new Map([
      [
        1,
        {
          id: `m${idx}_s1`,
          staffN: 1,
          layers: new Map([
            [
              1,
              makeLayer(`m${idx}_l1`, 1, [
                { id: `n${idx}_l1_e0`, offset: 0 },
                { id: `n${idx}_l1_e1`, offset: 1 },
              ]),
            ],
            [
              2,
              makeLayer(`m${idx}_l2`, 2, [
                { id: `n${idx}_l2_e0`, offset: 0 },
                { id: `n${idx}_l2_e1`, offset: 1 },
              ]),
            ],
          ]),
        },
      ],
    ]),
  });

  return new ScoreModel([makeMeasure(0), makeMeasure(1)]);
}

function pos(measureIndex: number, offset: number, layerN = 1): Position {
  return { measureIndex, staffN: 1, layerN, offset: Offset.of(offset) };
}

function ids(iter: Iterable<{ id: string }>): string[] {
  return [...iter].map((e) => e.id);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ScorePositionIterator", () => {
  describe("direction: backward", () => {
    it("yields events at exactly position.offset (inclusive)", () => {
      const score = makeTwoMeasureScore();
      // offset=1 in measure 1, layer scope
      const result = ids(
        new ScorePositionIterator(score, pos(1, 1), {
          scope: "layer",
          direction: "backward",
        }),
      );
      // Should include n1_l1_e1 (offset=1) and then n1_l1_e0 (offset=0), then measure 0 events
      expect(result[0]).toBe("n1_l1_e1"); // offset 1 is included
      expect(result[1]).toBe("n1_l1_e0");
    });

    it("layer scope: only yields events from the specified layer", () => {
      const score = makeTwoMeasureScore();
      const result = ids(
        new ScorePositionIterator(score, pos(1, 1, 1), {
          scope: "layer",
          direction: "backward",
        }),
      );
      expect(result.every((id) => id.includes("_l1_"))).toBe(true);
    });

    it("staff scope: yields events from all layers of the staff", () => {
      const score = makeTwoMeasureScore();
      const result = ids(
        new ScorePositionIterator(score, pos(1, 1), {
          scope: "staff",
          direction: "backward",
        }),
      );
      expect(result.some((id) => id.includes("_l1_"))).toBe(true);
      expect(result.some((id) => id.includes("_l2_"))).toBe(true);
    });

    it("crosses measure boundaries from measure 1 to measure 0", () => {
      const score = makeTwoMeasureScore();
      const result = ids(
        new ScorePositionIterator(score, pos(1, 0), {
          scope: "layer",
          direction: "backward",
        }),
      );
      // Measure 1 events at offset=0 (inclusive), then all of measure 0
      expect(result).toContain("n1_l1_e0");
      expect(result).toContain("n0_l1_e1");
      expect(result).toContain("n0_l1_e0");
    });

    it("yields within a measure in descending offset order", () => {
      const score = makeTwoMeasureScore();
      const result = ids(
        new ScorePositionIterator(score, pos(0, 1), {
          scope: "layer",
          direction: "backward",
        }),
      );
      const offsets = [
        ...new ScorePositionIterator(score, pos(0, 1), {
          scope: "layer",
          direction: "backward",
        }),
      ].map((e) => e.offset.value.toDouble());
      // Each offset should be <= the previous
      for (let i = 1; i < offsets.length; i++) {
        expect(offsets[i]).toBeLessThanOrEqual(offsets[i - 1]);
      }
      void result;
    });

    it("from measure 0 offset 0 yields only that event (layer scope)", () => {
      const score = makeTwoMeasureScore();
      const result = ids(
        new ScorePositionIterator(score, pos(0, 0), {
          scope: "layer",
          direction: "backward",
        }),
      );
      expect(result).toEqual(["n0_l1_e0"]);
    });
  });

  describe("direction: forward", () => {
    it("yields events at exactly position.offset (inclusive)", () => {
      const score = makeTwoMeasureScore();
      const result = ids(
        new ScorePositionIterator(score, pos(0, 1), {
          scope: "layer",
          direction: "forward",
        }),
      );
      expect(result[0]).toBe("n0_l1_e1"); // offset 1 is included
    });

    it("layer scope: only yields events from the specified layer", () => {
      const score = makeTwoMeasureScore();
      const result = ids(
        new ScorePositionIterator(score, pos(0, 0, 2), {
          scope: "layer",
          direction: "forward",
        }),
      );
      expect(result.every((id) => id.includes("_l2_"))).toBe(true);
    });

    it("staff scope: yields events from all layers", () => {
      const score = makeTwoMeasureScore();
      const result = ids(
        new ScorePositionIterator(score, pos(0, 0), {
          scope: "staff",
          direction: "forward",
        }),
      );
      expect(result.some((id) => id.includes("_l1_"))).toBe(true);
      expect(result.some((id) => id.includes("_l2_"))).toBe(true);
    });

    it("crosses measure boundaries from measure 0 to measure 1", () => {
      const score = makeTwoMeasureScore();
      const result = ids(
        new ScorePositionIterator(score, pos(0, 1), {
          scope: "layer",
          direction: "forward",
        }),
      );
      expect(result).toContain("n0_l1_e1");
      expect(result).toContain("n1_l1_e0");
      expect(result).toContain("n1_l1_e1");
    });

    it("yields events within the same measure in ascending offset order", () => {
      const score = makeTwoMeasureScore();
      // Start at offset 0, measure 0 — collect only measure 0 events via staff scope
      // Measure 0 has events at offsets 0 and 1 in each layer.
      const events = [
        ...new ScorePositionIterator(score, pos(0, 0), {
          scope: "layer",
          direction: "forward",
        }),
      ].filter((e) => e.id.startsWith("n0_"));
      const offsets = events.map((e) => e.offset.value.toDouble());
      for (let i = 1; i < offsets.length; i++) {
        expect(offsets[i]).toBeGreaterThanOrEqual(offsets[i - 1]);
      }
    });

    it("from last event yields only that event (layer scope)", () => {
      const score = makeTwoMeasureScore();
      const result = ids(
        new ScorePositionIterator(score, pos(1, 1), {
          scope: "layer",
          direction: "forward",
        }),
      );
      expect(result).toEqual(["n1_l1_e1"]);
    });
  });

  describe("edge cases", () => {
    it("returns empty for unknown staffN", () => {
      const score = makeTwoMeasureScore();
      const result = ids(
        new ScorePositionIterator(
          score,
          { measureIndex: 0, staffN: 99, layerN: 1, offset: Offset.of(0) },
          { scope: "staff", direction: "backward" },
        ),
      );
      expect(result).toEqual([]);
    });

    it("returns empty for unknown layerN in layer scope", () => {
      const score = makeTwoMeasureScore();
      const result = ids(
        new ScorePositionIterator(
          score,
          { measureIndex: 0, staffN: 1, layerN: 99, offset: Offset.of(0) },
          { scope: "layer", direction: "backward" },
        ),
      );
      expect(result).toEqual([]);
    });
  });
});
