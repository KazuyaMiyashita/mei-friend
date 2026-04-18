import { describe, expect, it } from "vitest";
import { MeiFriend, MeiHead } from "../../../src/index.js";

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
    const xml = `<mei xmlns="http://www.music-encoding.org/ns/mei"><meiHead/></mei>`;
    const meiFriend = MeiFriend.fromXmlString(xml);
    const head = meiFriend.mei!.head!;
    expect(head.getTitle()).toBeUndefined();
  });

  it("should set the title and create structure if needed", () => {
    // Create initial structure
    const xml = `<mei xmlns="http://www.music-encoding.org/ns/mei" xml:id="m1"></mei>`;
    const meiFriend = MeiFriend.fromXmlString(xml);

    MeiHead.setTitleAtRoot(meiFriend.getRootElement()!, "New Title");

    expect(meiFriend.mei!.head!.getTitle()).toBe("New Title");
    const serialized = meiFriend.toXmlString(false);
    expect(serialized).toContain("New Title</title>");
    expect(serialized).toContain("<titleStmt");
    expect(serialized).toContain("<fileDesc");
    expect(serialized).toContain("<meiHead");
  });

  it("should update an existing title", () => {
    const xml = `
<mei xmlns="http://www.music-encoding.org/ns/mei" xml:id="m1">
   <meiHead>
      <fileDesc>
         <titleStmt>
            <title>Old Title</title>
         </titleStmt>
      </fileDesc>
   </meiHead>
</mei>`;
    const meiFriend = MeiFriend.fromXmlString(xml);
    const head = meiFriend.mei!.head!;
    head.setTitle("Updated Title");
    expect(head.getTitle()).toBe("Updated Title");
  });

  it("should work and be undoable", () => {
    const xml = `<mei xmlns="http://www.music-encoding.org/ns/mei" xml:id="m1"></mei>`;
    const meiFriend = MeiFriend.fromXmlString(xml);

    MeiHead.setTitleAtRoot(meiFriend.getRootElement()!, "Transacted Title");
    expect(meiFriend.mei!.head!.getTitle()).toBe("Transacted Title");

    // Verify it's completely undoable in a single step
    meiFriend.undo();

    // The header should be gone
    expect(meiFriend.mei!.head).toBeUndefined();
    // And the dynamically created <meiHead> structure should also be completely removed
    const rootChildren = meiFriend.getRootElement()!.children;
    expect(rootChildren.length).toBe(0);
  });
});
