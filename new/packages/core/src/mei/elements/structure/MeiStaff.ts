import { MeiElement } from "../../../MeiElement.js";

/**
 * Wrapper for `<staff>` element.
 *
 * https://music-encoding.org/guidelines/v5/elements/staff.html
 */
export class MeiStaff extends MeiElement {
  static create(element: MeiElement): MeiStaff | undefined {
    if (element.tagName === "staff") {
      return new MeiStaff(element.yNode);
    }
    return undefined;
  }

  get n(): number | undefined {
    const val = this.getAttribute("n");
    return val !== undefined ? parseInt(val, 10) : undefined;
  }
}
