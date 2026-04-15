import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { MeiFriend } from "../src/index.js";

describe("MeiFriend", () => {
  it("should create instance from XML string and serialize back", () => {
    const meiString = `<mei xmlns="http://www.music-encoding.org/ns/mei">
  test
</mei>
`;
    const mei = MeiFriend.fromXmlString(meiString);
    expect(mei.toXmlString()).toBe(meiString);
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
    const mei = MeiFriend.fromXmlString(meiString);
    expect(mei.toXmlString()).toBe(meiString);
  });

  it("should throw on invalid XML", () => {
    expect(() => MeiFriend.fromXmlString("<mei>unclosed")).toThrow();
  });

  it("should find elements by xml:id", () => {
    const meiString = `<mei>
  <note xml:id="n-1"/>
  <rest xml:id="r-1"/>
</mei>`;
    const mei = MeiFriend.fromXmlString(meiString);
    const note = mei.getElementById("n-1");
    expect(note).toBeDefined();
    expect(note?.nodeName).toBe("note");
    const rest = mei.getElementById("r-1");
    expect(rest).toBeDefined();
    expect(rest?.nodeName).toBe("rest");
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
    const mei = MeiFriend.fromXmlString(meiString);
    const notes = mei.getElementsByTagName("note");
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
    const mei = MeiFriend.fromXmlString(meiString);
    mei.setAttribute("n-1", "pname", "c");

    expect(mei.toXmlString()).toBe(`<mei xml:id="m-1">
  <note xml:id="n-1" pname="c"/>
</mei>
`);

    // Also verify internal model state
    const note = mei.getElementById("n-1");
    expect(note?.getAttribute("pname")).toBe("c");
  });

  it("should update an existing attribute via setAttribute", () => {
    const meiString = `<mei xml:id="m-1">
  <note xml:id="n-1" pname="c"/>
</mei>
`;
    const mei = MeiFriend.fromXmlString(meiString);
    mei.setAttribute("n-1", "pname", "d"); // Change 'c' to 'd'

    expect(mei.toXmlString()).toBe(`<mei xml:id="m-1">
  <note xml:id="n-1" pname="d"/>
</mei>
`);

    // Also verify internal model state
    const note = mei.getElementById("n-1");
    expect(note?.getAttribute("pname")).toBe("d");
  });

  it("should remove an attribute via removeAttribute", () => {
    const meiString = `<mei xml:id="m-1">
  <note xml:id="n-1" pname="c"/>
</mei>
`;
    const mei = MeiFriend.fromXmlString(meiString);
    mei.removeAttribute("n-1", "pname");

    expect(mei.toXmlString()).toBe(`<mei xml:id="m-1">
  <note xml:id="n-1"/>
</mei>
`);

    // Also verify internal model state
    const note = mei.getElementById("n-1");
    expect(note?.getAttribute("pname")).toBeUndefined();
  });

  it("should handle element insertion and reactive index updates", () => {
    const meiString = '<mei xml:id="m-1"/>';
    const mei = MeiFriend.fromXmlString(meiString);

    const music = new Y.XmlElement("music");
    music.setAttribute("xml:id", "mus-1");

    mei.insertElement("m-1", music);

    // Check if it's in the XML
    expect(mei.toXmlString()).toContain('<music xml:id="mus-1"/>');

    // Check if it's indexed (reactive update)
    expect(mei.getElementById("mus-1")).toBe(music);
  });

  it("should remove elements", () => {
    const meiString = `<mei xml:id="m-1">
  <note xml:id="n-1"/>
</mei>
`;
    const mei = MeiFriend.fromXmlString(meiString);

    mei.removeElement("n-1");

    expect(mei.toXmlString()).toBe('<mei xml:id="m-1"/>\n');
  });

  it("should support undo and redo", () => {
    const mei = MeiFriend.fromXmlString('<mei xml:id="m-1"/>');

    mei.setAttribute("m-1", "label", "test");
    expect(mei.toXmlString()).toContain('label="test"');

    mei.undoManager.undo();
    expect(mei.toXmlString()).not.toContain('label="test"');

    mei.undoManager.redo();
    expect(mei.toXmlString()).toContain('label="test"');
  });

  it("should handle transaction origin", () => {
    const mei = MeiFriend.fromXmlString('<mei xml:id="m-1"/>');
    let capturedOrigin: unknown = null;

    mei.onChange((_events, transaction) => {
      capturedOrigin = transaction.origin;
    });

    mei.setAttribute("m-1", "attr", "val", "my-plugin");
    expect(capturedOrigin).toBe("my-plugin");
  });
});
