import { MeiElement } from "../../MeiElement.js";

/**
 * Wrapper for <tie> element.
 */
export class MeiTie extends MeiElement {
  static create(element: MeiElement): MeiTie | undefined {
    if (element.tagName === "tie") {
      return new MeiTie(element.yNode, element.doc);
    }
    return undefined;
  }

  /** Returns the startid attribute (without #). */
  get startId(): string | undefined {
    const sid = this.getAttribute("startid");
    return sid?.startsWith("#") ? sid.substring(1) : sid;
  }

  /** Returns the endid attribute (without #). */
  get endId(): string | undefined {
    const eid = this.getAttribute("endid");
    return eid?.startsWith("#") ? eid.substring(1) : eid;
  }
}
