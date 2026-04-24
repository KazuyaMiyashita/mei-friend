import { Interval, IntervalNumber } from "./interval.js";

// --- Pitch ---

/**
 * Represents a musical pitch (e.g., F#4).
 * It is represented by a pair of Octave and NoteName, calculating the distance from Middle C.
 * e.g., C4 is (0, 0), C5 is (1, 0), G4 is (0, 1), D4 is (-1, 2)
 */
export class Pitch {
  constructor(
    public readonly octave: Octave,
    public readonly noteName: NoteName,
  ) {}

  public add(interval: Interval): Pitch {
    return new Pitch(
      new Octave(this.octave.value + interval.octave),
      new NoteName(this.noteName.value + interval.fifth),
    );
  }

  public sub(interval: Interval): Pitch {
    return new Pitch(
      new Octave(this.octave.value - interval.octave),
      new NoteName(this.noteName.value - interval.fifth),
    );
  }

  /**
   * Calculates the interval between two pitches.
   */
  public diff(that: Pitch): Interval {
    return new Interval(
      this.octave.value - that.octave.value,
      this.noteName.value - that.noteName.value,
    );
  }

  /**
   * Converts to international pitch notation representation.
   */
  public internationalPitchNotation(): IPN {
    return IPN.fromPitch(this);
  }

  /**
   * Reinterprets this pitch as an interval from Middle C (C4).
   * Since Pitch and Interval share the same internal representation,
   * this is a zero-cost conversion that enables interval arithmetic from C4.
   */
  public asInterval(): Interval {
    return new Interval(this.octave.value, this.noteName.value);
  }

  /**
   * Returns the pitch number, representing the pitch in semitones where Middle C is 0.
   */
  public num(): PitchNumber {
    return new PitchNumber(this.noteName.value * 7 + this.octave.value * 12);
  }

  public toString(): string {
    return this.internationalPitchNotation().toString();
  }

  /**
   * Parses a pitch string (e.g., "C4", "A#3", "Eb5").
   */
  public static parse(name: string): Pitch {
    return IPN.parse(name).toPitch();
  }

  /**
   * Helper to create a Pitch from raw octave and note name values.
   */
  public static of(octave: number, noteName: number): Pitch {
    return new Pitch(new Octave(octave), new NoteName(noteName));
  }
}

/**
 * Represents the octave information of a pitch.
 * The value represents the number of octave changes from middle C.
 * Note that this represents the number of moves, not the range.
 */
export class Octave {
  constructor(public readonly value: number) {}

  public add(that: Octave): Octave {
    return new Octave(this.value + that.value);
  }

  public sub(that: Octave): Octave {
    return new Octave(this.value - that.value);
  }
}

/**
 * Represents a musical note name.
 * The value represents the position on the circle of fifths in the sharp (#) direction.
 * e.g., F is -1, C is 0, G is 1.
 */
export class NoteName {
  constructor(public readonly value: number) {
    if (value < -15 || value > 19) {
      throw new Error("NoteName must be between -15 and 19.");
    }
  }

  public add(that: NoteName): NoteName {
    return new NoteName(this.value + that.value);
  }

  public sub(that: NoteName): NoteName {
    return new NoteName(this.value - that.value);
  }

  public compareTo(that: NoteName): number {
    return this.value - that.value;
  }

  /**
   * Returns the international pitch notation components for this note name.
   */
  public internationalPitchNotation(): {
    step: IPNStep;
    alter: IPNAlter;
  } {
    return IPN.fromNoteName(this);
  }

  public toString(): string {
    const { step, alter } = this.internationalPitchNotation();
    return IPN.stepAlterName(step, alter);
  }

  /**
   * Parses a note name string (e.g., "C", "F#", "Bb").
   */
  public static parse(name: string): NoteName {
    const { step, alter } = IPN.parseStepAlter(name);
    return IPN.toNoteName(step, alter);
  }
}

// --- PitchNumber ---

/**
 * Represents a pitch in semitones, where Middle C (C4) is 0.
 */
export class PitchNumber {
  constructor(public readonly value: number) {}

  public add(that: IntervalNumber): PitchNumber {
    return new PitchNumber(this.value + that.value);
  }

  public sub(that: PitchNumber): IntervalNumber {
    return new IntervalNumber(this.value - that.value);
  }

  public compareTo(that: PitchNumber): number {
    return this.value - that.value;
  }
}

// --- International Pitch Notation (IPN) ---

/**
 * International pitch notation (e.g., C#4).
 * Handles the triplet of step, alter, and octave information.
 * Used for parsing and stringifying Pitch and NoteName.
 */
export class IPN {
  constructor(
    public readonly step: IPNStep,
    public readonly alter: IPNAlter,
    public readonly octave: IPNOctave,
  ) {}

  public toString(): string {
    const accidental =
      this.alter.value > 0
        ? "#".repeat(this.alter.value)
        : "b".repeat(-this.alter.value);
    return `${this.step.name}${accidental}${this.octave.value}`;
  }

  /**
   * Converts to a Pitch instance.
   */
  public toPitch(): Pitch {
    const noteName = IPN.toNoteName(this.step, this.alter);
    const baseOctave = this.step.basePitch.octave.value;
    const octaveVal =
      baseOctave + this.alter.value * -4 + this.octave.value - 4;
    return new Pitch(new Octave(octaveVal), noteName);
  }

  /**
   * Decomposes a note name into a step and an alteration.
   */
  public static fromNoteName(noteName: NoteName): {
    step: IPNStep;
    alter: IPNAlter;
  } {
    // F(-1) to B(5) are the base note names
    const bases = [-1, 0, 1, 2, 3, 4, 5].map((v) => new NoteName(v));
    const baseNoteName = bases.find(
      (b) => (noteName.value - b.value) % 7 === 0,
    );
    if (baseNoteName) {
      const alter = (noteName.value - baseNoteName.value) / 7;
      const step = IPNStep.fromBaseNoteName(baseNoteName);
      return { step, alter: new IPNAlter(alter) };
    }
    throw new Error("Unreachable");
  }

  /**
   * Combines a step and an alteration into a note name.
   */
  public static toNoteName(step: IPNStep, alter: IPNAlter): NoteName {
    const baseNoteName = step.basePitch.noteName;
    return new NoteName(baseNoteName.value + alter.value * 7);
  }

  /**
   * Returns a string representation of the step and alteration (e.g., "F#").
   */
  public static stepAlterName(step: IPNStep, alter: IPNAlter): string {
    const accidental =
      alter.value > 0 ? "#".repeat(alter.value) : "b".repeat(-alter.value);
    return `${step.name}${accidental}`;
  }

  /**
   * Converts a Pitch instance into InternationalPitch.
   */
  public static fromPitch(pitch: Pitch): IPN {
    const { step, alter } = IPN.fromNoteName(pitch.noteName);
    const baseOctave = step.basePitch.octave.value;
    const octaveVal = pitch.octave.value - baseOctave + 4 * alter.value + 4;
    return new IPN(step, alter, new IPNOctave(octaveVal));
  }

  private static readonly stepAlterRegex = /^([A-G])([#b]*)$/;

  /**
   * Parses the step and alteration from a string (e.g., "C#").
   */
  public static parseStepAlter(name: string): {
    step: IPNStep;
    alter: IPNAlter;
  } {
    const match = name.match(IPN.stepAlterRegex);
    if (match) {
      const [_, stepStr, accidentalStr] = match;
      const alterVal =
        (accidentalStr.match(/#/g) || []).length -
        (accidentalStr.match(/b/g) || []).length;
      return {
        step: IPNStep.valueOf(stepStr),
        alter: new IPNAlter(alterVal),
      };
    }
    throw new Error(`Invalid note name: ${name}`);
  }

  private static readonly regex = /^([A-G][#b]*)(-?\d+)$/;

  /**
   * Parses an international pitch notation string (e.g., "C#4").
   */
  public static parse(name: string): IPN {
    const match = name.match(IPN.regex);
    if (match) {
      const [_, noteNameStr, octaveStr] = match;
      const { step, alter } = IPN.parseStepAlter(noteNameStr);
      const octaveNum = parseInt(octaveStr, 10);
      return new IPN(step, alter, new IPNOctave(octaveNum));
    }
    throw new Error(`Invalid pitch name: ${name}`);
  }
}

/**
 * Represents the step part of an international pitch (C, D, E, F, G, A, B).
 */
export class IPNStep {
  private constructor(
    public readonly name: string,
    public readonly basePitch: Pitch,
    public readonly ordinal: number,
  ) {}

  static readonly C = new IPNStep("C", Pitch.of(0, 0), 0);
  static readonly D = new IPNStep("D", Pitch.of(-1, 2), 1);
  static readonly E = new IPNStep("E", Pitch.of(-2, 4), 2);
  static readonly F = new IPNStep("F", Pitch.of(1, -1), 3);
  static readonly G = new IPNStep("G", Pitch.of(0, 1), 4);
  static readonly A = new IPNStep("A", Pitch.of(-1, 3), 5);
  static readonly B = new IPNStep("B", Pitch.of(-2, 5), 6);

  static values(): IPNStep[] {
    return [
      IPNStep.C,
      IPNStep.D,
      IPNStep.E,
      IPNStep.F,
      IPNStep.G,
      IPNStep.A,
      IPNStep.B,
    ];
  }

  /**
   * Finds the step corresponding to a base note name.
   */
  static fromBaseNoteName(baseNoteName: NoteName): IPNStep {
    const found = IPNStep.values().find(
      (s) => s.basePitch.noteName.value === baseNoteName.value,
    );
    if (!found) throw new Error("Unreachable");
    return found;
  }

  /**
   * Finds the step by its name (e.g., "C").
   */
  static valueOf(name: string): IPNStep {
    const found = IPNStep.values().find((s) => s.name === name);
    if (!found) throw new Error(`Invalid step name: ${name}`);
    return found;
  }
}

/** Represents the alteration of a pitch (number of sharps (#) or flats (b)). */
export class IPNAlter {
  constructor(public readonly value: number) {}
}

/** Represents the octave in international pitch notation. */
export class IPNOctave {
  constructor(public readonly value: number) {}
}

// --- Rest ---

/** Represents a musical rest. */
export const Rest = Symbol("Rest");
export type Rest = typeof Rest;
