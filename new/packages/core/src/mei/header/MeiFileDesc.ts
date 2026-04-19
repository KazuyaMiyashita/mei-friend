import { MeiElement } from "../../MeiElement.js";
import { MeiTitleStmt } from "./MeiTitleStmt.js";

/**
 * Wrapper for <fileDesc> element.
 */
export class MeiFileDesc extends MeiElement {
  /**
   * Returns the title statement element.
   */
  get titleStmt(): MeiTitleStmt | undefined {
    const el = this.getChildElement("titleStmt");
    return el ? new MeiTitleStmt(el.yNode) : undefined;
  }
}
