import { beforeAll, describe, expect, it, vi } from "vitest";
import { IdGenerator, MeiFriend, type MeiUpdateEvent } from "../src/index.js";

describe("MeiFriend", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  describe("Lifecycle & Serialization", () => {
    it("should create instance from XML string and serialize back", () => {
      const meiString = `<mei xmlns="http://www.music-encoding.org/ns/mei">
  test
</mei>\n`;
      const meiFriend = MeiFriend.fromXmlString(meiString);
      const output = meiFriend.toXmlString(false);
      expect(output).toContain('xmlns="http://www.music-encoding.org/ns/mei"');
      expect(output).toContain("test");
      expect(output).toContain('xml:id="mei-');
    });

    it("should handle the includeDeclaration option in toXmlString", () => {
      const meiFriend = MeiFriend.fromXmlString("<mei/>");
      const xmlWithDec = meiFriend.toXmlString(true);
      expect(xmlWithDec).toContain('<?xml version="1.0" encoding="UTF-8"?>');

      const xmlWithoutDec = meiFriend.toXmlString(false);
      expect(xmlWithoutDec).not.toContain(
        '<?xml version="1.0" encoding="UTF-8"?>',
      );
    });

    it("should handle nested elements and attributes", () => {
      const meiString = `<mei xmlns="http://www.music-encoding.org/ns/mei">
  <music>
    <body xml:id="b-1">
      <mRest/>
    </body>
  </music>
</mei>\n`;
      const meiFriend = MeiFriend.fromXmlString(meiString);
      const output = meiFriend.toXmlString(false);
      expect(output).toContain('xml:id="b-1"');
      expect(output).toContain("<music");
      expect(output).toContain("<mRest");
    });

    it("should throw on invalid XML", () => {
      expect(() => MeiFriend.fromXmlString("<mei>unclosed")).toThrow(
        /unclosed xml tag/,
      );
    });

    it("should be able to destroy without throwing", () => {
      const meiFriend = MeiFriend.fromXmlString("<mei/>");
      expect(() => meiFriend.destroy()).not.toThrow();
    });
  });

  describe("Querying & Indexing", () => {
    it("should find elements by xml:id (O(1))", () => {
      const meiString = `<mei>
  <note xml:id="n-1"/>
  <rest xml:id="r-1"/>
</mei>`;
      const meiFriend = MeiFriend.fromXmlString(meiString);
      const note = meiFriend.getElementById("n-1");
      expect(note?.tagName).toBe("note");
      expect(meiFriend.getElementById("r-1")?.tagName).toBe("rest");
    });

    it("should find elements by tag name globally (O(1))", () => {
      const meiString = `<mei>
  <note xml:id="n1"/>
  <note xml:id="n2"/>
  <rest/>
</mei>`;
      const meiFriend = MeiFriend.fromXmlString(meiString);
      expect(meiFriend.getElementsByTagName("note").length).toBe(2);
      expect(meiFriend.getElementsByTagName("rest").length).toBe(1);
    });

    it("should update idMap when xml:id changes (internal sync)", () => {
      const xml = `<mei xml:id="m1"><note xml:id="n1"/></mei>`;
      const meiFriend = MeiFriend.fromXmlString(xml);

      // We can't change ID via update("n1", ...) because update checks for ID mismatch.
      // But we can change it via update("m1", ...) which replaces the whole child structure.
      meiFriend.update("m1", '<mei xml:id="m1"><note xml:id="n-new"/></mei>');

      expect(meiFriend.getElementById("n-new")).toBeDefined();
      expect(meiFriend.getElementById("n1")).toBeUndefined();
    });

    it("should maintain tag index correctly after element removal", () => {
      const meiFriend = MeiFriend.fromXmlString(
        '<mei xml:id="m1"><note xml:id="n1"/><note xml:id="n2"/></mei>',
      );
      // Remove n1 by updating parent m1
      meiFriend.update("m1", '<mei xml:id="m1"><note xml:id="n2"/></mei>');

      expect(meiFriend.getElementsByTagName("note").length).toBe(1);
      expect(meiFriend.getElementsByTagName("note")[0].id).toBe("n2");
    });

    it("should handle deep nesting for indexes", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m1"/>');

      // Update with deep structure
      const deepXml = `
<mei xml:id="m1">
  <layer xml:id="l1">
    <layer xml:id="l2">
      <note xml:id="deep-node"/>
    </layer>
  </layer>
</mei>`;
      meiFriend.update("m1", deepXml);

      expect(meiFriend.getElementById("deep-node")).toBeDefined();
      expect(meiFriend.getElementsByTagName("layer").length).toBe(2);
    });
  });

  describe("Reactivity (onUpdate)", () => {
    it("should notify on updates with origin and isLocal", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m1"/>');
      const captured: MeiUpdateEvent[] = [];
      meiFriend.onUpdate((events) => captured.push(...events));

      meiFriend.update("m1", '<mei xml:id="m1" pname="c"/>', "plugin-a");

      expect(captured.length).toBeGreaterThan(0);
      expect(captured[0].type).toBe("element-update");
      expect(captured[0].xmlId).toBe("m1");
      expect(captured[0].xmlString).toContain('pname="c"');
      expect(captured[0].origin).toBe("plugin-a");
      expect(captured[0].isLocal).toBe(true);
    });

    it("should report correctly when child elements or text change", () => {
      const meiFriend = MeiFriend.fromXmlString(
        '<mei xml:id="m1"><note xml:id="n1"/></mei>',
      );
      const captured: MeiUpdateEvent[] = [];
      meiFriend.onUpdate((events) => captured.push(...events));

      // Structural change by adding child to n1
      meiFriend.update("n1", '<note xml:id="n1"><accid xml:id="a1"/></note>');
      expect(captured.some((e) => e.xmlId === "n1")).toBe(true);
      const n1Event = captured.find((e) => e.xmlId === "n1");
      expect(n1Event?.type).toBe("element-update");
      expect(n1Event?.xmlString).toContain("<accid");

      captured.length = 0;

      // Text change
      meiFriend.update("a1", '<accid xml:id="a1">sharp</accid>');
      expect(
        captured.some((e) => e.xmlId === "a1" && e.xmlString.includes("sharp")),
      ).toBe(true);
    });

    it("should emit a single document-replace event on replaceXmlString", () => {
      const meiFriend = MeiFriend.fromXmlString(
        '<mei xml:id="m1"><note xml:id="n1"/></mei>',
      );
      const captured: MeiUpdateEvent[] = [];
      meiFriend.onUpdate((events) => captured.push(...events));

      meiFriend.replaceXmlString(
        '<mei xml:id="m2"><rest xml:id="r1"/></mei>',
        "test-origin",
      );

      expect(captured.length).toBe(1);
      expect(captured[0].type).toBe("document-replace");
      expect(captured[0].xmlId).toBe("m2");
      expect(captured[0].xmlString).toContain("<rest");
      expect(captured[0].origin).toBe("test-origin");
      expect(captured[0].isLocal).toBe(true);
    });
  });

  describe("History Management", () => {
    it("should support undo and redo", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m1"/>');
      const root = meiFriend.getElementById("m1")!;

      meiFriend.update("m1", '<mei xml:id="m1" label="test"/>');
      expect(root.getAttribute("label")).toBe("test");

      meiFriend.undo();
      expect(root.getAttribute("label")).toBeUndefined();

      meiFriend.redo();
      expect(root.getAttribute("label")).toBe("test");
    });

    it("syncs indexes correctly after undo/redo", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m1"/>');

      meiFriend.update("m1", '<mei xml:id="m1"><note xml:id="n1"/></mei>');
      expect(meiFriend.getElementById("n1")).toBeDefined();

      meiFriend.undo();
      expect(meiFriend.getElementById("n1")).toBeUndefined();

      meiFriend.redo();
      expect(meiFriend.getElementById("n1")).toBeDefined();
    });

    it("should auto-assign root ID in update if missing", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m1"/>');
      // Should NOT throw, should use "m1" for root
      meiFriend.update("m1", "<mei/>");
      expect(meiFriend.getElementById("m1")).toBeDefined();
    });

    it("should auto-assign child ID in update if missing", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m1"/>');
      // Should NOT throw, should assign an ID to <note>
      meiFriend.update("m1", '<mei xml:id="m1"><note/></mei>');
      const root = meiFriend.getRootElement()!;
      expect(root.children.length).toBe(1);
      expect(root.children[0].id).toBeDefined();
    });

    it("should succeed with IdGenerator utility", () => {
      const generator = new IdGenerator();
      const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m1"/>');

      // This would fail without assignIds
      const newXml = generator.assignIds("<mei><note/></mei>", "m1");
      meiFriend.update("m1", newXml);

      const root = meiFriend.getRootElement()!;
      expect(root.children.length).toBe(1);
      expect(root.children[0].id).toBeDefined();
    });
  });
});
