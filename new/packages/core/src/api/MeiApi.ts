import type { MeiElement } from "../MeiElement.js";
import type { MeiFriend } from "../MeiFriend.js";
import type { Mei } from "../mei/elements/Mei.js";
import { buildScoreModel } from "../mei/utils/buildScoreModel.js";
import type { ScoreModel } from "../models/score.js";
import { MeiEditor } from "./editor/MeiEditor.js";

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
   * Returns the root `<mei>` element wrapped in a Mei wrapper.
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
      draft
        .getOrInsertChild("meiHead")
        .getOrInsertChild("fileDesc")
        .getOrInsertChild("titleStmt")
        .getOrInsertChild("title")
        .setTextContent(title);
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
