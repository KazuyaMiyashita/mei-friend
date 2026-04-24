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

  /** The `n` attribute as a 1-based integer. Defaults to 1 if absent. */
  get n(): number {
    return parseInt(this.getAttribute("n") ?? "1", 10);
  }
}
