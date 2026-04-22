import { describe, expect, it } from "vitest";
import { MeiFriend } from "../../src/MeiFriend.js";

describe("MeiApi", () => {
  describe("Title Management", () => {
    it("should return undefined if no title exists", () => {
      const xml = `<mei xmlns="http://www.music-encoding.org/ns/mei" xml:id="m1"></mei>`;
      const meiFriend = MeiFriend.fromXmlString(xml);
      expect(meiFriend.api.getTitle()).toBeUndefined();
    });

    it("should append a title to an empty MEI document and retrieve it", () => {
      const xml = `<mei xmlns="http://www.music-encoding.org/ns/mei" xml:id="m1"></mei>`;
      const meiFriend = MeiFriend.fromXmlString(xml);

      meiFriend.updateElement(meiFriend.api.withTitle("New Score Title"));

      expect(meiFriend.api.getTitle()).toBe("New Score Title");

      const xmlString = meiFriend.toXmlString();
      expect(xmlString).toContain("<meiHead");
      expect(xmlString).toContain("<fileDesc");
      expect(xmlString).toContain("<titleStmt");
      expect(xmlString).toContain("New Score Title");
    });

    it("should update an existing title", () => {
      const xml = `
        <mei xmlns="http://www.music-encoding.org/ns/mei" xml:id="m1">
          <meiHead xml:id="h1">
            <fileDesc xml:id="f1">
              <titleStmt xml:id="t1">
                <title xml:id="title1">Old Title</title>
              </titleStmt>
            </fileDesc>
          </meiHead>
        </mei>`;
      const meiFriend = MeiFriend.fromXmlString(xml);
      expect(meiFriend.api.getTitle()).toBe("Old Title");

      meiFriend.updateElement(meiFriend.api.withTitle("Updated Title"));

      expect(meiFriend.api.getTitle()).toBe("Updated Title");

      expect(meiFriend.toXmlString()).toContain('xml:id="title1"');
      expect(meiFriend.toXmlString()).toContain("Updated Title");
    });
  });
});
