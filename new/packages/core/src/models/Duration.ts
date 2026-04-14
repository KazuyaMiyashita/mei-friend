import { Fraction } from './Fraction'

/**
 * Represents a musical duration.
 * Consists of a Fraction where a quarter note is '1'.
 */
export class Duration {
  constructor(public readonly value: Fraction) {}

  /** Quarter note (1) */
  static quarter(): Duration {
    return new Duration(new Fraction(1, 1))
  }

  /** Whole note (4) */
  static whole(): Duration {
    return new Duration(new Fraction(4, 1))
  }

  /**
   * Constructs a Duration from MEI @dur and @dots.
   * @param dur Reciprocal of the duration (e.g., "4" for a quarter note)
   * @param dots Number of dots (default: 0)
   */
  static fromMei(dur: string | number, dots: number = 0): Duration {
    const d = typeof dur === 'string' ? parseInt(dur, 10) : dur
    if (Number.isNaN(d) || d <= 0) return new Duration(Fraction.zero())

    // Base duration: 4 / d (with quarter note as 1)
    const base = new Fraction(4, d)

    // Calculation of dots: 1 + 1/2 + 1/4 + ...
    let multiplier = new Fraction(1, 1)
    for (let i = 1; i <= dots; i++) {
      multiplier = multiplier.add(new Fraction(1, 2 ** i))
    }

    return new Duration(base.mul(multiplier))
  }

  add(other: Duration): Duration {
    return new Duration(this.value.add(other.value))
  }

  equals(other: Duration): boolean {
    return this.value.equals(other.value)
  }

  toNumber(): number {
    return this.value.toNumber()
  }
}
