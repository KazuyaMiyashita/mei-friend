import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MeiFriend } from "../../src/MeiFriend.js";
import { Cursor } from "../../src/models/score.js";

describe("Cursor Navigation", () => {
  it("prevBeat() moves to the last beat of the previous measure", () => {
    const filePath = resolve(__dirname, "../fixtures/sample_8_6.mei");
    const xml = readFileSync(filePath, "utf-8");
    const friend = MeiFriend.fromXmlString(xml);
    const scoreModel = friend.getScoreModel();

    // measure 1: 6/8 meter, totalDuration 3.0, beats at 0, 0.5, 1.0, 1.5, 2.0, 2.5
    // Start at measure 1, offset 0.5
    const startPos = {
      measureIndex: 1,
      staffN: 1,
      layerN: 1,
      offset: scoreModel.measures[1].meter.beatType.asOffset(),
      measureId: scoreModel.measures[1].id,
    };
    let cursor = new Cursor(scoreModel, startPos);

    // prevBeat() -> measure 1, offset 0
    cursor = cursor.prevBeat();
    expect(cursor.position.measureIndex).toBe(1);
    expect(cursor.position.offset.value.toDouble()).toBe(0);

    // prevBeat() -> should go to measure 0, last beat
    // measure 0 in sample_8_6.mei is a pickup measure with totalDuration 0.5.
    // Meter is 6/8 (beatType 0.5).
    // Last beat of measure 0: totalDuration (0.5) - beatType (0.5) = 0.
    cursor = cursor.prevBeat();
    expect(cursor.position.measureIndex).toBe(0);
    expect(cursor.position.offset.value.toDouble()).toBe(0);

    // Test jumping from measure 2 to measure 1 (full 6/8 measure)
    const pos2 = {
      measureIndex: 2,
      staffN: 1,
      layerN: 1,
      offset: scoreModel.measures[2].meter.beatType.asOffset().mul(0), // offset 0
      measureId: scoreModel.measures[2].id,
    };
    let cursor2 = new Cursor(scoreModel, pos2);
    cursor2 = cursor2.prevBeat();
    expect(cursor2.position.measureIndex).toBe(1);
    // last beat of 6/8 measure should be 2.5
    expect(cursor2.position.offset.value.toDouble()).toBe(2.5);
  });
});
