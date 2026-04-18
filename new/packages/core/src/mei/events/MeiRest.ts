import type { MeiElement } from "../../MeiElement.js";
import type { Duration } from "../../models/elements.js";
import { getDuration } from "./utils.js";

/**
 * Wrapper for <rest>, <mRest>, or <mSpace> element.
 */
export class MeiRest {
  constructor(
    public readonly element: MeiElement,
    private readonly measureDuration?: Duration,
  ) {}

  /** Returns the xml:id or id. */
  get id(): string | undefined {
    return this.element.id;
  }

  /** Returns the musical duration. */
  get duration(): Duration | undefined {
    if (this.element.tagName === "mRest" || this.element.tagName === "mSpace") {
      return this.measureDuration;
    }
    return getDuration(this.element);
  }
}
