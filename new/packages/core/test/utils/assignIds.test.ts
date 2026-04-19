import { describe, expect, it } from "vitest";
import { assignIds } from "../../src/utils/assignIds.js";

describe("assignIds", () => {
  it("should assign IDs to all elements missing them", () => {
    const xml = "<mei><note/><note><accid/></note></mei>";
    const result = assignIds(xml);

    expect(result).toContain('xml:id="mei-');
    expect(result).toContain('xml:id="note-');
    expect(result).toContain('xml:id="accid-');

    // Check if it's still valid XML
    expect(result).toContain("</mei>");
    expect(result).toContain("</note>");
  });

  it("should preserve existing IDs", () => {
    const xml = '<mei xml:id="root"><note xml:id="n1"/><note/></mei>';
    const result = assignIds(xml);

    expect(result).toContain('xml:id="root"');
    expect(result).toContain('xml:id="n1"');
    expect(result).toContain('xml:id="note-');
  });

  it("should force rootId if provided", () => {
    const xml = '<mei xml:id="old"><note/></mei>';
    const result = assignIds(xml, "new-root");

    expect(result).toContain('xml:id="new-root"');
    expect(result).not.toContain('xml:id="old"');
  });
});
