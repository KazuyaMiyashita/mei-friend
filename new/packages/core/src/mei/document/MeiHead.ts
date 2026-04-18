import { MeiElement } from "../../MeiElement.js";
import { setTextContent } from "../../MeiUpdate.js";

/**
 * Wrapper for <meiHead> element.
 * Provides high-level access to metadata stored in the header.
 */
export class MeiHead extends MeiElement {
  static create(element: MeiElement): MeiHead | undefined {
    if (element.tagName === "meiHead") {
      return new MeiHead(element.yNode, element.doc);
    }
    return undefined;
  }

  /**
   * Ensures structure for <meiHead> exists and sets the title.
   * This handles the creation of the header if it doesn't already exist.
   */
  public static setTitleAtRoot(root: MeiElement, text: string): void {
    root.doc.transact(() => {
      const head = root.mutation.getOrCreateChild("meiHead");
      const headWrapper = new MeiHead(head.yNode, head.doc);
      headWrapper.setTitle(text);
    });
  }

  /**
   * Returns the main title text of the score.
   */
  public getTitle(): string | undefined {
    return this.getChildElement("fileDesc")
      ?.getChildElement("titleStmt")
      ?.getChildElement("title")?.textContent;
  }

  /**
   * Sets the main title text of the score, creating the necessary structure if needed.
   */
  public setTitle(text: string): void {
    this.doc.transact(() => {
      const title = this.mutation
        .getOrCreateChild("fileDesc")
        .mutation.getOrCreateChild("titleStmt")
        .mutation.getOrCreateChild("title");

      const targetId = title.id;
      if (targetId) {
        this.doc.update(setTextContent(targetId, text));
      }
    });
  }
}
