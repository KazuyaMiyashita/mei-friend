import type { IntervalStep } from "./interval.js";
import { mod } from "./math.js";
import { IPN, NoteName, Octave, Pitch } from "./pitch.js";

// --- Key Components ---

/** Represents the mode of a key (Major or Minor). */
export class Mode {
  private constructor(
    public readonly name: string,
    public readonly offset: number,
  ) {}

  static readonly Major = new Mode("Major", 0);
  static readonly Minor = new Mode("Minor", -3);

  public toString(): string {
    return this.name;
  }

  public static parse(name: string): Mode {
    if (name === "Major") return Mode.Major;
    if (name === "Minor") return Mode.Minor;
    throw new Error(`Invalid mode: ${name}`);
  }
}

// --- Key ---

/**
 * Represents a musical key, defined by its tonic NoteName and mode.
 */
export class Key {
  constructor(
    public readonly tonic: NoteName,
    public readonly mode: Mode,
  ) {}

  /**
   * Returns the number of sharps or flats in the key signature.
   */
  public signatureNum(): number {
    return this.tonic.value + this.mode.offset;
  }

  /**
   * Calculates the pitch at a given staff position (where C=0), applying the key signature.
   * This simulates reading a note from a specific line or space on the staff.
   * For example, in G Major (one sharp), the staff position 0 (C) is C4,
   * while the staff position 3 (F) is raised to F#4.
   */
  public diatonicScalePitch(intervalStep: IntervalStep): Pitch {
    const { octave, fifth } = Key.calculateScalePitch(
      this.tonic.value,
      this.mode.offset,
      intervalStep.value,
    );
    return new Pitch(new Octave(octave), new NoteName(fifth));
  }

  /**
   * Parses a key string (e.g., "C Major", "A Minor").
   */
  public static parse(name: string): Key {
    const parts = name.split(" ");
    if (parts.length !== 2) throw new Error("Invalid key format");
    return new Key(NoteName.parse(parts[0]), Mode.parse(parts[1]));
  }

  /**
   * Core logic to calculate the diatonic pitch at a given staff position, applying the key signature.
   * For example, in G Major (one sharp), the staff position 0 (C) results in C,
   * while the staff position 3 (F) results in F#.
   */
  public static calculateScalePitch(
    keyTonicVal: number,
    modeOffset: number,
    intervalStepVal: number,
  ): { octave: number; fifth: number } {
    const signatureNum = keyTonicVal + modeOffset;

    const getAlters = (num: number): number[] => {
      const q = Math.floor(num / 7);
      const r = mod(num, 7);
      return Array.from({ length: 7 }, (_, i) => (i < r ? q + 1 : q));
    };

    // F, C, G, D, A, E, B -> Steps from C: 3, 0, 4, 1, 5, 2, 6
    const stepsMap = [3, 0, 4, 1, 5, 2, 6];
    const invStep = mod(intervalStepVal, 7);
    const currentAlters = getAlters(signatureNum);
    const idx = stepsMap.indexOf(invStep);
    const targetAlter = currentAlters[idx];

    const cMajorFifths = [0, 2, 4, -1, 1, 3, 5]; // C D E F G A B
    const cMajorBaseOctaves = [0, -1, -2, 1, 0, -1, -2]; // C D E F G A B

    const baseFifth = cMajorFifths[invStep];
    const baseOctave = cMajorBaseOctaves[invStep];
    const octaveShift = Math.floor(intervalStepVal / 7);

    // Equivalent to Interval.A1 * alter
    // A1 is octave=-4, fifth=7
    const finalFifth = baseFifth + 7 * targetAlter;
    const finalOctave = baseOctave + octaveShift + -4 * targetAlter;

    return { octave: finalOctave, fifth: finalFifth };
  }
}

// --- Degree ---

/**
 * Represents a musical degree, which is a relative position within a key.
 * e.g., F# in C Major is the 4th degree (Step=3) raised by a semitone (Alter=1).
 */
export class Degree {
  constructor(
    public readonly step: DegreeStep,
    public readonly alter: DegreeAlter,
  ) {}

  /**
   * Converts the degree back to a NoteName within the specified key.
   */
  public noteName(key: Key): NoteName {
    const { step: rootStep } = IPN.fromNoteName(key.tonic);
    const { fifth: diatonicVal } = Key.calculateScalePitch(
      key.tonic.value,
      key.mode.offset,
      this.step.value + rootStep.ordinal,
    );
    return new NoteName(diatonicVal + this.alter.value * 7);
  }

  public compareTo(that: Degree): number {
    const s = this.step.compareTo(that.step);
    if (s !== 0) return s;
    return this.alter.compareTo(that.alter);
  }

  /**
   * Determines the degree of a note name relative to a key.
   */
  public static fromNoteNameKey(noteName: NoteName, key: Key): Degree {
    const { step: nStep } = IPN.fromNoteName(noteName);
    const { step: tStep } = IPN.fromNoteName(key.tonic);

    const stepDiff = mod(nStep.ordinal - tStep.ordinal, 7);
    const degreeStep = new DegreeStep(stepDiff);

    const { fifth: diatonicVal } = Key.calculateScalePitch(
      key.tonic.value,
      key.mode.offset,
      degreeStep.value + tStep.ordinal,
    );
    const diff = noteName.value - diatonicVal;
    const alterVal = Math.floor(diff / 7);

    return new Degree(degreeStep, new DegreeAlter(alterVal));
  }

  /**
   * Helper to create a Degree from 1-indexed degree number and alteration.
   */
  public static idx1(step: number, alter: number): Degree {
    return new Degree(DegreeStep.idx1(step), new DegreeAlter(alter));
  }
}

/**
 * Represents the step part of a degree within a key.
 * It is 0-indexed (e.g., 1st degree is 0, 2nd is 1).
 */
export class DegreeStep {
  constructor(public readonly value: number) {
    if (value < 0 || value > 6) throw new Error("DegreeStep must be 0-6");
  }

  public add(that: DegreeStep): DegreeStep {
    return new DegreeStep((this.value + that.value) % 7);
  }

  public sub(that: DegreeStep): DegreeStep {
    return new DegreeStep(mod(this.value - that.value, 7));
  }

  public compareTo(that: DegreeStep): number {
    return this.value - that.value;
  }

  public toIdx1(): number {
    return this.value + 1;
  }

  public static idx1(step: number): DegreeStep {
    return new DegreeStep(step - 1);
  }
}

/**
 * Represents the alteration of a degree relative to the diatonic scale (no change = 0).
 */
export class DegreeAlter {
  constructor(public readonly value: number) {
    if (value < -1 || value > 2) throw new Error("Alter must be -1 to 2");
  }

  public compareTo(that: DegreeAlter): number {
    return this.value - that.value;
  }
}
