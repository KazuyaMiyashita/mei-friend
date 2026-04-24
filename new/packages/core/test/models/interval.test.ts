import { describe, expect, it } from "vitest";
import { Interval } from "../../src/models/index.js";

describe("Interval", () => {
  it("should normalize intervals upward correctly", () => {
    const m9 = Interval.parse("M9");
    expect(m9.normalize().toString()).toBe("M2");

    const m9desc = Interval.parse("-M9");
    // Should normalize upward to M2 according to the intended behavior
    expect(m9desc.normalize().toString()).toBe("M2");
  });
});
