import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  addElement,
  MeiFriend,
  type MeiUpdateEvent,
  removeElement,
  setAttribute,
  setTextContent,
} from "../src/index.js";

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

    it("should handle mixed content serialization and preserve whitespace precisely", () => {
      const meiString = `<mei>
  <p>Text before <lb xml:id="lb-1"/> Text after</p>
</mei>\n`;
      const meiFriend = MeiFriend.fromXmlString(meiString);
      const output = meiFriend.toXmlString(false);
      expect(output).toMatch(
        /<p xml:id="p-[a-z0-9]+">Text before <lb xml:id="lb-1"\/> Text after<\/p>/,
      );
    });

    it("should escape special characters in XML", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m1"/>');
      meiFriend.update([
        setAttribute("m1", "title", 'A & B "quoted"'),
        setTextContent("m1", "5 < 10 & 10 > 5"),
      ]);

      const xml = meiFriend.toXmlString(false);
      expect(xml).toContain('title="A &amp; B &quot;quoted&quot;"');
      expect(xml).toContain("5 &lt; 10 &amp; 10 &gt; 5");
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

    it("should update idMap when xml:id changes", () => {
      const meiFriend = MeiFriend.fromXmlString(
        '<mei><note xml:id="n-1"/></mei>',
      );
      meiFriend.update(setAttribute("n-1", "xml:id", "n-new"));

      expect(meiFriend.getElementById("n-new")).toBeDefined();
      expect(meiFriend.getElementById("n-1")).toBeUndefined();
    });

    it("should maintain tag index correctly after element removal", () => {
      const meiFriend = MeiFriend.fromXmlString(
        '<mei><note xml:id="n1"/><note xml:id="n2"/></mei>',
      );
      meiFriend.update(removeElement("n1"));

      expect(meiFriend.getElementsByTagName("note").length).toBe(1);
      expect(meiFriend.getElementsByTagName("note")[0].id).toBe("n2");
    });

    it("should remove elements from indexes when removed", () => {
      const meiFriend = MeiFriend.fromXmlString(
        '<mei><music xml:id="m1"><body xml:id="b1"/></music></mei>',
      );

      expect(meiFriend.getElementById("m1")).toBeDefined();
      expect(meiFriend.getElementsByTagName("music").length).toBe(1);

      // Perform removal
      meiFriend.update(removeElement("m1"));

      // The removed element should be gone from the index.
      expect(meiFriend.getElementById("m1")).toBeUndefined();
      expect(meiFriend.getElementsByTagName("music").length).toBe(0);
    });

    it("should handle extremely deep nesting for indexes", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m1"/>');
      let parentId = "m1";
      for (let i = 0; i < 50; i++) {
        const id = i === 49 ? "deep-node" : `l-${i}`;
        meiFriend.update(addElement(parentId, "layer", id));
        parentId = id;
      }
      expect(meiFriend.getElementById("deep-node")).toBeDefined();
      expect(meiFriend.getElementsByTagName("layer").length).toBe(50);
    });

    it("should find newly created elements by ID after transaction completes", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m-1"/>');
      meiFriend.update(addElement("m-1", "note", "n-internal"));
      expect(meiFriend.getElementById("n-internal")).toBeDefined();
    });
  });

  describe("Reactivity (onUpdate)", () => {
    it("should notify on attribute updates with origin and isLocal", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m-1"/>');
      const captured: MeiUpdateEvent[] = [];
      meiFriend.onUpdate((events) => captured.push(...events));

      meiFriend.update(setAttribute("m-1", "pname", "c"), "plugin-a");

      expect(captured.length).toBe(1);
      const update = captured[0].attributesChanged.get("pname");
      expect(update?.newValue).toBe("c");
      expect(captured[0].origin).toBe("plugin-a");
      expect(captured[0].isLocal).toBe(true);
    });

    it("should report newValue when an attribute is overwritten", () => {
      const meiFriend = MeiFriend.fromXmlString(
        '<mei xml:id="m1" attr="old"/>',
      );
      const captured: MeiUpdateEvent[] = [];

      meiFriend.onUpdate((events) => captured.push(...events));

      meiFriend.update(setAttribute("m1", "attr", "new"));

      expect(captured.length).toBeGreaterThan(0);
      const update = captured[0].attributesChanged.get("attr");
      expect(update?.newValue).toBe("new");
    });

    it("should notify on structural updates and text updates independently", () => {
      const meiFriend = MeiFriend.fromXmlString(
        '<mei xml:id="m-1"><note xml:id="n-1"/></mei>',
      );
      const captured: MeiUpdateEvent[] = [];
      meiFriend.onUpdate((events) => captured.push(...events));

      // Structural change (should not flag textChanged)
      meiFriend.update(addElement("n-1", "accid", "a-1"));
      expect(captured.length).toBe(1);
      expect(captured[0].addedElements.length).toBe(1);
      expect(captured[0].textChanged).toBe(false);

      captured.length = 0; // Clear array

      // Text change
      meiFriend.update(setTextContent("a-1", "sharp"));

      expect(captured.some((e) => e.target.id === "a-1" && e.textChanged)).toBe(
        true,
      );
    });

    it("should allow unregistering the observer", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m-1"/>');
      let count = 0;
      const unsubscribe = meiFriend.onUpdate(() => {
        count++;
      });

      meiFriend.update(setAttribute("m-1", "a", "1"));
      expect(count).toBe(1);

      unsubscribe();
      meiFriend.update(setAttribute("m-1", "a", "2"));
      expect(count).toBe(1); // Should not increase
    });
  });

  describe("History Management", () => {
    it("should support undo and redo", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m-1"/>');
      const root = meiFriend.getElementById("m-1")!;

      meiFriend.update(setAttribute("m-1", "label", "test"));
      expect(root.getAttribute("label")).toBe("test");

      meiFriend.undo();
      expect(root.getAttribute("label")).toBeUndefined();

      meiFriend.redo();
      expect(root.getAttribute("label")).toBe("test");
    });

    it("syncs indexes correctly after undo/redo", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m1"/>');

      meiFriend.update(addElement("m1", "note", "n1"));
      expect(meiFriend.getElementById("n1")).toBeDefined();

      meiFriend.undo();
      expect(meiFriend.getElementById("n1")).toBeUndefined();

      meiFriend.redo();
      expect(meiFriend.getElementById("n1")).toBeDefined();
    });
  });
});
