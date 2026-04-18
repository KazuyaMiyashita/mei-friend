import type * as Y from "yjs";
import { MeiElement } from "../../MeiElement.js";
import type { MeiFriend } from "../../MeiFriend.js";
import type { Duration } from "../../models/elements.js";
import { getDuration } from "./utils.js";

/**
 * Wrapper for <rest>, <mRest>, or <mSpace> element.
 */
export class MeiRest extends MeiElement {
  static create(
    element: MeiElement,
    measureDuration?: Duration,
  ): MeiRest | undefined {
    if (["rest", "mRest", "mSpace"].includes(element.tagName)) {
      return new MeiRest(element.yNode, element.doc, measureDuration);
    }
    return undefined;
  }

  constructor(
    yNode: Y.XmlElement,
    doc: MeiFriend,
    public readonly measureDuration?: Duration,
  ) {
    super(yNode, doc);
  }

  /** Returns the musical duration. */
  get duration(): Duration | undefined {
    if (this.tagName === "mRest" || this.tagName === "mSpace") {
      return this.measureDuration;
    }
    return getDuration(this);
  }
}
