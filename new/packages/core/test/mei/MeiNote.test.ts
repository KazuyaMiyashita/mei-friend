import { describe, expect, it } from "vitest";
import { MeiFriend } from "../../src/MeiFriend.js";
import { MeiNote } from "../../src/mei/events/MeiNote.js";
import { MeiRest } from "../../src/mei/events/MeiRest.js";

describe("MeiNote and MeiRest duration with tuplets", () => {
  it("should calculate correct duration for notes in a tuplet", () => {
    const xml = `
      <mei xmlns="http://www.music-encoding.org/ns/mei">
        <music>
          <body>
            <mdiv>
              <score>
                <section>
                  <measure>
                    <staff>
                      <layer>
                        <tuplet xml:id="t1" num="3" numbase="2">
                          <note xml:id="n1" dur="4" pname="c" oct="4"/>
                          <note xml:id="n2" dur="4" pname="d" oct="4"/>
                          <note xml:id="n3" dur="4" pname="e" oct="4"/>
                        </tuplet>
                      </layer> staff>
                    </staff>
                  </measure>
                </section>
              </score>
            </mdiv>
          </body>
        </music>
      </mei>
    `;
    const meiFriend = MeiFriend.fromXmlString(xml);
    const noteElement = meiFriend.getElementById("n1");
    expect(noteElement).toBeDefined();

    const meiNote = MeiNote.create(noteElement!)!;
    // 1 quarter note * 2 / 3 = 2/3
    expect(meiNote.duration).toBeDefined();
    expect(meiNote.duration!.value.n).toBe(2);
    expect(meiNote.duration!.value.d).toBe(3);
  });

  it("should handle nested tuplets", () => {
    const xml = `
      <mei xmlns="http://www.music-encoding.org/ns/mei">
        <music>
          <body>
            <mdiv>
              <score>
                <section>
                  <measure>
                    <staff>
                      <layer>
                        <tuplet num="3" numbase="2">
                          <note dur="4" pname="c" oct="4"/>
                          <tuplet num="3" numbase="2">
                             <note xml:id="n_nested" dur="8" pname="d" oct="4"/>
                          </tuplet>
                        </tuplet>
                      </layer>
                    </staff>
                  </measure>
                </section>
              </score>
            </mdiv>
          </body>
        </music>
      </mei>
    `;
    const meiFriend = MeiFriend.fromXmlString(xml);
    const noteElement = meiFriend.getElementById("n_nested");
    const meiNote = MeiNote.create(noteElement!)!;

    // Base dur 8 -> 1/2 quarter note
    // Outer tuplet 3:2 -> * 2/3
    // Inner tuplet 3:2 -> * 2/3
    // 1/2 * 2/3 * 2/3 = 1/2 * 4/9 = 2/9
    expect(meiNote.duration!.value.n).toBe(2);
    expect(meiNote.duration!.value.d).toBe(9);
  });

  it("should calculate correct duration for rests in a tuplet", () => {
    const xml = `
      <mei xmlns="http://www.music-encoding.org/ns/mei">
        <music>
          <body>
            <mdiv>
              <score>
                <section>
                  <measure>
                    <staff>
                      <layer>
                        <tuplet num="3" numbase="2">
                          <rest xml:id="r1" dur="4"/>
                          <rest xml:id="r2" dur="4"/>
                          <rest xml:id="r3" dur="4"/>
                        </tuplet>
                      </layer>
                    </staff>
                  </measure>
                </section>
              </score>
            </mdiv>
          </body>
        </music>
      </mei>
    `;
    const meiFriend = MeiFriend.fromXmlString(xml);
    const restElement = meiFriend.getElementById("r1");
    const meiRest = MeiRest.create(restElement!)!;

    expect(meiRest.duration!.value.n).toBe(2);
    expect(meiRest.duration!.value.d).toBe(3);
  });
});
