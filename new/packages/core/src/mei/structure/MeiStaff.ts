import { MeiElement } from "../../MeiElement.js";

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

  get n(): string | undefined {
    return this.getAttribute("n");
  }
}
