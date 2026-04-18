import { MeiElement } from "../../MeiElement.js";
import { MeiLayer } from "./MeiLayer.js";

/**
 * Wrapper for <staff> element.
 */
export class MeiStaff extends MeiElement {
  static create(element: MeiElement): MeiStaff | undefined {
    if (element.tagName === "staff") {
      return new MeiStaff(element.yNode, element.doc);
    }
    return undefined;
  }

  /** Returns the staff number. */
  get n(): string | undefined {
    return this.getAttribute("n");
  }

  /** Returns all layers in this staff. */
  get layers(): MeiLayer[] {
    return this.children
      .map((c) => MeiLayer.create(c))
      .filter((l): l is MeiLayer => !!l);
  }
}
