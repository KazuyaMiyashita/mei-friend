import { describe, expect, it } from "vitest";
import { type MeiChangeEvent, MeiFriend } from "../src/index.js";

describe("MeiFriend", () => {
  it("should create instance from XML string and serialize back", () => {
    const meiString = `<mei xmlns="http://www.music-encoding.org/ns/mei">
  test
</mei>
`;
    const meiFriend = MeiFriend.fromXmlString(meiString);
    expect(meiFriend.toXmlString(false)).toBe(meiString);
  });

  it("should handle nested elements and attributes", () => {
    const meiString = `<mei xmlns="http://www.music-encoding.org/ns/mei">
  <music>
    <body xml:id="b-1">
      <mRest/>
    </body>
  </music>
</mei>
`;
    const meiFriend = MeiFriend.fromXmlString(meiString);
    expect(meiFriend.toXmlString(false)).toBe(meiString);
  });

  it("should throw on invalid XML", () => {
    expect(() => MeiFriend.fromXmlString("<mei>unclosed")).toThrow();
  });

  it("should find elements by xml:id", () => {
    const meiString = `<mei>
  <note xml:id="n-1"/>
  <rest xml:id="r-1"/>
</mei>`;
    const meiFriend = MeiFriend.fromXmlString(meiString);
    const note = meiFriend.getElementById("n-1");
    expect(note).toBeDefined();
    expect(note?.tagName).toBe("note");
    const rest = meiFriend.getElementById("r-1");
    expect(rest).toBeDefined();
    expect(rest?.tagName).toBe("rest");
  });

  it("should find elements by tag name", () => {
    const meiString = `<mei>
  <section>
    <measure>
      <note xml:id="n-1" dur="4" oct="4" pname="c" />
      <note xml:id="n-2" dur="4" oct="4" pname="d" />
    </measure>
  </section>
</mei>`;
    const meiFriend = MeiFriend.fromXmlString(meiString);
    const notes = meiFriend.getElementsByTagName("note");
    expect(notes.length).toBe(2);

    expect(notes[0].getAttribute("xml:id")).toBe("n-1");
    expect(notes[0].getAttribute("dur")).toBe("4");
    expect(notes[0].getAttribute("oct")).toBe("4");
    expect(notes[0].getAttribute("pname")).toBe("c");

    expect(notes[1].getAttribute("xml:id")).toBe("n-2");
    expect(notes[1].getAttribute("dur")).toBe("4");
    expect(notes[1].getAttribute("oct")).toBe("4");
    expect(notes[1].getAttribute("pname")).toBe("d");
  });

  it("should add a new attribute via setAttribute", () => {
    const meiString = `<mei xml:id="m-1">
  <note xml:id="n-1"/>
</mei>
`;
    const meiFriend = MeiFriend.fromXmlString(meiString);
    const note = meiFriend.getElementById("n-1")!;
    meiFriend.update((tx) => note.setAttribute(tx, "pname", "c"));

    expect(meiFriend.toXmlString(false)).toBe(`<mei xml:id="m-1">
  <note xml:id="n-1" pname="c"/>
</mei>
`);

    expect(note.getAttribute("pname")).toBe("c");
  });

  it("should update an existing attribute via setAttribute", () => {
    const meiString = `<mei xml:id="m-1">
  <note xml:id="n-1" pname="c"/>
</mei>
`;
    const meiFriend = MeiFriend.fromXmlString(meiString);
    const note = meiFriend.getElementById("n-1")!;
    meiFriend.update((tx) => note.setAttribute(tx, "pname", "d"));

    expect(meiFriend.toXmlString(false)).toBe(`<mei xml:id="m-1">
  <note xml:id="n-1" pname="d"/>
</mei>
`);

    expect(note.getAttribute("pname")).toBe("d");
  });

  it("should remove an attribute via removeAttribute", () => {
    const meiString = `<mei xml:id="m-1">
  <note xml:id="n-1" pname="c"/>
</mei>
`;
    const meiFriend = MeiFriend.fromXmlString(meiString);
    const note = meiFriend.getElementById("n-1")!;
    meiFriend.update((tx) => note.removeAttribute(tx, "pname"));

    expect(meiFriend.toXmlString(false)).toBe(`<mei xml:id="m-1">
  <note xml:id="n-1"/>
</mei>
`);

    expect(note.getAttribute("pname")).toBeUndefined();
  });

  it("should handle element insertion and reactive index updates", () => {
    const meiString = '<mei xml:id="m-1"/>';
    const meiFriend = MeiFriend.fromXmlString(meiString);

    const root = meiFriend.getElementById("m-1")!;
    const music = meiFriend.update((tx) => {
      const el = root.appendElement(tx, "music");
      el.setAttribute(tx, "xml:id", "mus-1");
      return el;
    });

    // Check if it's in the XML
    expect(meiFriend.toXmlString(false)).toContain('<music xml:id="mus-1"/>');

    // Check if it's indexed (reactive update)
    expect(meiFriend.getElementById("mus-1")?.yNode).toBe(music.yNode);
  });

  it("should remove elements", () => {
    const meiString = `<mei xml:id="m-1">
  <note xml:id="n-1"/>
</mei>
`;
    const meiFriend = MeiFriend.fromXmlString(meiString);

    meiFriend.update((tx) => meiFriend.getElementById("n-1")?.remove(tx));

    expect(meiFriend.toXmlString(false)).toBe('<mei xml:id="m-1"/>\n');
  });

  it("should support undo and redo", () => {
    const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m-1"/>');
    const root = meiFriend.getElementById("m-1")!;

    meiFriend.update((tx) => root.setAttribute(tx, "label", "test"));
    expect(meiFriend.toXmlString(false)).toContain('label="test"');

    meiFriend.undo();
    expect(meiFriend.toXmlString(false)).not.toContain('label="test"');

    meiFriend.redo();
    expect(meiFriend.toXmlString(false)).toContain('label="test"');
  });

  it("should update idMap when xml:id changes", () => {
    const meiString = '<mei xml:id="m-1"><note xml:id="n-1"/></mei>';
    const meiFriend = MeiFriend.fromXmlString(meiString);
    const note = meiFriend.getElementById("n-1")!;

    // Change ID
    meiFriend.update((tx) => note.setAttribute(tx, "xml:id", "n-new"));

    // New ID should be searchable
    expect(meiFriend.getElementById("n-new")).toBeDefined();

    // Old ID should be gone
    expect(meiFriend.getElementById("n-1")).toBeUndefined();
  });

  it("should return all attributes via getAttributes", () => {
    const meiFriend = MeiFriend.fromXmlString('<mei p1="v1" p2="v2"/>');
    const root = meiFriend.getRootElement()!;
    const attrs = root.getAttributes();
    expect(attrs).toEqual({ p1: "v1", p2: "v2" });
  });

  it("should find elements by tag name within a scope", () => {
    const meiString = `
<mei>
  <music xml:id="m1">
    <note xml:id="n1"/>
  </music>
  <music xml:id="m2">
    <note xml:id="n2"/>
  </music>
</mei>`;
    const meiFriend = MeiFriend.fromXmlString(meiString);
    const m1 = meiFriend.getElementById("m1")!;
    const notesInM1 = m1.getElementsByTagName("note");
    expect(notesInM1.length).toBe(1);
    expect(notesInM1[0].id).toBe("n1");
  });

  it("should insert elements before others using insertBefore", () => {
    const meiFriend = MeiFriend.fromXmlString('<mei><note xml:id="n2"/></mei>');
    const root = meiFriend.getRootElement()!;
    const n2 = meiFriend.getElementById("n2")!;

    meiFriend.update((tx) =>
      root.insertBefore(tx, "note", n2).setAttribute(tx, "xml:id", "n1"),
    );

    expect(meiFriend.toXmlString(false)).toBe(`<mei>
  <note xml:id="n1"/>
  <note xml:id="n2"/>
</mei>
`);
  });

  it("should handle onChange event with custom abstraction", () => {
    const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m-1"/>');
    let capturedEvents: MeiChangeEvent[] = [];

    meiFriend.onChange((events) => {
      capturedEvents = events;
    });

    const root = meiFriend.getElementById("m-1")!;
    meiFriend.update((tx) => root.setAttribute(tx, "attr", "val"), "my-plugin");

    expect(capturedEvents.length).toBe(1);
    expect(capturedEvents[0].target.id).toBe("m-1");
    expect(capturedEvents[0].attributesChanged.get("attr")).toBe("val");
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

  it("should NOT find newly created elements by ID until the update block completes (Deferred Indexing)", () => {
    const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m-1"/>');
    const root = meiFriend.getElementById("m-1")!;

    meiFriend.update((tx) => {
      const note = root.appendElement(tx, "note");
      note.setAttribute(tx, "xml:id", "n-internal");

      // NG: This is expected to be undefined because the index is updated AFTER the transaction.
      expect(meiFriend.getElementById("n-internal")).toBeUndefined();
    });

    // OK: Now it should be searchable.
    expect(meiFriend.getElementById("n-internal")).toBeDefined();
    expect(meiFriend.getElementById("n-internal")?.tagName).toBe("note");
  });
});
