import { MeiElement } from "../../../MeiElement.js";

/**
 * Wrapper for `<meterSig>` element.
 *
 * https://music-encoding.org/guidelines/v5/elements/meterSig.html
 */
export class MeiMeterSig extends MeiElement {
  static create(element: MeiElement): MeiMeterSig | undefined {
    if (element.tagName === "meterSig") {
      return new MeiMeterSig(element.yNode);
    }
    return undefined;
  }

  get count(): number | undefined {
    const val = this.getAttribute("count");
    return val ? parseInt(val, 10) : undefined;
  }

  get unit(): number | undefined {
    const val = this.getAttribute("unit");
    return val ? parseInt(val, 10) : undefined;
  }
}
