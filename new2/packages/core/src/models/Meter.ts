import type { Duration } from './Duration'
import { Fraction } from './Fraction'

/**
 * Represents a meter.
 * For 4/4 time, it holds count=4, unit=Duration.quarter().
 */
export class Meter {
  constructor(
    public readonly count: number,
    public readonly unit: Duration,
  ) {}

  /** Returns the total length of the measure as a Fraction */
  get totalLength(): Fraction {
    return this.unit.value.mul(Fraction.fromInt(this.count))
  }
}
