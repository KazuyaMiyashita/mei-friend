import { MeiElement } from "../../MeiElement.js";
import { MeiTitle } from "./MeiTitle.js";

/**
 * Wrapper for `<titleStmt>` element.
 *
 * https://music-encoding.org/guidelines/v5/elements/titleStmt.html
 */
export class MeiTitleStmt extends MeiElement {
  static create(element: MeiElement): MeiTitleStmt | undefined {
    if (element.tagName === "titleStmt") return new MeiTitleStmt(element.yNode);
    return undefined;
  }

  /** Returns the first `<title>` child element. */
  get title(): MeiTitle | undefined {
    return this.findChild(MeiTitle);
  }
}
