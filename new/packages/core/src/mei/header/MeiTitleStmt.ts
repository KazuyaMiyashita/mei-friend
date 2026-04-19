import { MeiElement } from "../../MeiElement.js";

/**
 * Wrapper for <titleStmt> element.
 */
export class MeiTitleStmt extends MeiElement {
  /**
   * Returns the title element.
   */
  get title(): MeiElement | undefined {
    return this.getChildElement("title");
  }
}
