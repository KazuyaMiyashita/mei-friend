import { describe, expect, it } from "vitest";
import { MeiFriend } from "../src/index.js";

describe("MeiFriend", () => {
  it("should store an id", () => {
    const mei = new MeiFriend("test-id");
    expect(mei.getId()).toBe("test-id");
  });
});
