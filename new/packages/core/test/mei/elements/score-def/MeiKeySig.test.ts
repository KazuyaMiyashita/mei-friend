import { describe, expect, it } from "vitest";
import { MeiFriend } from "../../../../src/MeiFriend.js";
import { MeiKeySig } from "../../../../src/mei/elements/score-def/MeiKeySig.js";
import { Mode } from "../../../../src/models/index.js";

function makeKeySig(sig: string, mode: string): MeiKeySig {
  const xml = `
    <mei xmlns="http://www.music-encoding.org/ns/mei" xml:id="m1">
      <music xml:id="mus1"><body xml:id="b1"><mdiv xml:id="md1">
        <score xml:id="sc1">
          <scoreDef xml:id="scd1">
            <staffGrp xml:id="sg1">
              <staffDef n="1" xml:id="sdf1">
                <keySig xml:id="ks1" sig="${sig}" mode="${mode}"/>
              </staffDef>
            </staffGrp>
          </scoreDef>
        </score>
      </mdiv></body></music>
    </mei>`;
  const mf = MeiFriend.fromXmlString(xml);
  return MeiKeySig.create(mf.getElementById("ks1")!)!;
}

describe("MeiKeySig", () => {
  describe("raw attribute getters", () => {
    it("returns sig attribute", () => {
      expect(makeKeySig("2s", "major").sig).toBe("2s");
    });

    it("returns mode attribute", () => {
      expect(makeKeySig("1f", "minor").mode).toBe("minor");
    });

    it("returns undefined sig when attribute is absent", () => {
      const xml = `
        <mei xmlns="http://www.music-encoding.org/ns/mei" xml:id="m1">
          <music xml:id="mus1"><body xml:id="b1"><mdiv xml:id="md1">
            <score xml:id="sc1">
              <scoreDef xml:id="scd1">
                <staffGrp xml:id="sg1">
                  <staffDef n="1" xml:id="sdf1">
                    <keySig xml:id="ks1" mode="major"/>
                  </staffDef>
                </staffGrp>
              </scoreDef>
            </score>
          </mdiv></body></music>
        </mei>`;
      const mf = MeiFriend.fromXmlString(xml);
      const ks = MeiKeySig.create(mf.getElementById("ks1")!)!;
      expect(ks.sig).toBeUndefined();
    });
  });

  describe("toKey()", () => {
    it("returns undefined when sig is absent", () => {
      const xml = `
        <mei xmlns="http://www.music-encoding.org/ns/mei" xml:id="m1">
          <music xml:id="mus1"><body xml:id="b1"><mdiv xml:id="md1">
            <score xml:id="sc1">
              <scoreDef xml:id="scd1">
                <staffGrp xml:id="sg1">
                  <staffDef n="1" xml:id="sdf1">
                    <keySig xml:id="ks1" mode="major"/>
                  </staffDef>
                </staffGrp>
              </scoreDef>
            </score>
          </mdiv></body></music>
        </mei>`;
      const mf = MeiFriend.fromXmlString(xml);
      expect(
        MeiKeySig.create(mf.getElementById("ks1")!)!.toKey(),
      ).toBeUndefined();
    });

    it("C Major (sig=0, mode=major) → signatureNum 0", () => {
      const key = makeKeySig("0", "major").toKey()!;
      expect(key.signatureNum()).toBe(0);
      expect(key.mode).toBe(Mode.Major);
    });

    it("G Major (sig=1s, mode=major) → signatureNum 1", () => {
      const key = makeKeySig("1s", "major").toKey()!;
      expect(key.signatureNum()).toBe(1);
      expect(key.mode).toBe(Mode.Major);
    });

    it("D Major (sig=2s, mode=major) → signatureNum 2", () => {
      const key = makeKeySig("2s", "major").toKey()!;
      expect(key.signatureNum()).toBe(2);
      expect(key.mode).toBe(Mode.Major);
    });

    it("F Major (sig=1f, mode=major) → signatureNum -1", () => {
      const key = makeKeySig("1f", "major").toKey()!;
      expect(key.signatureNum()).toBe(-1);
      expect(key.mode).toBe(Mode.Major);
    });

    it("Bb Major (sig=2f, mode=major) → signatureNum -2", () => {
      const key = makeKeySig("2f", "major").toKey()!;
      expect(key.signatureNum()).toBe(-2);
      expect(key.mode).toBe(Mode.Major);
    });

    it("A Minor (sig=0, mode=minor) → signatureNum 0", () => {
      const key = makeKeySig("0", "minor").toKey()!;
      expect(key.signatureNum()).toBe(0);
      expect(key.mode).toBe(Mode.Minor);
    });

    it("E Minor (sig=1s, mode=minor) → signatureNum 1", () => {
      const key = makeKeySig("1s", "minor").toKey()!;
      expect(key.signatureNum()).toBe(1);
      expect(key.mode).toBe(Mode.Minor);
    });

    it("D Minor (sig=1f, mode=minor) → signatureNum -1", () => {
      const key = makeKeySig("1f", "minor").toKey()!;
      expect(key.signatureNum()).toBe(-1);
      expect(key.mode).toBe(Mode.Minor);
    });
  });
});
