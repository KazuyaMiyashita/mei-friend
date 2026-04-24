import { MeiElement } from "../../MeiElement.js";

/**
 * Wrapper for `<accid>` element.
 *
 * https://music-encoding.org/guidelines/v5/elements/accid.html
 *
 * The `accid` attribute represents accidentals written in the musical score.
 *
 * Programmatically, the pitch calculation will be performed in the following order of priority:
 * `accid.ges` of `<note>`, the `accid` attribute of this element, and then the `accid` attribute of `<note>`.
 */
export class MeiAccid extends MeiElement {
  static create(element: MeiElement): MeiAccid | undefined {
    if (element.tagName === "accid") return new MeiAccid(element.yNode);
    return undefined;
  }

  /** MEI accid attribute value → IPN alter integer. */
  static readonly valueToAlter: Readonly<Record<string, number>> = {
    s: 1,
    x: 2,
    ss: 2,
    f: -1,
    ff: -2,
    n: 0,
  };

  /** IPN alter integer → MEI accid attribute value for gestural accidentals. */
  static readonly alterToValue: Readonly<Record<number, string>> = {
    1: "s",
    2: "ss",
    [-1]: "f",
    [-2]: "ff",
  };

  /**
   * Returns the MEI accid string for a given IPN alter value,
   * or `undefined` for natural (alter = 0).
   */
  static alterToAccidGes(alter: number): string | undefined {
    return MeiAccid.alterToValue[alter];
  }

  /** The `accid` attribute value (printed accidental, e.g. `"s"`, `"f"`). */
  get accid(): string | undefined {
    return this.getAttribute("accid");
  }

  /** The `func` attribute value (e.g. `"caution"`, `"edit"`). */
  get func(): string | undefined {
    return this.getAttribute("func");
  }

  /** The `place` attribute value (e.g. `"above"`, `"below"`). */
  get place(): string | undefined {
    return this.getAttribute("place");
  }
}
