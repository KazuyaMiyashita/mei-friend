import { MeiElement } from "../../MeiElement.js";

/**
 * Wrapper for <layer> element.
 */
export class MeiLayer extends MeiElement {
  static create(element: MeiElement): MeiLayer | undefined {
    if (element.tagName === "layer") {
      return new MeiLayer(element.yNode);
    }
    return undefined;
  }

  get n(): string | undefined {
    return this.getAttribute("n");
  }
}
