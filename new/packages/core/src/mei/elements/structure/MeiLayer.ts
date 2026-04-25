import { MeiElement } from "../../../MeiElement.js";

/**
 * Wrapper for `<layer>` element.
 *
 * https://music-encoding.org/guidelines/v5/elements/layer.html
 */
export class MeiLayer extends MeiElement {
  static create(element: MeiElement): MeiLayer | undefined {
    if (element.tagName === "layer") {
      return new MeiLayer(element.yNode);
    }
    return undefined;
  }

  get n(): number | undefined {
    const val = this.getAttribute("n");
    return val !== undefined ? parseInt(val, 10) : undefined;
  }
}
