import { mod, Rational } from "./math.js";

// --- Pitch Components ---

/**
 * Represents a musical note name.
 * The value represents the position on the circle of fifths in the sharp (#) direction.
 * e.g., F is -1, C is 0, G is 1.
 */
export class PitchNoteName {
  constructor(public readonly value: number) {
    if (value < -15 || value > 19) {
      throw new Error("PitchNoteName must be between -15 and 19.");
    }
  }

  public add(that: PitchNoteName): PitchNoteName {
    return new PitchNoteName(this.value + that.value);
  }

  public sub(that: PitchNoteName): PitchNoteName {
    return new PitchNoteName(this.value - that.value);
  }

  public compareTo(that: PitchNoteName): number {
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
  public static parse(name: string): PitchNoteName {
    const { step, alter } = IPN.parseStepAlter(name);
    return IPN.toNoteName(step, alter);
  }
}

/** Represents the octave information of a pitch. */
export class PitchOctave {
  constructor(public readonly value: number) {}

  public add(that: PitchOctave): PitchOctave {
    return new PitchOctave(this.value + that.value);
  }

  public sub(that: PitchOctave): PitchOctave {
    return new PitchOctave(this.value - that.value);
  }
}

// --- Pitch ---

/**
 * Represents a musical pitch (e.g., F#4).
 * It is represented by a pair of Octave and NoteName, calculating the distance from Middle C.
 */
export class Pitch {
  constructor(
    public readonly octave: PitchOctave,
    public readonly noteName: PitchNoteName,
  ) {}

  public add(interval: Interval): Pitch {
    return new Pitch(
      new PitchOctave(this.octave.value + interval.octave),
      new PitchNoteName(this.noteName.value + interval.fifth),
    );
  }

  public sub(interval: Interval): Pitch {
    return new Pitch(
      new PitchOctave(this.octave.value - interval.octave),
      new PitchNoteName(this.noteName.value - interval.fifth),
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
    return new Pitch(new PitchOctave(octave), new PitchNoteName(noteName));
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

// --- International Pitch Notation (IPN) Components ---

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
  static fromBaseNoteName(baseNoteName: PitchNoteName): IPNStep {
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
    return new Pitch(new PitchOctave(octaveVal), noteName);
  }

  /**
   * Decomposes a note name into a step and an alteration.
   */
  public static fromNoteName(noteName: PitchNoteName): {
    step: IPNStep;
    alter: IPNAlter;
  } {
    // F(-1) to B(5) are the base note names
    const bases = [-1, 0, 1, 2, 3, 4, 5].map((v) => new PitchNoteName(v));
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
  public static toNoteName(step: IPNStep, alter: IPNAlter): PitchNoteName {
    const baseNoteName = step.basePitch.noteName;
    return new PitchNoteName(baseNoteName.value + alter.value * 7);
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

// --- Interval Components ---

/**
 * Represents the degree part of an interval.
 * It is 0-indexed, meaning a "first" (unison) is represented as 0.
 * e.g., "P1" is 0, "M3" is 2.
 */
export class IntervalStep {
  constructor(public readonly value: number) {}

  public add(other: IntervalStep): IntervalStep {
    return new IntervalStep(this.value + other.value);
  }

  public sub(other: IntervalStep): IntervalStep {
    return new IntervalStep(this.value - other.value);
  }

  public mul(i: number): IntervalStep {
    return new IntervalStep(this.value * i);
  }

  public abs(): IntervalStep {
    return new IntervalStep(Math.abs(this.value));
  }

  /**
   * Converts to a 1-indexed representation.
   */
  public toIdx1(): number {
    return this.value >= 0 ? this.value + 1 : this.value - 1;
  }

  public compareTo(that: IntervalStep): number {
    return this.value - that.value;
  }

  /**
   * Creates an IntervalStep from a common 1-indexed degree (e.g., "3"rd degree becomes 2).
   */
  public static idx1(value: number): IntervalStep {
    if (value === 0) throw new Error("idx1 cannot be 0");
    return new IntervalStep(value >= 1 ? value - 1 : value + 1);
  }
}

/**
 * Represents the quality of an interval (Perfect, Major, Minor, Augmented, Diminished).
 */
export class IntervalAlter {
  constructor(public readonly value: number) {}
}

// --- Interval ---

/**
 * Represents a musical interval.
 * Similar to Pitch, it is expressed by its octave displacement and its position on the circle of fifths.
 * It can be converted to and from pairs of IntervalStep and IntervalAlter (e.g., "Major 3rd").
 */
export class Interval {
  constructor(
    public readonly octave: number,
    public readonly fifth: number,
  ) {}

  public add(that: Interval): Interval {
    return new Interval(this.octave + that.octave, this.fifth + that.fifth);
  }

  public sub(that: Interval): Interval {
    return new Interval(this.octave - that.octave, this.fifth - that.fifth);
  }

  public mul(i: number): Interval {
    return new Interval(this.octave * i, this.fifth * i);
  }

  /**
   * Normalizes the interval into the range of a single octave,
   * always returning a non-negative (upward) interval.
   */
  public normalize(): Interval {
    const s = this.step();
    if (s.value > 0)
      return Interval.fromStepAlter(
        new IntervalStep(s.value % 7),
        this.alter(),
      );
    else if (s.value < 0)
      return Interval.fromStepAlter(
        new IntervalStep((-1 * s.value) % 7),
        this.alter(),
      );
    else return this;
  }

  /**
   * Converts the interval to its IntervalStep and IntervalAlter components.
   */
  public stepAlter(): { step: IntervalStep; alter: IntervalAlter } {
    const stepVal = 4 * this.fifth + 7 * this.octave;
    const absFifth = Math.abs(this.fifth);
    const stepSgn = stepVal < 0 ? -1 : 1;
    const fifthSgn = this.fifth < 0 ? -1 : 1;
    const sgn = stepSgn * fifthSgn;

    let alterVal = 0;
    if (absFifth <= 1) alterVal = 0;
    else if (absFifth <= 5) alterVal = sgn * 1;
    else alterVal = sgn * (2 + Math.floor((absFifth - 6) / 7));

    return {
      step: new IntervalStep(stepVal),
      alter: new IntervalAlter(alterVal),
    };
  }

  public step(): IntervalStep {
    return this.stepAlter().step;
  }

  public alter(): IntervalAlter {
    return this.stepAlter().alter;
  }

  public abs(): Interval {
    if (this.step().value >= 0) return this;
    else return new Interval(-this.octave, -this.fifth);
  }

  /**
   * Returns the interval number representing the interval in semitones.
   */
  public num(): IntervalNumber {
    return new IntervalNumber(this.fifth * 7 + this.octave * 12);
  }

  public toString(): string {
    return Interval.stepAlterToString(this.step(), this.alter());
  }

  /**
   * Parses an interval string (e.g., "P1", "-m3", "A4").
   * Format: [sgn][Quality][Number]
   * sgn: "" | "-"
   * Quality: P=Perfect, M=Major, m=minor, A=Augmented, d=Diminished
   */
  public static parse(name: string): Interval {
    const { step, alter } = Interval.parseStepAlter(name);
    return Interval.fromStepAlter(step, alter);
  }

  private static readonly regex = /^([-]?)([PMm]|A+|d+)(\d+)$/;

  /**
   * Parses an interval string into its IntervalStep and IntervalAlter components.
   */
  public static parseStepAlter(name: string): {
    step: IntervalStep;
    alter: IntervalAlter;
  } {
    const match = name.match(Interval.regex);
    if (match) {
      const [_, sgnStr, qualStr, numStr] = match;
      const num = parseInt(numStr, 10);
      if (num < 1) throw new Error("Interval degree must be 1 or greater");
      const sgn = sgnStr === "-" ? -1 : 1;
      const stepVal = (num - 1) * sgn;

      let alterVal = 0;
      if (qualStr === "P") alterVal = 0;
      else if (qualStr === "M") alterVal = 1;
      else if (qualStr === "m") alterVal = -1;
      else if (qualStr.startsWith("A")) alterVal = qualStr.length + 1;
      else if (qualStr.startsWith("d")) alterVal = -(qualStr.length + 1);

      return {
        step: new IntervalStep(stepVal),
        alter: new IntervalAlter(alterVal),
      };
    }
    throw new Error(`Invalid interval name: ${name}`);
  }

  /**
   * Converts the step and alteration components back into an interval string.
   */
  public static stepAlterToString(
    step: IntervalStep,
    alter: IntervalAlter,
  ): string {
    const s = step.value;
    const sgn = s >= 0 ? "" : "-";
    const num = Math.abs(s) + 1;
    const a = alter.value;

    let qual = "";
    if (a === 0) qual = "P";
    else if (a === 1) qual = "M";
    else if (a === -1) qual = "m";
    else if (a >= 2) qual = "A".repeat(a - 1);
    else if (a <= -2) qual = "d".repeat(-a - 1);
    else qual = "?";

    return `${sgn}${qual}${num}`;
  }

  /**
   * Converts IntervalStep and IntervalAlter components into an Interval instance.
   */
  public static fromStepAlter(
    step: IntervalStep,
    alter: IntervalAlter,
  ): Interval {
    const s = step.value;
    const a = alter.value;
    const fClass = mod(2 * s, 7);
    const stepSgn = s < 0 ? -1 : 1;
    const fBaseSharp = mod(fClass - 6, 7) + 6;
    const fBaseFlat = mod(fClass - 2, 7) - 12;

    let f = 0;
    if (a === 0) {
      const fMap: Record<number, number> = { 0: 0, 1: 1, 6: -1 };
      if (!(fClass in fMap)) throw new Error("Invalid Perfect interval step");
      f = fMap[fClass];
    } else if (a === 1) {
      if (![2, 3, 4, 5].includes(fClass))
        throw new Error("Invalid Major interval step");
      f = stepSgn === 1 ? fClass : fClass - 7;
    } else if (a === -1) {
      if (![2, 3, 4, 5].includes(fClass))
        throw new Error("Invalid Minor interval step");
      f = stepSgn === 1 ? fClass - 7 : fClass;
    } else if (a >= 2) {
      const k = a - 2;
      f = stepSgn === 1 ? fBaseSharp + 7 * k : fBaseFlat - 7 * k;
    } else if (a <= -2) {
      const k = -a - 2;
      f = stepSgn === 1 ? fBaseFlat - 7 * k : fBaseSharp + 7 * k;
    }

    const residual = s - 4 * f;
    return new Interval(Math.floor(residual / 7), f);
  }

  // Common pre-defined constants
  static get P1() {
    return Interval.parse("P1");
  }
  static get P5() {
    return Interval.parse("P5");
  }
  static get P8() {
    return Interval.parse("P8");
  }
  static get M3() {
    return Interval.parse("M3");
  }
  static get m3() {
    return Interval.parse("m3");
  }
  static get d1() {
    return Interval.parse("d1");
  }
  static get A1() {
    return Interval.parse("A1");
  }
  static get A2() {
    return Interval.parse("A2");
  }
  static get d4() {
    return Interval.parse("d4");
  }
  static get A4() {
    return Interval.parse("A4");
  }
  static get d5() {
    return Interval.parse("d5");
  }
  static get A5() {
    return Interval.parse("A5");
  }
  static get m6() {
    return Interval.parse("m6");
  }
  static get M6() {
    return Interval.parse("M6");
  }
  static get A6() {
    return Interval.parse("A6");
  }
}

// --- IntervalNumber ---

/** Represents an interval in semitones. */
export class IntervalNumber {
  constructor(public readonly value: number) {}

  public add(that: IntervalNumber): IntervalNumber {
    return new IntervalNumber(this.value + that.value);
  }

  public sub(that: IntervalNumber): IntervalNumber {
    return new IntervalNumber(this.value - that.value);
  }

  public compareTo(that: IntervalNumber): number {
    return this.value - that.value;
  }
}

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
    public readonly tonic: PitchNoteName,
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
    return new Pitch(new PitchOctave(octave), new PitchNoteName(fifth));
  }

  /**
   * Parses a key string (e.g., "C Major", "A Minor").
   */
  public static parse(name: string): Key {
    const parts = name.split(" ");
    if (parts.length !== 2) throw new Error("Invalid key format");
    return new Key(PitchNoteName.parse(parts[0]), Mode.parse(parts[1]));
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

// --- Degree Components ---

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
  public noteName(key: Key): PitchNoteName {
    const { step: rootStep } = IPN.fromNoteName(key.tonic);
    const { fifth: diatonicVal } = Key.calculateScalePitch(
      key.tonic.value,
      key.mode.offset,
      this.step.value + rootStep.ordinal,
    );
    return new PitchNoteName(diatonicVal + this.alter.value * 7);
  }

  public compareTo(that: Degree): number {
    const s = this.step.compareTo(that.step);
    if (s !== 0) return s;
    return this.alter.compareTo(that.alter);
  }

  /**
   * Determines the degree of a note name relative to a key.
   */
  public static fromNoteNameKey(noteName: PitchNoteName, key: Key): Degree {
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

// --- Duration ---

/**
 * Represents a musical duration, with quarter note = 1.
 */
export class Duration {
  constructor(public readonly value: Rational) {}

  public add(that: Duration): Duration {
    return new Duration(this.value.add(that.value));
  }

  public sub(that: Duration): Duration {
    return new Duration(this.value.sub(that.value));
  }

  public mul(i: number | Rational): Duration {
    return new Duration(this.value.mul(i));
  }

  public compareTo(that: Duration): number {
    return this.value.compareTo(that.value);
  }

  public toString(): string {
    return `d=${this.value.toMixedNumberString()}`;
  }

  /**
   * Converts the duration to an Offset.
   */
  public asOffset(): Offset {
    return new Offset(this.value);
  }

  /**
   * Helper to create a Duration from raw numerator and denominator.
   */
  public static of(numerator: number, denominator = 1): Duration {
    return new Duration(new Rational(numerator, denominator));
  }

  public static parse(s: string): Duration {
    return new Duration(Rational.parse(s));
  }
}

// --- Offset ---

/**
 * Represents an offset from a reference point (e.g., beginning of a measure).
 * Always counts from 0, so the first beat is Offset(0).
 */
export class Offset {
  constructor(public readonly value: Rational) {}

  public add(that: Offset | Duration): Offset {
    return new Offset(this.value.add(that.value));
  }

  public sub(that: Offset): Duration {
    return new Duration(this.value.sub(that.value));
  }

  public mul(i: number | Rational): Offset {
    return new Offset(this.value.mul(i));
  }

  public compareTo(that: Offset): number {
    return this.value.compareTo(that.value);
  }

  public toString(): string {
    return `${this.value.toMixedNumberString()}`;
  }

  /**
   * Converts the offset to a Duration.
   */
  public asDuration(): Duration {
    return new Duration(this.value);
  }

  public static of(numerator: number, denominator = 1): Offset {
    return new Offset(new Rational(numerator, denominator));
  }

  /**
   * Helper to create an Offset from a 1-indexed value.
   */
  public static idx1(numerator: number, denominator = 1): Offset {
    return new Offset(new Rational(numerator - 1, denominator));
  }

  public static parse(s: string): Offset {
    return new Offset(Rational.parse(s));
  }
}

// --- Span ---

/**
 * Represents a time range in a score (start: inclusive, end: exclusive).
 */
export class Span {
  constructor(
    public readonly start: Offset,
    public readonly end: Offset,
  ) {
    if (start.compareTo(end) >= 0) {
      throw new Error(`Illegal span value. start: ${start}, end: ${end}`);
    }
  }

  public toString(): string {
    return `Span(${this.start.value.toMixedNumberString()} ~ ${this.end.value.toMixedNumberString()})`;
  }

  public static parse(startStr: string, endStr: string): Span {
    return new Span(Offset.parse(startStr), Offset.parse(endStr));
  }
}

// --- Scope ---

/** Represents a scope within a score, encompassing specific parts and a time range. */
export interface Scope {
  parts: Set<Part>;
  span: Span;
}

// --- Part ---

/**
 * Represents musical part information.
 * Parts can be managed hierarchically (e.g., "Soprano:voice1").
 */
export class Part {
  constructor(public readonly hierarchy: string[]) {}

  /**
   * Creates a sub-part under the current hierarchy.
   */
  public spawn(childName: string): Part {
    return new Part([...this.hierarchy, childName]);
  }

  /**
   * Returns true if the provided part is a descendant of this part.
   * e.g., Part("Soprano") is a superset of Part("Soprano", "voice1").
   */
  public isSupersetOf(descendant: Part): boolean {
    if (descendant.hierarchy.length < this.hierarchy.length) return false;
    for (let i = 0; i < this.hierarchy.length; i++) {
      if (this.hierarchy[i] !== descendant.hierarchy[i]) return false;
    }
    return true;
  }

  public toString(): string {
    if (this.hierarchy.length === 0) return "Root";
    return this.hierarchy.join(":");
  }

  public compareTo(that: Part): number {
    // Compares hierarchy elements one by one from the top level.
    const len = Math.min(this.hierarchy.length, that.hierarchy.length);
    for (let i = 0; i < len; i++) {
      const cmp = this.hierarchy[i].localeCompare(that.hierarchy[i]);
      if (cmp !== 0) return cmp;
    }
    // If common parts match, the shallower hierarchy comes first.
    return this.hierarchy.length - that.hierarchy.length;
  }

  static readonly Root = new Part([]);

  public static of(...names: string[]): Part {
    return new Part(names);
  }

  /**
   * Finds the least common ancestor of the provided parts.
   * e.g., [A:B:C, A:B:D] -> A:B, [A:B, X:Y] -> Root.
   */
  public static commonAncestor(parts: Iterable<Part>): Part {
    const partsArray = Array.from(parts);
    if (partsArray.length === 0) return Part.Root;

    let common = partsArray[0].hierarchy;
    for (let i = 1; i < partsArray.length; i++) {
      const current = partsArray[i].hierarchy;
      let j = 0;
      while (
        j < common.length &&
        j < current.length &&
        common[j] === current[j]
      ) {
        j++;
      }
      common = common.slice(0, j);
    }
    return new Part(common);
  }

  /**
   * Creates a part comparator based on a specified part order.
   * The first level hierarchy follows the provided order, while deeper levels use alphabetical order.
   */
  public static ordering(...order: string[]): (x: Part, y: Part) => number {
    const orderMap = new Map(order.map((name, i) => [name, i]));
    const getValue = (name: string) => orderMap.get(name) ?? Infinity;

    return (x, y) => {
      const len = Math.min(x.hierarchy.length, y.hierarchy.length);
      for (let i = 0; i < len; i++) {
        let res = 0;
        if (i === 0) {
          res = getValue(x.hierarchy[i]) - getValue(y.hierarchy[i]);
        } else {
          res = x.hierarchy[i].localeCompare(y.hierarchy[i]);
        }
        if (res !== 0) return res;
      }
      return x.hierarchy.length - y.hierarchy.length;
    };
  }
}

// --- Rest ---

/** Represents a musical rest. */
export const Rest = Symbol("Rest");
export type Rest = typeof Rest;
