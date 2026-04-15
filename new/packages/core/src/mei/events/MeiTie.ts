import type { MeiElement } from "../../MeiElement.js";

/**
 * Wrapper for <tie> element.
 */
export class MeiTie {
  constructor(public readonly element: MeiElement) {}

  /** Returns the xml:id or id of the tie element. */
  get id(): string | undefined {
    return this.element.id;
  }

  /** Returns the startid attribute (without #). */
  get startId(): string | undefined {
    const sid = this.element.getAttribute("startid");
    return sid?.startsWith("#") ? sid.substring(1) : sid;
  }

  /** Returns the endid attribute (without #). */
  get endId(): string | undefined {
    const eid = this.element.getAttribute("endid");
    return eid?.startsWith("#") ? eid.substring(1) : eid;
  }
}
