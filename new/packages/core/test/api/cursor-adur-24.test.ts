import { describe, expect, it } from "vitest";
import { Cursor } from "../../src/api/Cursor.js";
import { MeiFriend } from "../../src/index.js";
import { Offset } from "../../src/models/index.js";

/**
 * A major (3 sharps), 2/4 time.
 *
 * Navigable events and their expected offsets (quarter note = 1):
 *   c1eelvrz  b4   dur=8   offset=0,    duration=0.5
 *   ezb9rwv   rest dur=16  offset=0.5,  duration=0.25
 *   f1ezdjmx  a4   dur=16  offset=0.75, duration=0.25
 *   in28zrj   a4   dur=16  offset=1.0,  duration=0.25
 *   k113i7dx  g#4  dur=16  offset=1.25, duration=0.25
 *   matp0m8   f#4  dur=16  offset=1.5,  duration=0.25
 *   o1t0c1ho  g#4  dur=16  offset=1.75, duration=0.25
 *
 * Beat boundaries (2/4, beatType = quarter = 1): offset 0, 1
 */
const xml = `
  <mei xmlns="http://www.music-encoding.org/ns/mei">
    <meiHead><fileDesc><titleStmt><title/></titleStmt></fileDesc></meiHead>
    <music>
      <body>
        <mdiv>
          <score>
            <scoreDef meter.count="2" meter.unit="4" key.sig="3s"/>
            <section>
              <measure xml:id="m1" n="1">
                <staff xml:id="zxua0z4" n="1">
                  <layer xml:id="a1jeirz9" n="1">
                    <beam xml:id="b1rlo5xn">
                      <note xml:id="c1eelvrz" dur="8" oct="4" pname="b" stem.dir="down">
                        <artic xml:id="d18xyo1j" artic="stacc"/>
                      </note>
                      <rest xml:id="ezb9rwv" dur="16"/>
                      <note xml:id="f1ezdjmx" dur="16" oct="4" pname="a" stem.dir="down">
                        <artic xml:id="g15r94jx" artic="stacc"/>
                      </note>
                    </beam>
                    <beam xml:id="hbhuza8">
                      <note xml:id="in28zrj" dur="16" oct="4" pname="a" stem.dir="down"/>
                      <note xml:id="k113i7dx" accid.ges="s" dur="16" oct="4" pname="g" stem.dir="down"/>
                      <note xml:id="matp0m8" accid.ges="s" dur="16" oct="4" pname="f" stem.dir="down"/>
                      <note xml:id="o1t0c1ho" accid.ges="s" dur="16" oct="4" pname="g" stem.dir="down"/>
                    </beam>
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

describe("Cursor navigation – A-dur 2/4", () => {
  const friend = MeiFriend.fromXmlString(xml);
  const scoreModel = friend.getScoreModel();

  // Helper: cursor starting at a given element id
  const cursorAt = (id: string) => Cursor.fromId(friend, id)!;

  describe("nextEvent", () => {
    it("traverses all navigable events forward from the first note", () => {
      let c = cursorAt("c1eelvrz");
      expect(c.position.offset.value.toDouble()).toBe(0);

      c = c.nextEvent();
      expect(c.getEvent()?.id).toBe("ezb9rwv");
      expect(c.position.offset.value.toDouble()).toBe(0.5);

      c = c.nextEvent();
      expect(c.getEvent()?.id).toBe("f1ezdjmx");
      expect(c.position.offset.value.toDouble()).toBe(0.75);

      c = c.nextEvent();
      expect(c.getEvent()?.id).toBe("in28zrj");
      expect(c.position.offset.value.toDouble()).toBe(1.0);

      c = c.nextEvent();
      expect(c.getEvent()?.id).toBe("k113i7dx");
      expect(c.position.offset.value.toDouble()).toBe(1.25);

      c = c.nextEvent();
      expect(c.getEvent()?.id).toBe("matp0m8");
      expect(c.position.offset.value.toDouble()).toBe(1.5);

      c = c.nextEvent();
      expect(c.getEvent()?.id).toBe("o1t0c1ho");
      expect(c.position.offset.value.toDouble()).toBe(1.75);
    });

    it("stays put at the last event when there is no next", () => {
      const c = cursorAt("o1t0c1ho");
      expect(c.nextEvent()).toBe(c);
    });
  });

  describe("prevEvent", () => {
    it("traverses all navigable events backward from the last note", () => {
      let c = cursorAt("o1t0c1ho");
      expect(c.position.offset.value.toDouble()).toBe(1.75);

      c = c.prevEvent();
      expect(c.getEvent()?.id).toBe("matp0m8");
      expect(c.position.offset.value.toDouble()).toBe(1.5);

      c = c.prevEvent();
      expect(c.getEvent()?.id).toBe("k113i7dx");
      expect(c.position.offset.value.toDouble()).toBe(1.25);

      c = c.prevEvent();
      expect(c.getEvent()?.id).toBe("in28zrj");
      expect(c.position.offset.value.toDouble()).toBe(1.0);

      c = c.prevEvent();
      expect(c.getEvent()?.id).toBe("f1ezdjmx");
      expect(c.position.offset.value.toDouble()).toBe(0.75);

      c = c.prevEvent();
      expect(c.getEvent()?.id).toBe("ezb9rwv");
      expect(c.position.offset.value.toDouble()).toBe(0.5);

      c = c.prevEvent();
      expect(c.getEvent()?.id).toBe("c1eelvrz");
      expect(c.position.offset.value.toDouble()).toBe(0);
    });

    it("stays put at the first event when there is no previous", () => {
      const c = cursorAt("c1eelvrz");
      expect(c.prevEvent()).toBe(c);
    });
  });

  describe("nextBeat", () => {
    it("advances from beat 1 (offset 0) to beat 2 (offset 1)", () => {
      const c = new Cursor(friend, scoreModel, {
        measureIndex: 0,
        staffN: 1,
        layerN: 1,
        offset: Offset.of(0),
      });
      expect(c.nextBeat().position.offset.value.toDouble()).toBe(1);
    });

    it("advances from a mid-beat position to the next beat boundary", () => {
      // offset=0.5 is between beat 1 and beat 2 → nextBeat → beat 2 (offset=1)
      const c = new Cursor(friend, scoreModel, {
        measureIndex: 0,
        staffN: 1,
        layerN: 1,
        offset: Offset.of(1, 2),
      });
      expect(c.nextBeat().position.offset.value.toDouble()).toBe(1);
    });

    it("stays put at the last beat when there is no next measure", () => {
      // offset=1 is the last beat of the only measure
      const c = new Cursor(friend, scoreModel, {
        measureIndex: 0,
        staffN: 1,
        layerN: 1,
        offset: Offset.of(1),
      });
      const next = c.nextBeat();
      expect(next.position.measureIndex).toBe(0);
      expect(next.position.offset.value.toDouble()).toBe(1);
    });
  });

  describe("prevBeat", () => {
    it("retreats from beat 2 (offset 1) to beat 1 (offset 0)", () => {
      const c = new Cursor(friend, scoreModel, {
        measureIndex: 0,
        staffN: 1,
        layerN: 1,
        offset: Offset.of(1),
      });
      expect(c.prevBeat().position.offset.value.toDouble()).toBe(0);
    });

    it("retreats from a mid-beat position to the preceding beat boundary", () => {
      // offset=1.5 is between beat 2 and measure end → prevBeat → beat 2 (offset=1)
      const c = new Cursor(friend, scoreModel, {
        measureIndex: 0,
        staffN: 1,
        layerN: 1,
        offset: Offset.of(3, 2),
      });
      expect(c.prevBeat().position.offset.value.toDouble()).toBe(1);
    });

    it("stays put at the first beat when there is no previous measure", () => {
      // offset=0 is the first beat of the only measure
      const c = new Cursor(friend, scoreModel, {
        measureIndex: 0,
        staffN: 1,
        layerN: 1,
        offset: Offset.of(0),
      });
      const prev = c.prevBeat();
      expect(prev.position.measureIndex).toBe(0);
      expect(prev.position.offset.value.toDouble()).toBe(0);
    });
  });
});
