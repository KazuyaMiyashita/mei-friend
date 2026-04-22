import * as Y from "yjs";
import type { MeiElement } from "../MeiElement.js";
import type { MeiFriend } from "../MeiFriend.js";
import type { Mei } from "../mei/Mei.js";
import { buildScoreModel } from "../mei/structure/buildScoreModel.js";
import type { ScoreModel } from "../models/score.js";
import { MeiEditor } from "./editor/MeiEditor.js";

/**
 * Helper to get a child element by tag name from a Y.XmlElement.
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
   * Returns a modified clone of the MEI root with the title set.
   * If the necessary wrapper elements (meiHead, fileDesc, titleStmt, title) do not exist,
   * they are created.
   *
   * Apply the result with `meiFriend.updateElement(meiFriend.api.withTitle("My Work"))`.
   *
   * @param title The title to set.
   * @returns A new MeiElement (the modified root) with the updated title.
   */
  public withTitle(title = "Untitled"): MeiElement {
    const root = this.meiFriend.getRootElement();
    if (!root)
      throw new Error("Cannot set title on a document without a root element");

    const mf = this.meiFriend;

    return mf.produceElement(root, (draft) => {
      let meiHead = getChildYElement(draft, "meiHead");
      if (!meiHead) {
        meiHead = mf.createElement("meiHead").yNode;
        draft.insert(0, [meiHead]);
      }

      let fileDesc = getChildYElement(meiHead, "fileDesc");
      if (!fileDesc) {
        fileDesc = mf.createElement("fileDesc").yNode;
        meiHead.insert(0, [fileDesc]);
      }

      let titleStmt = getChildYElement(fileDesc, "titleStmt");
      if (!titleStmt) {
        titleStmt = mf.createElement("titleStmt").yNode;
        fileDesc.insert(0, [titleStmt]);
      }

      let titleEl = getChildYElement(titleStmt, "title");
      if (!titleEl) {
        titleEl = mf.createElement("title").yNode;
        titleStmt.insert(0, [titleEl]);
      }

      // Clear existing content and set the new title text
      titleEl.delete(0, titleEl.length);
      titleEl.insert(0, [new Y.XmlText(title)]);
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
