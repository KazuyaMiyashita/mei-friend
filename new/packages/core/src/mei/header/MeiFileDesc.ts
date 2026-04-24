import { MeiElement } from "../../MeiElement.js";
import { MeiTitleStmt } from "./MeiTitleStmt.js";

/**
 * Wrapper for `<fileDesc>` element.
 *
 * https://music-encoding.org/guidelines/v5/elements/fileDesc.html
 */
export class MeiFileDesc extends MeiElement {
  static create(element: MeiElement): MeiFileDesc | undefined {
    if (element.tagName === "fileDesc") return new MeiFileDesc(element.yNode);
    return undefined;
  }

  /** Returns the `<titleStmt>` statement element. */
  get titleStmt(): MeiTitleStmt | undefined {
    return this.findChild(MeiTitleStmt);
  }
}
