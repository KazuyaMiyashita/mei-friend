import { describe, expect, it } from "vitest";
import {
  Degree,
  Interval,
  IntervalStep,
  IPN,
  IPNStep,
  Key,
  Mode,
  Pitch,
  PitchNoteName,
} from "../../src/models/elements.js";

describe("Pitch and PitchNoteName", () => {
  it("should parse and stringify Pitch correctly", () => {
    const pitch = Pitch.parse("C4");
    expect(pitch.toString()).toBe("C4");

    const pitch2 = Pitch.parse("A#3");
    expect(pitch2.toString()).toBe("A#3");

    const pitch3 = Pitch.parse("Eb5");
    expect(pitch3.toString()).toBe("Eb5");
  });

  it("should parse and stringify PitchNoteName correctly", () => {
    const note = PitchNoteName.parse("C");
    expect(note.toString()).toBe("C");

    const note2 = PitchNoteName.parse("F#");
    expect(note2.toString()).toBe("F#");

    const note3 = PitchNoteName.parse("Bb");
    expect(note3.toString()).toBe("Bb");
  });

  it("should handle InternationalPitch round trip", () => {
    const p = Pitch.parse("C4");
    const ip = IPN.fromPitch(p);
    expect(ip.step).toBe(IPNStep.C);
    expect(ip.octave.value).toBe(4);
    expect(ip.alter.value).toBe(0);

    const p2 = ip.toPitch();
    expect(p2.octave.value).toBe(p.octave.value);
    expect(p2.noteName.value).toBe(p.noteName.value);
  });
});

describe("Degree", () => {
  it("should calculate correct degree in C Major", () => {
    const cMajor = new Key(PitchNoteName.parse("C"), Mode.Major);

    // C (Tonic) -> I (InternationalPitchStep 0, Alter 0)
    const c = PitchNoteName.parse("C");
    const d_c = Degree.fromNoteNameKey(c, cMajor);
    expect(d_c.step.value).toBe(0);
    expect(d_c.alter.value).toBe(0);
    expect(d_c.noteName(cMajor).value).toBe(c.value);

    // F (Subdominant) -> IV (InternationalPitchStep 3, Alter 0)
    const f = PitchNoteName.parse("F");
    const d_f = Degree.fromNoteNameKey(f, cMajor);
    expect(d_f.step.value).toBe(3);
    expect(d_f.alter.value).toBe(0);
    expect(d_f.noteName(cMajor).value).toBe(f.value);

    // F# -> IV# (InternationalPitchStep 3, Alter 1)
    const fs = PitchNoteName.parse("F#");
    const d_fs = Degree.fromNoteNameKey(fs, cMajor);
    expect(d_fs.step.value).toBe(3);
    expect(d_fs.alter.value).toBe(1);
    expect(d_fs.noteName(cMajor).value).toBe(fs.value);
  });

  it("should calculate correct degree in G Major (F# is diatonic)", () => {
    const gMajor = new Key(PitchNoteName.parse("G"), Mode.Major);

    // G (Tonic) -> I
    const g = PitchNoteName.parse("G");
    expect(Degree.fromNoteNameKey(g, gMajor).step.value).toBe(0);

    // F# (Leading tone) -> VII (InternationalPitchStep 6, Alter 0)
    const fs = PitchNoteName.parse("F#");
    const d_fs = Degree.fromNoteNameKey(fs, gMajor);
    expect(d_fs.step.value).toBe(6);
    expect(d_fs.alter.value).toBe(0);
    expect(d_fs.noteName(gMajor).value).toBe(fs.value);

    // F (Natural) -> VIIb (InternationalPitchStep 6, Alter -1)
    const f = PitchNoteName.parse("F");
    const d_f = Degree.fromNoteNameKey(f, gMajor);
    expect(d_f.step.value).toBe(6);
    expect(d_f.alter.value).toBe(-1);
    expect(d_f.noteName(gMajor).value).toBe(f.value);
  });

  it("should calculate correct degree in A Minor", () => {
    const aMinor = new Key(PitchNoteName.parse("A"), Mode.Minor);

    // A (Tonic) -> I
    const a = PitchNoteName.parse("A");
    expect(Degree.fromNoteNameKey(a, aMinor).step.value).toBe(0);

    // G (7th) -> VII (InternationalPitchStep 6, Alter 0) -- Natural Minor scale
    const g = PitchNoteName.parse("G");
    const d_g = Degree.fromNoteNameKey(g, aMinor);
    expect(d_g.step.value).toBe(6);
    expect(d_g.alter.value).toBe(0);

    // G# (Leading tone in Harmonic Minor) -> VII# (InternationalPitchStep 6, Alter 1)
    const gs = PitchNoteName.parse("G#");
    const d_gs = Degree.fromNoteNameKey(gs, aMinor);
    expect(d_gs.step.value).toBe(6);
    expect(d_gs.alter.value).toBe(1);
  });

  it("should calculate correct pitch from staff position (C=0)", () => {
    const fMajor = new Key(PitchNoteName.parse("F"), Mode.Major);
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

describe("Interval", () => {
  it("should normalize intervals upward correctly", () => {
    const m9 = Interval.parse("M9");
    expect(m9.normalize().toString()).toBe("M2");

    const m9desc = Interval.parse("-M9");
    // Should normalize upward to M2 according to the intended behavior
    expect(m9desc.normalize().toString()).toBe("M2");
  });
});

describe("Pitch Parsing", () => {
  it("should parse negative octaves (Bug Reproduction)", () => {
    const p = Pitch.parse("C-1");
    // C4 is Middle C (octave 0). C-1 is 5 octaves below Middle C.
    expect(p.octave.value).toBe(-5);
    expect(p.toString()).toBe("C-1");
  });
});
