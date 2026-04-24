import { describe, expect, it } from "vitest";
import { Part } from "../../src/models/index.js";

describe("Part", () => {
  it("should create parts and spawn sub-parts", () => {
    const p = Part.of("Soprano");
    const sub = p.spawn("voice1");
    expect(sub.toString()).toBe("Soprano:voice1");
  });

  it("should check superset relationship", () => {
    const p = Part.of("Soprano");
    const sub = p.spawn("voice1");
    expect(p.isSupersetOf(sub)).toBe(true);
    expect(sub.isSupersetOf(p)).toBe(false);
  });

  it("should find common ancestor", () => {
    const p1 = Part.of("Orchestra", "Violin1");
    const p2 = Part.of("Orchestra", "Violin2");
    expect(Part.commonAncestor([p1, p2]).toString()).toBe("Orchestra");

    const p3 = Part.of("Piano");
    expect(Part.commonAncestor([p1, p3]).toString()).toBe("Root");
  });
});
