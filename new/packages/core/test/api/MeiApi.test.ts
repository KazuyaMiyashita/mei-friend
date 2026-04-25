import { describe, expect, it } from "vitest";
import { MeiFriend } from "../../src/MeiFriend.js";
import type { Position } from "../../src/models/score.js";

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

  describe("Musical Logic", () => {
    it("getKeyAt should find mid-measure key changes", () => {
      const xml = `
        <mei xmlns="http://www.music-encoding.org/ns/mei">
          <music><body><mdiv><score>
            <scoreDef><staffGrp><staffDef n="1"><keySig sig="0"/></staffDef></staffGrp></scoreDef>
            <section>
              <measure xml:id="m1">
                <staff n="1">
                  <layer n="1">
                    <note xml:id="n1" dur="4" pname="c" oct="4"/>
                    <keySig xml:id="ks1" sig="1s"/>
                    <note xml:id="n2" dur="4" pname="g" oct="4"/>
                  </layer>
                </staff>
              </measure>
            </section>
          </score></mdiv></body></music>
        </mei>
      `;
      const friend = MeiFriend.fromXmlString(xml);
      const score = friend.getScoreModel();

      const pos1 = score.getPositionById("n1")! as Position;
      const key1 = friend.api.getKeyAt(pos1);
      expect(key1.signatureNum()).toBe(0);

      const pos2 = score.getPositionById("n2")! as Position;
      const key2 = friend.api.getKeyAt(pos2);
      expect(key2.signatureNum()).toBe(1);
    });
  });
});
