import { MeiElement } from "../../MeiElement.js";
import { MeiStaff } from "./MeiStaff.js";

/**
 * Wrapper for <measure> element.
 */
export class MeiMeasure extends MeiElement {
  static create(element: MeiElement): MeiMeasure | undefined {
    if (element.tagName === "measure") {
      return new MeiMeasure(element.yNode, element.doc);
    }
    return undefined;
  }

  /** Returns the measure number. */
  get n(): string | undefined {
    return this.getAttribute("n");
  }

  /** Returns the staff elements within the measure. */
  get staffs(): MeiStaff[] {
    return this.children
      .map((c) => MeiStaff.create(c))
      .filter((s): s is MeiStaff => !!s);
  }
}
