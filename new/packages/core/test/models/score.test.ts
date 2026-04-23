import { describe, expect, it } from "vitest";
import {
  Cursor,
  Duration,
  Offset,
  ScoreModel,
} from "../../src/models/index.js";

describe("Cursor", () => {
  const mockScore = new ScoreModel([
    {
      id: "m1",
      measureIndex: 0,
      measureN: "1",
      meter: { beats: 4, beatType: Duration.of(1) }, // 4/4
      totalDuration: Duration.of(3),
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
                      isNavigable: true,
                    },
                    {
                      id: "n2",
                      offset: Offset.of(2),
                      duration: Duration.of(1),
                      isNavigable: true,
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

  it("nextBeat should jump to next beat boundary", () => {
    const c1 = new Cursor(mockScore, {
      measureIndex: 0,
      staffN: 1,
      layerN: 1,
      offset: Offset.of(0),
    });
    expect(c1.nextBeat().position.offset.value.toDouble()).toBe(1);

    const c2 = new Cursor(mockScore, {
      measureIndex: 0,
      staffN: 1,
      layerN: 1,
      offset: Offset.of(1, 2), // 0.5
    });
    expect(c2.nextBeat().position.offset.value.toDouble()).toBe(1);

    const c3 = new Cursor(mockScore, {
      measureIndex: 0,
      staffN: 1,
      layerN: 1,
      offset: Offset.of(1),
    });
    expect(c3.nextBeat().position.offset.value.toDouble()).toBe(2);
  });

  it("prevBeat should jump to previous beat boundary", () => {
    const c1 = new Cursor(mockScore, {
      measureIndex: 0,
      staffN: 1,
      layerN: 1,
      offset: Offset.of(2),
    });
    expect(c1.prevBeat().position.offset.value.toDouble()).toBe(1);

    const c2 = new Cursor(mockScore, {
      measureIndex: 0,
      staffN: 1,
      layerN: 1,
      offset: Offset.of(3, 2), // 1.5
    });
    expect(c2.prevBeat().position.offset.value.toDouble()).toBe(1);

    const c3 = new Cursor(mockScore, {
      measureIndex: 0,
      staffN: 1,
      layerN: 1,
      offset: Offset.of(1),
    });
    expect(c3.prevBeat().position.offset.value.toDouble()).toBe(0);
  });

  it("snapToBeat should align to nearest preceding beat strictly by beatType", () => {
    // In 4/4 (beatType 1)
    // At 0.5: nearest beat is 0.0
    const c1 = new Cursor(mockScore, {
      measureIndex: 0,
      staffN: 1,
      layerN: 1,
      offset: Offset.of(1, 2),
    });
    expect(c1.snapToBeat().position.offset.value.toDouble()).toBe(0);

    // At 1.5: nearest beat is 1.0
    const c2 = new Cursor(mockScore, {
      measureIndex: 0,
      staffN: 1,
      layerN: 1,
      offset: Offset.of(3, 2),
    });
    expect(c2.snapToBeat().position.offset.value.toDouble()).toBe(1);

    // At 1.0: already snapped
    const c3 = new Cursor(mockScore, {
      measureIndex: 0,
      staffN: 1,
      layerN: 1,
      offset: Offset.of(1),
    });
    expect(c3.snapToBeat()).toBe(c3);
  });

  it("snapToEvent should align to nearest preceding navigable event", () => {
    // events at 0 and 2
    // At 0.5: nearest event is 0.0
    const c1 = new Cursor(mockScore, {
      measureIndex: 0,
      staffN: 1,
      layerN: 1,
      offset: Offset.of(1, 2),
    });
    expect(c1.snapToEvent().position.offset.value.toDouble()).toBe(0);

    // At 2.5: nearest event is 2.0
    const c2 = new Cursor(mockScore, {
      measureIndex: 0,
      staffN: 1,
      layerN: 1,
      offset: Offset.of(5, 2),
    });
    expect(c2.snapToEvent().position.offset.value.toDouble()).toBe(2);

    // At 2.0: already snapped
    const c3 = new Cursor(mockScore, {
      measureIndex: 0,
      staffN: 1,
      layerN: 1,
      offset: Offset.of(2),
    });
    expect(c3.snapToEvent()).toBe(c3);

    // If no events before, snap to 0 (already covered by Offset.of(0) logic)
  });
});
