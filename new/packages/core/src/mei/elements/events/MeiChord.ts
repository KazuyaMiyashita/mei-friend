import { MeiElement } from "../../../MeiElement.js";
import type { Duration } from "../../../models/index.js";
import { getDuration } from "../../utils/duration.js";
import { MeiNote } from "./MeiNote.js";

/**
 * Wrapper for `<chord>` element.
 *
 * https://music-encoding.org/guidelines/v5/elements/chord.html
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
  get notes(): ReadonlyArray<MeiNote> {
    return this.findChildren(MeiNote);
  }
}
