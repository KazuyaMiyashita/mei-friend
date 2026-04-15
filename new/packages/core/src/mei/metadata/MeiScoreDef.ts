import type { MeiElement } from "../../MeiElement.js";

/**
 * Wrapper for <scoreDef> element.
 */
export class MeiScoreDef {
  constructor(public readonly element: MeiElement) {}

  /**
   * Returns the meter count from @meter.count.
   */
  get meterCount(): number | undefined {
    const count = this.element.getAttribute("meter.count");
    return count ? parseInt(count, 10) : undefined;
  }

  /**
   * Returns the meter unit from @meter.unit.
   */
  get meterUnit(): number | undefined {
    const unit = this.element.getAttribute("meter.unit");
    return unit ? parseInt(unit, 10) : undefined;
  }
}
