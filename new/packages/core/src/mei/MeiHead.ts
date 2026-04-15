import type { MeiElement } from "../MeiElement.js";
import type { MeiTransaction } from "../MeiFriend.js";

/**
 * Adapter for MEI header operations.
 * Provides high-level access to metadata stored in <meiHead>.
 */
export class MeiHead {
  /**
   * @param rootMeiElement The root <mei> element.
   */
  constructor(private readonly rootMeiElement: MeiElement) {}

  /**
   * Returns the main title text of the score.
   */
  public getTitle(): string | undefined {
    return this.rootMeiElement
      .getChildElement("meiHead")
      ?.getChildElement("fileDesc")
      ?.getChildElement("titleStmt")
      ?.getChildElement("title")?.textContent;
  }

  /**
   * Sets the main title text of the score, creating the necessary structure if needed.
   * This high-level operation requires an active transaction.
   */
  public setTitle(tx: MeiTransaction, text: string): void {
    const head = this.rootMeiElement.ensureChildElement(tx, "meiHead");
    const fileDesc = head.ensureChildElement(tx, "fileDesc");
    const titleStmt = fileDesc.ensureChildElement(tx, "titleStmt");
    const title = titleStmt.ensureChildElement(tx, "title");
    title.setTextContent(tx, text);
  }
}
