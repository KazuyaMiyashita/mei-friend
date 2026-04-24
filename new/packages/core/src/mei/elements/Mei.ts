import { MeiElement } from "../../MeiElement.js";
import { MeiHead } from "./header/MeiHead.js";

/**
 * Wrapper for <mei> element.
 */
export class Mei extends MeiElement {
  static create(element: MeiElement): Mei | undefined {
    if (element.tagName === "mei") {
      return new Mei(element.yNode);
    }
    return undefined;
  }

  /** Returns the MEI header wrapper. */
  get meiHead(): MeiHead | undefined {
    const headEl = this.getChildElement("meiHead");
    return headEl ? MeiHead.create(headEl) : undefined;
  }
}
