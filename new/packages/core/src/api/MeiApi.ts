import * as Y from "yjs";
import type { MeiElement } from "../MeiElement.js";
import type { MeiFriend } from "../MeiFriend.js";
import type { Mei } from "../mei/Mei.js";
import { buildScoreModel } from "../mei/structure/buildScoreModel.js";
import type { ScoreModel } from "../models/score.js";
import { MeiEditor } from "./editor/MeiEditor.js";

/**
 * Helper to get a child element by tag name from a Y.XmlElement.
 * TODO; ヘルパー無くても書けるようにならないか？
 */
function getChildYElement(
  node: Y.XmlElement,
  tagName: string,
): Y.XmlElement | undefined {
  return node
    .toArray()
    .find(
      (child): child is Y.XmlElement =>
        child instanceof Y.XmlElement && child.nodeName === tagName,
    ) as Y.XmlElement | undefined;
}

/**
 * High-level API for interacting with an MEI document.
 * This class provides methods for common operations like getting/setting titles,
 * and converting the MEI structure into logical models.
 */
export class MeiApi {
  constructor(private readonly meiFriend: MeiFriend) {}

  /** Returns the note editor for pitch transposition and other note edits. */
  get editor(): MeiEditor {
    return new MeiEditor(this.meiFriend);
  }

  /**
   * Returns the root <mei> element wrapped in a Mei wrapper.
   */
  public get mei(): Mei | undefined {
    return this.meiFriend.getRootElement();
  }

  /**
   * Returns the main title text of the score.
   */
  public getTitle(): string | undefined {
    return this.mei?.meiHead?.getTitle();
  }

  /**
   * Appends or updates the title in the MEI document.
   * If the necessary wrapper elements (meiHead, fileDesc, titleStmt, title) do not exist,
   * they are created.
   *
   * @param title The title to set.
   * @returns A new MeiElement with the updated title.
   * TODO: withTitle() に。ロジック自体はmeiかmeiHeadあたりに書いた方が良いか？
   */
  public titleAppended(title = "Untitled"): MeiElement {
    const root = this.meiFriend.getRootElement();
    if (!root)
      throw new Error(
        "Cannot append title to a document without a root element",
      );

    return root.produce((draft) => {
      let meiHead = getChildYElement(draft, "meiHead");
      if (!meiHead) {
        meiHead = new Y.XmlElement("meiHead");
        meiHead.setAttribute(
          "xml:id",
          this.meiFriend.idGenerator.generate("meiHead"),
        );
        draft.insert(0, [meiHead]);
      }

      let fileDesc = getChildYElement(meiHead, "fileDesc");
      if (!fileDesc) {
        fileDesc = new Y.XmlElement("fileDesc");
        fileDesc.setAttribute(
          "xml:id",
          this.meiFriend.idGenerator.generate("fileDesc"),
        );
        meiHead.insert(0, [fileDesc]);
      }

      let titleStmt = getChildYElement(fileDesc, "titleStmt");
      if (!titleStmt) {
        titleStmt = new Y.XmlElement("titleStmt");
        titleStmt.setAttribute(
          "xml:id",
          this.meiFriend.idGenerator.generate("titleStmt"),
        );
        fileDesc.insert(0, [titleStmt]);
      }

      let titleEl = getChildYElement(titleStmt, "title");
      if (!titleEl) {
        titleEl = new Y.XmlElement("title");
        titleEl.setAttribute(
          "xml:id",
          this.meiFriend.idGenerator.generate("title"),
        );
        titleStmt.insert(0, [titleEl]);
      }

      // Clear existing content and set the new title text
      titleEl.delete(0, titleEl.length);
      const textNode = new Y.XmlText(title);
      titleEl.insert(0, [textNode]);
    });
  }

  /**
   * Converts MEI to a structural ScoreModel.
   * Prefer MeiFriend.getScoreModel() for cached access.
   */
  public toScoreModel(): ScoreModel {
    const root = this.meiFriend.getRootElement();
    if (!root) throw new Error("No root element to convert to ScoreModel");
    return buildScoreModel(root);
  }
}
