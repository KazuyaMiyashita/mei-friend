import { describe, expect, it } from "vitest";
import { MeiFriend } from "../../src/MeiFriend.js";
import { Chord, Note } from "../../src/models/containers.js";
import type { NoteInfo } from "../../src/models/score.js";

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

      // Apply titleAppended
      const newRoot = meiFriend.api.titleAppended("New Score Title");

      // Update the document
      meiFriend.update("m1", newRoot.toXmlString());

      // Verify via API
      expect(meiFriend.api.getTitle()).toBe("New Score Title");

      // Check structural integrity via XML
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

      const newRoot = meiFriend.api.titleAppended("Updated Title");
      meiFriend.update("m1", newRoot.toXmlString());

      expect(meiFriend.api.getTitle()).toBe("Updated Title");

      // xml:id should be preserved if it existed (or at least the structure is maintained)
      expect(meiFriend.toXmlString()).toContain('xml:id="title1"');
      expect(meiFriend.toXmlString()).toContain("Updated Title");
    });
  });

  describe("Score Conversion (from old Mei.test.ts)", () => {
    it("should extract tempo and meter from MEI", () => {
      const xml = `<mei xmlns="http://www.music-encoding.org/ns/mei" xml:id="m1">
        <music>
          <body>
            <mdiv>
              <score>
                <scoreDef meter.count="3" meter.unit="4">
                  <staffGrp>
                    <staffDef n="1" label="Piano"/>
                  </staffGrp>
                </scoreDef>
                <section>
                  <tempo midi.bpm="120"/>
                </section>
              </score>
            </mdiv>
          </body>
        </music>
      </mei>`;
      const meiFriend = MeiFriend.fromXmlString(xml);
      expect(meiFriend.api.tempos[0].bpm).toBe(120);
      expect(meiFriend.api.meter?.beats).toBe(3);
    });

    it("should parse notes and convert to Score model", () => {
      const xml = `<mei xmlns="http://www.music-encoding.org/ns/mei" xml:id="m1">
        <music>
          <body>
            <mdiv>
              <score>
                <section>
                  <measure n="1">
                    <staff n="1">
                      <layer n="1">
                        <note xml:id="n1" dur="4" oct="4" pname="c"/>
                        <note xml:id="n2" dur="4" oct="4" pname="d"/>
                      </layer>
                    </staff>
                  </measure>
                </section>
              </score>
            </mdiv>
          </body>
        </music>
      </mei>`;
      const meiFriend = MeiFriend.fromXmlString(xml);
      const scoreModel = meiFriend.api.toScore();

      expect(scoreModel).not.toBeInstanceOf(Chord);

      const leaves = Array.from(scoreModel).filter(
        (e) => e instanceof Note,
      ) as Note<NoteInfo>[];
      expect(leaves.length).toBe(2);

      expect(leaves[0].duration.value.n).toBe(1);
      expect(leaves[0].value.value.toString()).toBe("C4");
      expect(leaves[0].value.id).toBe("n1");
    });

    it("should handle chords and ties", () => {
      const xml = `<mei xmlns="http://www.music-encoding.org/ns/mei" xml:id="m1">
        <music>
          <body>
            <mdiv>
              <score>
                <section>
                  <measure n="1">
                    <staff n="1">
                      <layer n="1">
                        <chord dur="2">
                          <note xml:id="c1" oct="4" pname="e"/>
                          <note xml:id="c2" oct="4" pname="g"/>
                        </chord>
                      </layer>
                    </staff>
                  </measure>
                  <tie startid="#c1" endid="#c3"/>
                  <measure n="2">
                    <staff n="1">
                      <layer n="1">
                        <note xml:id="c3" dur="2" oct="4" pname="e"/>
                      </layer>
                    </staff>
                  </measure>
                </section>
              </score>
            </mdiv>
          </body>
        </music>
      </mei>`;
      const meiFriend = MeiFriend.fromXmlString(xml);
      const scoreModel = meiFriend.api.toScore();

      const noteC1 = Array.from(scoreModel).find(
        (e) => e instanceof Note && e.value.id === "c1",
      ) as Note<NoteInfo>;
      expect(noteC1).toBeDefined();
      expect(noteC1.value.isTieStarted).toBe(true);

      const noteC3 = Array.from(scoreModel).find(
        (e) => e instanceof Note && e.value.id === "c3",
      ) as Note<NoteInfo>;
      expect(noteC3).toBeDefined();
      expect(noteC3.value.isTieEnded).toBe(true);
    });
  });
});
