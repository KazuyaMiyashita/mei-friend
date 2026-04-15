import type { MeiElement } from "../../MeiElement.js";

/**
 * Wrapper for <layer> element.
 */
export class MeiLayer {
  constructor(public readonly element: MeiElement) {}

  /** Returns the layer number. */
  get n(): string | undefined {
    return this.element.getAttribute("n");
  }
}
