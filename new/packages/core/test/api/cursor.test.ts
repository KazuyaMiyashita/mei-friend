import { describe, expect, it } from "vitest";
import { Cursor } from "../../src/api/Cursor.js";
import { MeiFriend } from "../../src/MeiFriend.js";
import { Offset } from "../../src/models/index.js";

describe("Cursor API", () => {
  const xml = `
    <mei xmlns="http://www.music-encoding.org/ns/mei">
      <meiHead><fileDesc><titleStmt><title/></titleStmt></fileDesc></meiHead>
      <music>
        <body>
          <mdiv>
            <score>
              <scoreDef meter.count="4" meter.unit="4"/>
              <section>
                <measure xml:id="m1" n="1">
                  <staff n="1">
                    <layer n="1">
                      <note xml:id="n1" dur="4" pname="c" oct="4"/>
                      <note xml:id="n2" dur="4" pname="d" oct="4"/>
                      <note xml:id="n3" dur="4" pname="e" oct="4"/>
                      <note xml:id="n4" dur="4" pname="f" oct="4"/>
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

  it("nextBeat should jump to next beat boundary", () => {
    const friend = MeiFriend.fromXmlString(xml);
    const scoreModel = friend.getScoreModel();

    const c1 = new Cursor(friend, scoreModel, {
      measureIndex: 0,
      staffN: 1,
      layerN: 1,
      offset: Offset.of(0),
    });
    // In 4/4, next beat from 0 is 1
    expect(c1.nextBeat().position.offset.value.toDouble()).toBe(1);

    const c2 = new Cursor(friend, scoreModel, {
      measureIndex: 0,
      staffN: 1,
      layerN: 1,
      offset: Offset.of(1, 2), // 0.5
    });
    expect(c2.nextBeat().position.offset.value.toDouble()).toBe(1);

    const c3 = new Cursor(friend, scoreModel, {
      measureIndex: 0,
      staffN: 1,
      layerN: 1,
      offset: Offset.of(1),
    });
    expect(c3.nextBeat().position.offset.value.toDouble()).toBe(2);
  });

  it("snapToBeat should align to nearest preceding beat", () => {
    const friend = MeiFriend.fromXmlString(xml);
    const scoreModel = friend.getScoreModel();

    const c1 = new Cursor(friend, scoreModel, {
      measureIndex: 0,
      staffN: 1,
      layerN: 1,
      offset: Offset.of(1, 2), // 0.5
    });
    expect(c1.snapToBeat().position.offset.value.toDouble()).toBe(0);

    const c2 = new Cursor(friend, scoreModel, {
      measureIndex: 0,
      staffN: 1,
      layerN: 1,
      offset: Offset.of(3, 2), // 1.5
    });
    expect(c2.snapToBeat().position.offset.value.toDouble()).toBe(1);
  });
});
