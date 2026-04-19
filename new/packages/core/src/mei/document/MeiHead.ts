import { MeiElement } from "../../MeiElement.js";

/**
 * Wrapper for <meiHead> element.
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
    const el = this.getChildElement("fileDesc");
    return el ? new MeiFileDesc(el.yNode) : undefined;
  }

  /**
   * Returns the main title text of the score.
   * Shortcut for head.fileDesc.titleStmt.title.textContent.
   */
  public getTitle(): string | undefined {
    return this.fileDesc?.titleStmt?.title?.textContent;
  }
}

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
