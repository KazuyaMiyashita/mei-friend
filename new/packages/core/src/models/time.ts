import { Rational } from "./math.js";
import type { Part } from "./part.js";

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
