import { Fraction } from './Fraction'

/**
 * Represents a position (offset) within a measure.
 * Consists of a Fraction, where the beginning of the measure is 0.
 */
export class Offset {
  constructor(public readonly value: Fraction) {}

  static start(): Offset {
    return new Offset(Fraction.zero())
  }

  add(duration: import('./Duration').Duration): Offset {
    return new Offset(this.value.add(duration.value))
  }

  equals(other: Offset): boolean {
    return this.value.equals(other.value)
  }

  compare(other: Offset): number {
    return this.value.compare(other.value)
  }

  toNumber(): number {
    return this.value.toNumber()
  }
}
