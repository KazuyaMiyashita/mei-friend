import { MeiElement } from "../../MeiElement.js";

/**
 * Wrapper for <tie> element.
 */
export class MeiTie extends MeiElement {
  static create(element: MeiElement): MeiTie | undefined {
    if (element.tagName === "tie") {
      return new MeiTie(element.yNode);
    }
    return undefined;
  }

  get startid(): string | undefined {
    return this.getAttribute("startid");
  }

  get endid(): string | undefined {
    return this.getAttribute("endid");
  }
}
