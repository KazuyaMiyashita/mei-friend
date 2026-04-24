import { MeiElement } from "../../MeiElement.js";
import { Rational } from "../../models/math.js";

/**
 * Wrapper for `<tuplet>` element.
 *
 * https://music-encoding.org/guidelines/v5/elements/tuplet.html
 */
export class MeiTuplet extends MeiElement {
  static create(element: MeiElement): MeiTuplet | undefined {
    if (element.tagName === "tuplet") {
      return new MeiTuplet(element.yNode);
    }
    return undefined;
  }

  /**
   * Returns the duration multiplier of the tuplet (num / numbase).
   */
  get multiplier(): Rational {
    const num = this.getAttribute("num");
    const numbase = this.getAttribute("numbase");
    if (num && numbase) {
      return new Rational(parseInt(numbase, 10), parseInt(num, 10));
    }
    return new Rational(1, 1);
  }
}
