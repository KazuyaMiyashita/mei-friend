import { describe, expect, it } from "vitest";
import { IdGenerator } from "../../src/utils/IdGenerator.js";

describe("IdGenerator", () => {
  it("should generate random IDs when no seed is provided", () => {
    const generator = new IdGenerator();
    const id1 = generator.generate("note");
    const id2 = generator.generate("note");
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^note-[a-z0-9]+$/);
  });

  it("should generate deterministic IDs when seed is provided", () => {
    const generator = new IdGenerator(42);
    expect(generator.generate("note")).toBe("note-42-1");
    expect(generator.generate("note")).toBe("note-42-2");
    expect(generator.generate("rest")).toBe("rest-42-3");
  });

  it("should assign IDs to all elements missing them", () => {
    const generator = new IdGenerator(123);
    const xml = "<mei><note/><note><accid/></note></mei>";
    const result = generator.assignIds(xml);

    expect(result).toContain('xml:id="mei-123-1"');
    expect(result).toContain('xml:id="note-123-2"');
    expect(result).toContain('xml:id="note-123-3"');
    expect(result).toContain('xml:id="accid-123-4"');

    // Check if it's still valid XML
    expect(result).toContain("</mei>");
    expect(result).toContain("</note>");
  });

  it("should preserve existing IDs", () => {
    const generator = new IdGenerator(123);
    const xml = '<mei xml:id="root"><note xml:id="n1"/><note/></mei>';
    const result = generator.assignIds(xml);

    expect(result).toContain('xml:id="root"');
    expect(result).toContain('xml:id="n1"');
    expect(result).toContain('xml:id="note-123-1"');
  });

  it("should force rootId if provided", () => {
    const generator = new IdGenerator(123);
    const xml = '<mei xml:id="old"><note/></mei>';
    const result = generator.assignIds(xml, "new-root");

    expect(result).toContain('xml:id="new-root"');
    expect(result).not.toContain('xml:id="old"');
  });
});
