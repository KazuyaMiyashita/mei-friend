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

  /** The `n` attribute as a 1-based integer. Defaults to 1 if absent. */
  get n(): number {
    return parseInt(this.getAttribute("n") ?? "1", 10);
  }
}
