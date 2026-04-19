import { describe, expect, it } from "vitest";
import { MeiFriend } from "../../../src/index.js";

describe("MeiHead API", () => {
  it("should get the title from a complete MEI document", () => {
    const xml = `<?xml version='1.0' encoding='UTF-8'?>
<mei meiversion="5.1" xmlns="http://www.music-encoding.org/ns/mei">
   <meiHead xml:id="m1q140to">
      <fileDesc xml:id="fins004">
         <titleStmt xml:id="t86pxl6">
            <title>My Work</title>
         </titleStmt>
      </fileDesc>
   </meiHead>
</mei>`;
    const meiFriend = MeiFriend.fromXmlString(xml);
    const head = meiFriend.mei!.head!;
    expect(head.getTitle()).toBe("My Work");
  });

  it("should return undefined if title is missing", () => {
    const xml = `<mei xmlns="http://www.music-encoding.org/ns/mei" xml:id="m1"><meiHead xml:id="h1"/></mei>`;
    const meiFriend = MeiFriend.fromXmlString(xml);
    const head = meiFriend.mei!.head!;
    expect(head.getTitle()).toBeUndefined();
  });

  it("should update an existing title using MeiFriend.update", () => {
    const xml = `
<mei xmlns="http://www.music-encoding.org/ns/mei" xml:id="m1">
   <meiHead xml:id="h1">
      <fileDesc xml:id="fd1">
         <titleStmt xml:id="ts1">
            <title xml:id="t1">Old Title</title>
         </titleStmt>
      </fileDesc>
   </meiHead>
</mei>`;
    const meiFriend = MeiFriend.fromXmlString(xml);

    // Perform update
    meiFriend.update("t1", '<title xml:id="t1">Updated Title</title>');

    expect(meiFriend.mei!.head!.getTitle()).toBe("Updated Title");
  });

  it("should work and be undoable as a single step", () => {
    // Due to yjs's default behavior, undo operations consolidate changes made within 500ms into a single operation.

    const xml = `<mei xmlns="http://www.music-encoding.org/ns/mei" xml:id="m1"></mei>`;
    const meiFriend = MeiFriend.fromXmlString(xml);

    expect(meiFriend.canUndo).toBe(false);

    // 1. Create structure by replacing root <mei>
    const newMeiXml = `
<mei xmlns="http://www.music-encoding.org/ns/mei" xml:id="m1">
  <meiHead xml:id="h1">
    <fileDesc xml:id="fd1">
      <titleStmt xml:id="ts1">
        <title xml:id="t1">Transacted Title</title>
      </titleStmt>
    </fileDesc>
  </meiHead>
</mei>`;
    meiFriend.update("m1", newMeiXml);

    expect(meiFriend.mei!.head!.getTitle()).toBe("Transacted Title");
    expect(meiFriend.canUndo).toBe(true);

    // 2. Perform another update
    meiFriend.update("t1", '<title xml:id="t1">Updated Title</title>');
    expect(meiFriend.mei!.head!.getTitle()).toBe("Updated Title");

    // Undo 2nd update
    meiFriend.undo();
    expect(meiFriend.mei!.head!.getTitle()).toBe("Transacted Title");

    // Undo 1st update
    meiFriend.undo();
    expect(meiFriend.mei!.head).toBeUndefined();
    expect(meiFriend.getRootElement()!.children.length).toBe(0);
    expect(meiFriend.canUndo).toBe(false);
  });

  it("should fail if tag name mismatches in update", () => {
    const xml = `<mei xmlns="http://www.music-encoding.org/ns/mei" xml:id="m1"><meiHead xml:id="h1"/></mei>`;
    const meiFriend = MeiFriend.fromXmlString(xml);
    expect(() =>
      meiFriend.update("h1", '<fileDesc xml:id="h1"/>'),
    ).toThrowError(/Tag name mismatch/);
  });

  it("should fail if ID mismatches in update", () => {
    const xml = `<mei xmlns="http://www.music-encoding.org/ns/mei" xml:id="m1"><meiHead xml:id="h1"/></mei>`;
    const meiFriend = MeiFriend.fromXmlString(xml);
    expect(() =>
      meiFriend.update("h1", '<meiHead xml:id="wrong-id"/>'),
    ).toThrowError(/ID mismatch/);
  });
});
