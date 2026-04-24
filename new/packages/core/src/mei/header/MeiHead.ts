import { MeiElement } from "../../MeiElement.js";
import { MeiFileDesc } from "./MeiFileDesc.js";

/**
 * Wrapper for `<meiHead>` element.
 *
 * https://music-encoding.org/guidelines/v5/elements/meiHead.html
 */
export class MeiHead extends MeiElement {
  static create(element: MeiElement): MeiHead | undefined {
    if (element.tagName === "meiHead") {
      return new MeiHead(element.yNode);
    }
    return undefined;
  }

  /**
   * Returns the file description element.
   */
  get fileDesc(): MeiFileDesc | undefined {
    return this.findChild(MeiFileDesc);
  }

  /**
   * Returns the main title text of the score.
   * Shortcut for head.fileDesc.titleStmt.title.textContent.
   */
  public getTitle(): string | undefined {
    return this.fileDesc?.titleStmt?.title?.textContent;
  }
}
