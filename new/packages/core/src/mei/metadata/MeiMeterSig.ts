import type { MeiElement } from "../../MeiElement.js";

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
}
