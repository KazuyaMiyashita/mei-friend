import type { MeiElement } from "../../MeiElement.js";
import type { Duration } from "../../models/elements.js";
import { MeiNote } from "./MeiNote.js";
import { getDuration } from "./utils.js";

/**
 * Wrapper for <chord> element.
 */
export class MeiChord {
  constructor(public readonly element: MeiElement) {}

  /** Returns the xml:id or id. */
  get id(): string | undefined {
    return this.element.id;
  }

  /** Returns the musical duration. */
  get duration(): Duration | undefined {
    return getDuration(this.element);
  }

  /** Returns the notes within the chord. */
  get notes(): MeiNote[] {
    return this.element.children
      .filter((c) => c.tagName === "note")
      .map((c) => new MeiNote(c));
  }
}
