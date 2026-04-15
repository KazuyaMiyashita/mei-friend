import type { MeiElement } from "../../MeiElement.js";
import { MeiLayer } from "./MeiLayer.js";

/**
 * Wrapper for <staff> element.
 */
export class MeiStaff {
  constructor(public readonly element: MeiElement) {}

  /** Returns the staff number. */
  get n(): string | undefined {
    return this.element.getAttribute("n");
  }

  /** Returns the layer elements within the staff. */
  get layers(): MeiLayer[] {
    return this.element.children
      .filter((c) => c.tagName === "layer")
      .map((c) => new MeiLayer(c));
  }
}
