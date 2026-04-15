import { describe, expect, it } from "vitest";
import { MeiFriend, MeiHead } from "../../src/index.js";

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
    const root = meiFriend.getRootElement()!;
    const head = new MeiHead(root);
    expect(head.getTitle()).toBe("My Work");
  });

  it("should return undefined if title is missing", () => {
    const xml = `<mei xmlns="http://www.music-encoding.org/ns/mei"><meiHead/></mei>`;
    const meiFriend = MeiFriend.fromXmlString(xml);
    const head = new MeiHead(meiFriend.getRootElement()!);
    expect(head.getTitle()).toBeUndefined();
  });

  it("should set the title and create structure if needed", () => {
    // Create initial structure
    const xml = `<mei xmlns="http://www.music-encoding.org/ns/mei"></mei>`;
    const friend = MeiFriend.fromXmlString(xml);
    const head = new MeiHead(friend.getRootElement()!);

    friend.update((tx) => head.setTitle(tx, "New Title"));

    expect(head.getTitle()).toBe("New Title");
    const serialized = friend.toXmlString(false);
    expect(serialized).toContain("<title>New Title</title>");
    expect(serialized).toContain("<titleStmt");
    expect(serialized).toContain("<fileDesc");
    expect(serialized).toContain("<meiHead");
  });

  it("should update an existing title", () => {
    const xml = `
<mei xmlns="http://www.music-encoding.org/ns/mei">
   <meiHead>
      <fileDesc>
         <titleStmt>
            <title>Old Title</title>
         </titleStmt>
      </fileDesc>
   </meiHead>
</mei>`;
    const meiFriend = MeiFriend.fromXmlString(xml);
    const head = new MeiHead(meiFriend.getRootElement()!);
    meiFriend.update((tx) => head.setTitle(tx, "Updated Title"));
    expect(head.getTitle()).toBe("Updated Title");
  });

  it("should work within an update transaction", () => {
    const xml = `<mei xmlns="http://www.music-encoding.org/ns/mei"></mei>`;
    const meiFriend = MeiFriend.fromXmlString(xml);
    const head = new MeiHead(meiFriend.getRootElement()!);

    const result = meiFriend.update((tx) => {
      head.setTitle(tx, "Transacted Title");
      return head.getTitle();
    });

    expect(result).toBe("Transacted Title");
    expect(head.getTitle()).toBe("Transacted Title");

    // Verify it's one undo step
    meiFriend.undo();
    expect(head.getTitle()).toBeUndefined();
  });
});
