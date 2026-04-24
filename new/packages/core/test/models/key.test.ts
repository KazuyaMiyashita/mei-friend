import { describe, expect, it } from "vitest";
import {
  Degree,
  IntervalStep,
  Key,
  Mode,
  NoteName,
} from "../../src/models/index.js";

describe("Degree", () => {
  it("should calculate correct degree in C Major", () => {
    const cMajor = new Key(NoteName.parse("C"), Mode.Major);

    // C (Tonic) -> I (InternationalPitchStep 0, Alter 0)
    const c = NoteName.parse("C");
    const d_c = Degree.fromNoteNameKey(c, cMajor);
    expect(d_c.step.value).toBe(0);
    expect(d_c.alter.value).toBe(0);
    expect(d_c.noteName(cMajor).value).toBe(c.value);

    // F (Subdominant) -> IV (InternationalPitchStep 3, Alter 0)
    const f = NoteName.parse("F");
    const d_f = Degree.fromNoteNameKey(f, cMajor);
    expect(d_f.step.value).toBe(3);
    expect(d_f.alter.value).toBe(0);
    expect(d_f.noteName(cMajor).value).toBe(f.value);

    // F# -> IV# (InternationalPitchStep 3, Alter 1)
    const fs = NoteName.parse("F#");
    const d_fs = Degree.fromNoteNameKey(fs, cMajor);
    expect(d_fs.step.value).toBe(3);
    expect(d_fs.alter.value).toBe(1);
    expect(d_fs.noteName(cMajor).value).toBe(fs.value);
  });

  it("should calculate correct degree in G Major (F# is diatonic)", () => {
    const gMajor = new Key(NoteName.parse("G"), Mode.Major);

    // G (Tonic) -> I
    const g = NoteName.parse("G");
    expect(Degree.fromNoteNameKey(g, gMajor).step.value).toBe(0);

    // F# (Leading tone) -> VII (InternationalPitchStep 6, Alter 0)
    const fs = NoteName.parse("F#");
    const d_fs = Degree.fromNoteNameKey(fs, gMajor);
    expect(d_fs.step.value).toBe(6);
    expect(d_fs.alter.value).toBe(0);
    expect(d_fs.noteName(gMajor).value).toBe(fs.value);

    // F (Natural) -> VIIb (InternationalPitchStep 6, Alter -1)
    const f = NoteName.parse("F");
    const d_f = Degree.fromNoteNameKey(f, gMajor);
    expect(d_f.step.value).toBe(6);
    expect(d_f.alter.value).toBe(-1);
    expect(d_f.noteName(gMajor).value).toBe(f.value);
  });

  it("should calculate correct degree in A Minor", () => {
    const aMinor = new Key(NoteName.parse("A"), Mode.Minor);

    // A (Tonic) -> I
    const a = NoteName.parse("A");
    expect(Degree.fromNoteNameKey(a, aMinor).step.value).toBe(0);

    // G (7th) -> VII (InternationalPitchStep 6, Alter 0) -- Natural Minor scale
    const g = NoteName.parse("G");
    const d_g = Degree.fromNoteNameKey(g, aMinor);
    expect(d_g.step.value).toBe(6);
    expect(d_g.alter.value).toBe(0);

    // G# (Leading tone in Harmonic Minor) -> VII# (InternationalPitchStep 6, Alter 1)
    const gs = NoteName.parse("G#");
    const d_gs = Degree.fromNoteNameKey(gs, aMinor);
    expect(d_gs.step.value).toBe(6);
    expect(d_gs.alter.value).toBe(1);
  });

  it("should calculate correct pitch from staff position (C=0)", () => {
    const fMajor = new Key(NoteName.parse("F"), Mode.Major);
    // In F Major, staff position 0 (C) is C4
    const pC = fMajor.diatonicScalePitch(IntervalStep.idx1(1));
    expect(pC.toString()).toBe("C4");

    // In F Major, staff position 3 (F) is F4
    const pF = fMajor.diatonicScalePitch(IntervalStep.idx1(4));
    expect(pF.toString()).toBe("F4");

    // In F Major, staff position 6 (B) is Bb4 (due to the flat in key signature)
    const pB = fMajor.diatonicScalePitch(IntervalStep.idx1(7));
    expect(pB.toString()).toBe("Bb4");
  });
});
