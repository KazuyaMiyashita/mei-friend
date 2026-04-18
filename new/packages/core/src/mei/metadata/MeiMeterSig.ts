import type { MeiElement } from "../../MeiElement.js";
import { Duration } from "../../models/elements.js";

/**
 * Wrapper for <meterSig> element.
 */
export class MeiMeterSig {
  constructor(public readonly element: MeiElement) {}

  /**
   * Returns the meter count from @count.
   */
  get count(): number | undefined {
    const count = this.element.getAttribute("count");
    return count ? parseInt(count, 10) : undefined;
  }

  /**
   * Returns the meter unit from @unit.
   */
  get unit(): number | undefined {
    const unit = this.element.getAttribute("unit");
    return unit ? parseInt(unit, 10) : undefined;
  }

  /**
   * Returns the duration of one beat (quarter note = Duration.of(1)).
   * For 4/4 time, unit=4 → Duration.of(1).
   */
  get beatDuration(): Duration | undefined {
    const unit = this.unit;
    if (!unit) return undefined;
    return Duration.of(4, unit);
  }
}
