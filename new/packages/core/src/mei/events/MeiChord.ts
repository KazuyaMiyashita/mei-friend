import { MeiElement } from "../../MeiElement.js";
import type { Duration } from "../../models/index.js";
import { MeiNote } from "./MeiNote.js";
import { getDuration } from "./utils.js";

/**
 * Wrapper for <chord> element.
 */
export class MeiChord extends MeiElement {
  static create(element: MeiElement): MeiChord | undefined {
    if (element.tagName === "chord") {
      return new MeiChord(element.yNode);
    }
    return undefined;
  }

  /** Returns the musical duration. */
  get duration(): Duration | undefined {
    return getDuration(this);
  }

  /** Returns the notes within the chord. */
  get notes(): MeiNote[] {
    return this.children
      .map((c) => MeiNote.create(c))
      .filter((n): n is MeiNote => !!n);
  }
}
