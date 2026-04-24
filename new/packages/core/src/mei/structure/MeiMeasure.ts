import { MeiElement } from "../../MeiElement.js";
import { MeiStaff } from "./MeiStaff.js";

/**
 * Wrapper for `<measure>` element.
 *
 * https://music-encoding.org/guidelines/v5/elements/measure.html
 */
export class MeiMeasure extends MeiElement {
  static create(element: MeiElement): MeiMeasure | undefined {
    if (element.tagName === "measure") {
      return new MeiMeasure(element.yNode);
    }
    return undefined;
  }

  get n(): string | undefined {
    return this.getAttribute("n");
  }

  get staffs(): MeiStaff[] {
    return this.findDescendants(MeiStaff);
  }
}
