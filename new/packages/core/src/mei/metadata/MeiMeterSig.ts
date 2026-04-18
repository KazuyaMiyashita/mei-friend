import { MeiElement } from "../../MeiElement.js";

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
}
