import { describe, expect, it } from "vitest";
import { type MeiChangeEvent, MeiFriend } from "../src/index.js";

describe("MeiFriend", () => {
  describe("Lifecycle & Serialization", () => {
    it("should create instance from XML string and serialize back", () => {
      const meiString = `<mei xmlns="http://www.music-encoding.org/ns/mei">
  test
</mei>\n`;
      const meiFriend = MeiFriend.fromXmlString(meiString);
      expect(meiFriend.toXmlString(false)).toBe(meiString);
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
      expect(meiFriend.toXmlString(false)).toBe(meiString);
    });

    it("should handle mixed content serialization", () => {
      const meiString = `<mei>
  <p>Text before <lb/> Text after</p>
</mei>\n`;
      const meiFriend = MeiFriend.fromXmlString(meiString);
      const output = meiFriend.toXmlString(false);
      expect(output).toContain("Text before");
      expect(output).toContain("<lb/>");
      expect(output).toContain("Text after");
    });

    it("should escape special characters in XML", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m1"/>');
      const root = meiFriend.getRootElement()!;
      meiFriend.update((tx) => {
        root.setAttribute(tx, "title", 'A & B "quoted"');
        root.setTextContent(tx, "5 < 10 & 10 > 5");
      });

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
      const note = meiFriend.getElementById("n-1")!;
      meiFriend.update((tx) => note.setAttribute(tx, "xml:id", "n-new"));

      expect(meiFriend.getElementById("n-new")).toBeDefined();
      expect(meiFriend.getElementById("n-1")).toBeUndefined();
    });

    it("should maintain tag index correctly after element removal", () => {
      const meiFriend = MeiFriend.fromXmlString(
        '<mei><note xml:id="n1"/><note xml:id="n2"/></mei>',
      );
      const n1 = meiFriend.getElementById("n1")!;
      meiFriend.update((tx) => n1.remove(tx));

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
      meiFriend.update((tx) => meiFriend.getElementById("m1")!.remove(tx));

      // The removed element should be gone from the index.
      expect(meiFriend.getElementById("m1")).toBeUndefined();
      expect(meiFriend.getElementsByTagName("music").length).toBe(0);
    });

    it("should handle extremely deep nesting for indexes", () => {
      const meiFriend = MeiFriend.fromXmlString("<mei/>");
      const root = meiFriend.getRootElement()!;
      meiFriend.update((tx) => {
        let current = root;
        for (let i = 0; i < 50; i++)
          current = current.appendElement(tx, "layer");
        current.setAttribute(tx, "xml:id", "deep-node");
      });
      expect(meiFriend.getElementById("deep-node")).toBeDefined();
      expect(meiFriend.getElementsByTagName("layer").length).toBe(50);
    });

    it("should NOT find newly created elements by ID until transaction completes", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m-1"/>');
      const root = meiFriend.getElementById("m-1")!;
      meiFriend.update((tx) => {
        const note = root.appendElement(tx, "note");
        note.setAttribute(tx, "xml:id", "n-internal");
        expect(meiFriend.getElementById("n-internal")).toBeUndefined();
      });
      expect(meiFriend.getElementById("n-internal")).toBeDefined();
    });
  });

  describe("Reactivity (onChange)", () => {
    it("should notify on attribute changes with origin and isLocal", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m-1"/>');
      const captured: MeiChangeEvent[] = [];
      meiFriend.onChange((events) => captured.push(...events));

      const root = meiFriend.getElementById("m-1")!;
      meiFriend.update((tx) => root.setAttribute(tx, "pname", "c"), "plugin-a");

      expect(captured.length).toBe(1);
      const change = captured[0].attributesChanged.get("pname");
      expect(change?.newValue).toBe("c");
      expect(captured[0].origin).toBe("plugin-a");
      expect(captured[0].isLocal).toBe(true);
    });

    it("should report newValue when an attribute is overwritten", () => {
      const meiFriend = MeiFriend.fromXmlString(
        '<mei xml:id="m1" attr="old"/>',
      );
      const captured: MeiChangeEvent[] = [];

      const root = meiFriend.getElementById("m1")!;
      meiFriend.onChange((events) => captured.push(...events));

      meiFriend.update((tx) => root.setAttribute(tx, "attr", "new"));

      expect(captured.length).toBeGreaterThan(0);
      const change = captured[0].attributesChanged.get("attr");
      expect(change?.newValue).toBe("new");
    });

    it("should notify on structural changes and text updates", () => {
      const meiFriend = MeiFriend.fromXmlString(
        '<mei xml:id="m-1"><note xml:id="n-1"/></mei>',
      );
      const captured: MeiChangeEvent[] = [];
      meiFriend.onChange((events) => captured.push(...events));

      const note = meiFriend.getElementById("n-1")!;
      meiFriend.update((tx) => note.setTextContent(tx, "C4"));

      expect(captured.some((e) => e.target.id === "n-1" && e.textChanged)).toBe(
        true,
      );
    });

    it("should allow unregistering the observer", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m-1"/>');
      let count = 0;
      const unsubscribe = meiFriend.onChange(() => {
        count++;
      });

      meiFriend.update((tx) =>
        meiFriend.getRootElement()?.setAttribute(tx, "a", "1"),
      );
      expect(count).toBe(1);

      unsubscribe();
      meiFriend.update((tx) =>
        meiFriend.getRootElement()?.setAttribute(tx, "a", "2"),
      );
      expect(count).toBe(1); // Should not increase
    });
  });

  describe("History Management", () => {
    it("should support undo and redo", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m-1"/>');
      const root = meiFriend.getElementById("m-1")!;

      meiFriend.update((tx) => root.setAttribute(tx, "label", "test"));
      expect(root.getAttribute("label")).toBe("test");

      meiFriend.undo();
      expect(root.getAttribute("label")).toBeUndefined();

      meiFriend.redo();
      expect(root.getAttribute("label")).toBe("test");
    });

    it("syncs indexes correctly after undo/redo", () => {
      const meiFriend = MeiFriend.fromXmlString("<mei/>");
      const root = meiFriend.getRootElement()!;

      meiFriend.update((tx) =>
        root.appendElement(tx, "note").setAttribute(tx, "xml:id", "n1"),
      );
      expect(meiFriend.getElementById("n1")).toBeDefined();

      meiFriend.undo();
      expect(meiFriend.getElementById("n1")).toBeUndefined();

      meiFriend.redo();
      expect(meiFriend.getElementById("n1")).toBeDefined();
    });
  });
});
