import { describe, expect, it } from "vitest";
import { Duration, Offset, ScoreModel } from "../../src/models/index.js";

describe("ScoreModel", () => {
  const mockScore = new ScoreModel([
    {
      id: "m1",
      measureIndex: 0,
      measureN: "1",
      staves: new Map([
        [
          1,
          {
            id: "s1",
            staffN: 1,
            layers: new Map([
              [
                1,
                {
                  id: "l1",
                  layerN: 1,
                  events: [
                    {
                      id: "n1",
                      offset: Offset.of(0),
                      duration: Duration.of(1),
                    },
                    {
                      id: "n2",
                      offset: Offset.of(2),
                      duration: Duration.of(1),
                    },
                  ],
                },
              ],
            ]),
          },
        ],
      ]),
    },
  ]);

  it("getPositionById should return the correct position from idIndex", () => {
    // Manually build a score with idIndex for testing
    const idIndex = new Map([
      ["n1", { measureIndex: 0, staffN: 1, layerN: 1, offset: Offset.of(0) }],
      ["n2", { measureIndex: 0, staffN: 1, layerN: 1, offset: Offset.of(2) }],
    ]);
    const score = new ScoreModel(mockScore.measures, idIndex);

    const pos = score.getPositionById("n1");
    expect(pos).toBeDefined();
    if (pos && "offset" in pos) {
      expect(pos.measureIndex).toBe(0);
      expect(pos.offset.value.toDouble()).toBe(0);
    }
  });
});
