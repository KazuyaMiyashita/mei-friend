import type { MeiElement } from "../../MeiElement.js";
import { MeiStaff } from "./MeiStaff.js";

/**
 * Wrapper for <measure> element.
 */
export class MeiMeasure {
  constructor(public readonly element: MeiElement) {}

  /** Returns the measure number. */
  get n(): string | undefined {
    return this.element.getAttribute("n");
  }

  /** Returns the staff elements within the measure. */
  get staffs(): MeiStaff[] {
    return this.element.children
      .filter((c) => c.tagName === "staff")
      .map((c) => new MeiStaff(c));
  }
}
