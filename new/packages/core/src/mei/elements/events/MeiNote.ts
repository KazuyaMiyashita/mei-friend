import type { MeiDraft } from "../../../MeiDraft.js";
import { MeiElement } from "../../../MeiElement.js";
import {
  type Duration,
  IPN,
  IPNAlter,
  IPNOctave,
  IPNStep,
  type Pitch,
} from "../../../models/index.js";
import { alterToGesturalAccid } from "../../attributes/accid.js";
import { getDuration } from "../../utils/duration.js";
import { MeiAccid } from "./MeiAccid.js";

/**
 * Wrapper for `<note>` element.
 *
 * https://music-encoding.org/guidelines/v5/elements/note.html
 */
export class MeiNote extends MeiElement {
  static create(element: MeiElement): MeiNote | undefined {
    if (element.tagName === "note") {
      return new MeiNote(element.yNode);
    }
    return undefined;
  }

  /** Returns the musical duration. */
  get duration(): Duration | undefined {
    return getDuration(this);
  }

  /** True if a printed accidental is expressed as an `<accid>` child element. */
  get hasPrintedAccidental(): boolean {
    return !!this.findChild(MeiAccid);
  }

  /**
   * Returns a `produceElement` recipe that rewrites the pitch-related attributes
   * (`pname`, `oct`, `accid.ges`) to match `ipn`.
   *
   * When `printedAccidental` is provided, an `<accid>` child element is added
   * with the corresponding written accidental value (including `"n"` for natural).
   * When omitted, any existing `<accid>` child is removed.
   *
   * All other children (articulations, verse, etc.) are left untouched because
   * `produceElement` starts from a full clone of the original element.
   */
  static applyPitchRecipe(
    ipn: IPN,
    printedAccidental?: IPNAlter,
  ): (draft: MeiDraft) => void {
    return (draft) => {
      draft.setAttribute("pname", ipn.step.name.toLowerCase());
      draft.setAttribute("oct", String(ipn.octave.value));

      const accidGes = alterToGesturalAccid[ipn.alter.value];
      if (accidGes) draft.setAttribute("accid.ges", accidGes);
      else draft.removeAttribute("accid.ges");

      draft.removeChildrenByTag("accid");
      if (printedAccidental !== undefined) {
        MeiAccid.applyAccidRecipe(printedAccidental)(
          draft.getOrInsertChild("accid"),
        );
      }
    };
  }

  /**
   * Returns a recipe that updates only the gestural accidental (`accid.ges`).
   * Natural (alter = 0) removes the attribute; other values set it.
   */
  static applyGesturalAccidRecipe(alter: IPNAlter): (draft: MeiDraft) => void {
    return (draft) => {
      const accidGes = alterToGesturalAccid[alter.value];
      if (accidGes) draft.setAttribute("accid.ges", accidGes);
      else draft.removeAttribute("accid.ges");
    };
  }

  /**
   * Returns a recipe that removes any printed `<accid>` child and reverts the
   * gestural accidental to the key-signature default represented by `keyAlter`.
   * Used when a neighbouring note's accidental carry-over becomes redundant.
   */
  static applyKeyDefaultAccidRecipe(
    keyAlter: IPNAlter,
  ): (draft: MeiDraft) => void {
    return (draft) => {
      draft.removeChildrenByTag("accid");
      const accidGes = alterToGesturalAccid[keyAlter.value];
      if (accidGes) draft.setAttribute("accid.ges", accidGes);
      else draft.removeAttribute("accid.ges");
    };
  }

  /** Returns the Pitch of the note. */
  get pitch(): Pitch | undefined {
    const attrs = this.getAttributes();
    const pname = attrs.pname?.toLowerCase();
    if (!pname) return undefined;

    const oct = attrs.oct ? parseInt(attrs.oct, 10) : 4;

    const stepMap: Record<string, IPNStep> = {
      a: IPNStep.A,
      b: IPNStep.B,
      c: IPNStep.C,
      d: IPNStep.D,
      e: IPNStep.E,
      f: IPNStep.F,
      g: IPNStep.G,
    };
    const step = stepMap[pname];
    if (!step) return undefined;

    // Accid priority: accid.ges attribute, then <accid> child's accid attribute.
    const accidGes = attrs["accid.ges"];
    const accidChild = this.findChild(MeiAccid);
    const accid = accidGes ?? accidChild?.accid;
    const alterVal =
      accid !== undefined ? (MeiAccid.valueToAlter[accid] ?? 0) : 0;

    return new IPN(step, new IPNAlter(alterVal), new IPNOctave(oct)).toPitch();
  }
}
