import { MeiElement } from "../../MeiElement.js";
import { type Duration, Rest } from "../../models/elements.js";
import { getDuration } from "./utils.js";

/**
 * Wrapper for <rest> or <mRest> element.
 */
export class MeiRest extends MeiElement {
  static create(element: MeiElement): MeiRest | undefined {
    if (element.tagName === "rest" || element.tagName === "mRest") {
      return new MeiRest(element.yNode);
    }
    return undefined;
  }

  /** Returns the musical duration. */
  get duration(): Duration | undefined {
    return getDuration(this);
  }

  /** Returns the Rest singleton. */
  get rest(): Rest {
    return Rest;
  }
}
