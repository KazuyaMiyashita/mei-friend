import { MeiElement } from "../../MeiElement.js";
import { Duration } from "../../models/elements.js";

/**
 * Wrapper for <meterSig> element.
 */
export class MeiMeterSig extends MeiElement {
  static create(element: MeiElement): MeiMeterSig | undefined {
    if (element.tagName === "meterSig") {
      return new MeiMeterSig(element.yNode, element.doc);
    }
    return undefined;
  }

  /**
   * Returns the meter count from @count.
   */
  get count(): number | undefined {
    const count = this.getAttribute("count");
    return count ? parseInt(count, 10) : undefined;
  }

  /**
   * Returns the meter unit from @unit.
   */
  get unit(): number | undefined {
    const unit = this.getAttribute("unit");
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
