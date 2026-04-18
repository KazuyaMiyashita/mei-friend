import { describe, expect, it } from "vitest";
import { MeiFriend } from "../../src/MeiFriend.js";
import { Chord, Note } from "../../src/models/containers.js";
import type { NoteInfo } from "../../src/models/score.js";

describe("MeiScore extraction", () => {
  it("should extract tempo and meter from MEI", () => {
    const xml = `<mei xmlns="http://www.music-encoding.org/ns/mei">
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
    const score = meiFriend.mei!;

    expect(score.tempos[0].bpm).toBe(120);
  });

  it("should parse notes and convert to Score model", () => {
    const xml = `<mei xmlns="http://www.music-encoding.org/ns/mei">
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
    const scoreModel = meiFriend.mei!.toScore();

    // With one part, it should return a Melody directly
    expect(scoreModel).not.toBeInstanceOf(Chord);

    // The structure returned by staffsToNotes is a Melody of Melody of notes...
    // Let's check the leaves.
    const leaves = Array.from(scoreModel).filter(
      (e) => e instanceof Note,
    ) as Note<NoteInfo>[];
    expect(leaves.length).toBe(2);

    expect(leaves[0].duration.value.n).toBe(1);
    expect(leaves[0].value.value.toString()).toBe("C4");
    expect(leaves[0].value.id).toBe("n1");

    expect(leaves[1].duration.value.n).toBe(1);
    expect(leaves[1].value.value.toString()).toBe("D4");
    expect(leaves[1].value.id).toBe("n2");
  });

  it("should handle chords and ties", () => {
    const xml = `<mei xmlns="http://www.music-encoding.org/ns/mei">
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
    const scoreModel = meiFriend.mei!.toScore();

    // Find note with id c1
    const noteC1 = Array.from(scoreModel).find(
      (e) => e instanceof Note && e.value.id === "c1",
    ) as Note<NoteInfo>;
    expect(noteC1).toBeDefined();
    expect(noteC1.value.isTieStarted).toBe(true);
    expect(noteC1.value.isTieEnded).toBe(false);

    // Find note with id c3
    const noteC3 = Array.from(scoreModel).find(
      (e) => e instanceof Note && e.value.id === "c3",
    ) as Note<NoteInfo>;
    expect(noteC3).toBeDefined();
    expect(noteC3.value.isTieStarted).toBe(false);
    expect(noteC3.value.isTieEnded).toBe(true);
  });
});
