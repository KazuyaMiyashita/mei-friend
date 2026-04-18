import { MeiElement } from "../../MeiElement.js";
import { Rational } from "../../models/math.js";

/**
 * Wrapper for <tuplet> element.
 */
export class MeiTuplet extends MeiElement {
  static create(element: MeiElement): MeiTuplet | undefined {
    if (element.tagName === "tuplet") {
      return new MeiTuplet(element.yNode, element.doc);
    }
    return undefined;
  }

  /**
   * Returns the duration multiplier for the tuplet based on @num and @numbase.
   */
  get multiplier(): Rational | undefined {
    const num = this.getAttribute("num");
    const numbase = this.getAttribute("numbase");
    if (num && numbase) {
      const n = parseInt(num, 10);
      const nb = parseInt(numbase, 10);
      if (!Number.isNaN(n) && !Number.isNaN(nb) && n !== 0) {
        return new Rational(nb, n);
      }
    }
    return undefined;
  }
}
