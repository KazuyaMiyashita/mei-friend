import { mod } from "./math.js";

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
