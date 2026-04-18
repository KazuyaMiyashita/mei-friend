import { MeiElement } from "../../MeiElement.js";
import {
  type Duration,
  InternationalPitch,
  InternationalPitchAlter,
  InternationalPitchOctave,
  InternationalPitchStep,
  type Pitch,
} from "../../models/elements.js";
import { getDuration } from "./utils.js";

/**
 * Wrapper for <note> element.
 */
export class MeiNote extends MeiElement {
  static create(element: MeiElement): MeiNote | undefined {
    if (element.tagName === "note") {
      return new MeiNote(element.yNode, element.doc);
    }
    return undefined;
  }

  /** Returns the musical duration. */
  get duration(): Duration | undefined {
    return getDuration(this);
  }

  /** Returns the Pitch of the note. */
  get pitch(): Pitch | undefined {
    const attrs = this.getAttributes();
    const pname = attrs.pname?.toLowerCase();
    if (!pname) return undefined;

    const oct = attrs.oct ? parseInt(attrs.oct, 10) : 4;

    const stepMap: Record<string, InternationalPitchStep> = {
      a: InternationalPitchStep.A,
      b: InternationalPitchStep.B,
      c: InternationalPitchStep.C,
      d: InternationalPitchStep.D,
      e: InternationalPitchStep.E,
      f: InternationalPitchStep.F,
      g: InternationalPitchStep.G,
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

    return new InternationalPitch(
      step,
      new InternationalPitchAlter(alterVal),
      new InternationalPitchOctave(oct),
    ).toPitch();
  }
}
