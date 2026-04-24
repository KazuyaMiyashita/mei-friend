import type { MeiDraft } from "../../../MeiDraft.js";
import { MeiElement } from "../../../MeiElement.js";
import type { IPNAlter } from "../../../models/index.js";
import {
  alterToGesturalAccid,
  alterToWrittenAccid,
  writtenAccidToAlter,
} from "../../attributes/accid.js";

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

  /**
   * MEI written accid value → IPN alter integer.
   * Delegates to `attributes/accid.writtenAccidToAlter`.
   */
  static readonly valueToAlter: Readonly<Record<string, number>> =
    writtenAccidToAlter;

  /**
   * IPN alter integer → MEI gestural accid.ges value.
   * Natural (alter = 0) → undefined (attribute should be absent).
   * Delegates to `attributes/accid.alterToGesturalAccid`.
   */
  static readonly alterToGesturalAccid: Readonly<Record<number, string>> =
    alterToGesturalAccid;

  /**
   * Returns the MEI `accid.ges` string for a given IPN alter value,
   * or `undefined` for natural (alter = 0).
   */
  static alterToAccidGes(alter: number): string | undefined {
    return alterToGesturalAccid[alter];
  }

  /** The `accid` attribute value (printed accidental, e.g. `"s"`, `"f"`, `"n"`). */
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

  /**
   * Returns a recipe that sets the `accid` attribute to the written accidental
   * value for `alter`, or removes the attribute when `alter` is `undefined`.
   * Natural (alter = 0) sets `accid="n"`.
   */
  static applyAccidRecipe(
    alter: IPNAlter | undefined,
  ): (draft: MeiDraft) => void {
    return (draft) => {
      if (alter !== undefined) {
        const value = alterToWrittenAccid[alter.value];
        if (value !== undefined) draft.setAttribute("accid", value);
      } else {
        draft.removeAttribute("accid");
      }
    };
  }
}
