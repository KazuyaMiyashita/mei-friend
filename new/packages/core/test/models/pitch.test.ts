import { describe, expect, it } from "vitest";
import { IPN, IPNStep, NoteName, Pitch } from "../../src/models/index.js";

describe("Pitch and NoteName", () => {
  it("should parse and stringify Pitch correctly", () => {
    const pitch = Pitch.parse("C4");
    expect(pitch.toString()).toBe("C4");

    const pitch2 = Pitch.parse("A#3");
    expect(pitch2.toString()).toBe("A#3");

    const pitch3 = Pitch.parse("Eb5");
    expect(pitch3.toString()).toBe("Eb5");
  });

  it("should parse and stringify NoteName correctly", () => {
    const note = NoteName.parse("C");
    expect(note.toString()).toBe("C");

    const note2 = NoteName.parse("F#");
    expect(note2.toString()).toBe("F#");

    const note3 = NoteName.parse("Bb");
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

describe("Pitch Parsing", () => {
  it("should parse negative octaves (Bug Reproduction)", () => {
    const p = Pitch.parse("C-1");
    // C4 is Middle C (octave 0). C-1 is 5 octaves below Middle C.
    expect(p.octave.value).toBe(-5);
    expect(p.toString()).toBe("C-1");
  });
});
