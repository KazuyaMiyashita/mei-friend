import { describe, expect, it } from "vitest";
import { TiesIndex } from "../../src/models/score.js";

describe("TiesIndex", () => {
  it("should correctly index start and end IDs with tie IDs", () => {
    const ties = [
      { id: "t1", startId: "n1", endId: "n2" },
      { id: "t2", startId: "n3" },
      { id: "t3", endId: "n4" },
    ];
    const index = new TiesIndex(ties);

    expect(index.hasStartId("n1")).toBe(true);
    expect(index.getTieIdByStartId("n1")).toBe("t1");
    expect(index.hasEndId("n2")).toBe(true);
    expect(index.getTieIdByEndId("n2")).toBe("t1");

    expect(index.hasStartId("n3")).toBe(true);
    expect(index.getTieIdByStartId("n3")).toBe("t2");

    expect(index.hasEndId("n4")).toBe(true);
    expect(index.getTieIdByEndId("n4")).toBe("t3");

    expect(index.hasStartId("n2")).toBe(false);
    expect(index.hasEndId("n1")).toBe(false);
  });

  it("should handle missing tie IDs by using empty string", () => {
    const index = new TiesIndex([{ startId: "n1" }]);
    expect(index.hasStartId("n1")).toBe(true);
    expect(index.getTieIdByStartId("n1")).toBe("");
  });
});
