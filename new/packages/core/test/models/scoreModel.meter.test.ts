import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MeiFriend } from "../../src/MeiFriend.js";

describe("MeiScoreDef Meter Extraction", () => {
  it("extracts meter from sample_8_6.mei properly", () => {
    const filePath = resolve(__dirname, "../fixtures/sample_8_6.mei");
    const xml = readFileSync(filePath, "utf-8");
    const friend = MeiFriend.fromXmlString(xml);
    const scoreModel = friend.getScoreModel();

    expect(scoreModel.measures.length).toBeGreaterThan(0);

    // In sample_8_6.mei, the meter is 6/8.
    // It is defined in <scoreDef><staffGrp><staffDef><meterSig count="6" unit="8"/>.
    // measure 0 is a pickup measure (n=0)
    const m0 = scoreModel.measures[0];
    expect(m0.measureN).toBe("X0");
    expect(m0.meter.beats).toBe(6);
    expect(m0.meter.beatType.value.toDouble()).toBe(0.5); // 4/8 = 0.5

    // Pickup measure contains one 8th note.
    // Duration of 8th note is 0.5 in quarter note units.
    expect(m0.totalDuration.value.toDouble()).toBe(0.5);

    // measure 1 is a full measure (n=1)
    const m1 = scoreModel.measures[1];
    expect(m1.measureN).toBe("1");
    expect(m1.totalDuration.value.toDouble()).toBe(3.0); // 6 * 8th = 3.0
  });
});
