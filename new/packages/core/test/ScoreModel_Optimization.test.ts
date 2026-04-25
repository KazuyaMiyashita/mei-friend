import { describe, expect, it } from "vitest";
import { MeiFriend } from "../src/MeiFriend.js";

describe("ScoreModel Optimization", () => {
  const xml = `
    <mei xmlns="http://www.music-encoding.org/ns/mei">
      <music>
        <body>
          <mdiv>
            <score>
              <section>
                <measure xml:id="m1" n="1">
                  <staff n="1">
                    <layer n="1">
                      <note xml:id="n1" dur="4" pname="c" oct="4"/>
                      <note xml:id="n2" dur="4" pname="d" oct="4"/>
                    </layer>
                  </staff>
                </measure>
                <measure xml:id="m2" n="2">
                  <staff n="1">
                    <layer n="1">
                      <note xml:id="n3" dur="4" pname="e" oct="4"/>
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

  it("should perform incremental update when a note attribute changes", () => {
    const friend = MeiFriend.fromXmlString(xml);
    const score1 = friend.getScoreModel();
    const m1_1 = score1.getMeasure(0)!;
    const m2_1 = score1.getMeasure(1)!;

    // Update note n1 (pitch change)
    friend.updateXmlString(
      "n1",
      '<note xml:id="n1" dur="4" pname="e" oct="4"/>',
    );

    const score2 = friend.getScoreModel();
    const m1_2 = score2.getMeasure(0)!;
    const m2_2 = score2.getMeasure(1)!;

    // Measure 1 should have been rebuilt
    expect(m1_2).not.toBe(m1_1);
    expect(m1_2.id).toBe("m1");

    // Measure 2 should be the EXACT SAME object instance (cache reuse)
    expect(m2_2).toBe(m2_1);
  });

  it("should full rebuild when a measure is added", () => {
    const friend = MeiFriend.fromXmlString(xml);

    // Easier: replace the whole score structure
    friend.replaceXmlString(
      xml.replace("</section>", '<measure xml:id="m3" n="3"/></section>'),
    );

    const score2 = friend.getScoreModel();
    expect(score2.measures.length).toBe(3);
    // Since it was a document-replace, it should be a full rebuild.
  });

  it("idIndex should provide O(1) lookup", () => {
    const friend = MeiFriend.fromXmlString(xml);
    const score = friend.getScoreModel();

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      score.getPositionById("n3");
    }
    const end = performance.now();
    // This should be extremely fast
    expect(end - start).toBeLessThan(10); // 10ms for 1000 lookups is generous

    const pos = score.getPositionById("n3");
    expect(pos).toBeDefined();
    expect(pos?.measureIndex).toBe(1);
    if (pos && "offset" in pos) {
      expect(pos.offset.value.toDouble()).toBe(0);
    }
  });
});
