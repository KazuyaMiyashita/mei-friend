import { MeiElement } from "../../../MeiElement.js";
import { type Duration, Rest } from "../../../models/index.js";
import { getDuration } from "../../utils/duration.js";

/**
 * Wrapper for `<rest>` element.
 *
 * https://music-encoding.org/guidelines/v5/elements/rest.html
 */
export class MeiRest extends MeiElement {
  static create(element: MeiElement): MeiRest | undefined {
    if (element.tagName === "rest") {
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
