import { describe, expect, it } from "vitest";
import { Duration, Offset, Span } from "../../src/models/index.js";

describe("Duration", () => {
  it("should create and add durations correctly", () => {
    const d1 = Duration.of(1, 4);
    const d2 = Duration.of(1, 2);
    expect(d1.add(d2).toString()).toBe("d=3/4");
  });
});

describe("Offset", () => {
  it("should create and add offsets correctly", () => {
    const o1 = Offset.of(1, 4);
    const o2 = Offset.of(1, 2);
    expect(o1.add(o2).toString()).toBe("3/4");
  });
});

describe("Span", () => {
  it("should create spans correctly", () => {
    const span = new Span(Offset.of(0), Offset.of(1));
    expect(span.toString()).toBe("Span(0 ~ 1)");
  });

  it("should throw on invalid span", () => {
    expect(() => new Span(Offset.of(1), Offset.of(0))).toThrow();
  });
});
