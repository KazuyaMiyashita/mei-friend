import type { MeiDraft } from "../../MeiDraft.js";
import { MeiElement } from "../../MeiElement.js";
import {
  type Duration,
  IPN,
  IPNAlter,
  IPNOctave,
  IPNStep,
  type Pitch,
} from "../../models/elements.js";
import { alterToAccidGes, getDuration } from "./utils.js";

/**
 * Wrapper for <note> element.
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
    return !!this.getChildElement("accid");
  }

  /**
   * Returns a `produceElement` recipe that rewrites the pitch-related attributes
   * (`pname`, `oct`, `accid.ges`) to match `ipn` and strips any `<accid>` child.
   * All other children (articulations, verse, etc.) are left untouched because
   * `produceElement` starts from a full clone of the original element.
   */
  static applyPitchRecipe(ipn: IPN): (draft: MeiDraft) => void {
    return (draft) => {
      draft.setAttribute("pname", ipn.step.name.toLowerCase());
      draft.setAttribute("oct", String(ipn.octave.value));
      const accidGes = alterToAccidGes(ipn.alter.value);
      if (accidGes) draft.setAttribute("accid.ges", accidGes);
      else draft.removeAttribute("accid.ges");
      draft.removeChildrenByTag("accid");
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

    // Accid handling: accid.ges or <accid> child
    let alterVal = 0;
    const accidGes = attrs["accid.ges"];
    const accidChild = this.children.find((c) => c.tagName === "accid");
    const accid = accidGes || accidChild?.getAttribute("accid");

    if (accid) {
      switch (accid) {
        case "s":
          alterVal = 1;
          break;
        case "x":
        case "ss":
          alterVal = 2;
          break;
        case "f":
          alterVal = -1;
          break;
        case "ff":
          alterVal = -2;
          break;
        case "n":
          alterVal = 0;
          break;
      }
    }

    return new IPN(step, new IPNAlter(alterVal), new IPNOctave(oct)).toPitch();
  }
}
