import type { MeiElement } from "../MeiElement.js";
import type { MeiFriend } from "../MeiFriend.js";
import type { Mei } from "../mei/elements/Mei.js";
import { MeiKeySig } from "../mei/elements/score-def/MeiKeySig.js";
import { MeiStaffDef } from "../mei/elements/score-def/MeiStaffDef.js";
import { buildScoreModel } from "../mei/utils/buildScoreModel.js";
import { Key } from "../models/index.js";
import type { Position } from "../models/score.js";
import { type ScoreModel, ScorePositionIterator } from "../models/score.js";
import { MeiEditor } from "./editor/MeiEditor.js";

/**
 * High-level API for interacting with an MEI document.
 * This class provides methods for common operations like getting/setting titles,
 * and converting the MEI structure into logical models.
 */
export class MeiApi {
  constructor(readonly meiFriend: MeiFriend) {}

  /** Returns the note editor for pitch transposition and other note edits. */
  get editor(): MeiEditor {
    return new MeiEditor(this.meiFriend, this);
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

  /**
   * Returns the key signature defined for `staffN` in the initial `<scoreDef>`,
   * i.e. the one that appears before the first measure.
   * Returns `undefined` if no key signature is defined for that staff.
   */
  public getInitialKeyForStaff(staffN: number): Key | undefined {
    const root = this.meiFriend.getRootElement();
    if (!root) return undefined;

    for (const staffDef of root.findDescendants(MeiStaffDef)) {
      const n = staffDef.n;
      if (n === undefined || parseInt(n, 10) !== staffN) continue;
      const key = staffDef.keySig?.toKey();
      if (key) return key;
    }
    return undefined;
  }

  /**
   * Returns the key signature in effect at the given position.
   *
   * Scans backward from the position (staff scope) looking for a `<keySig>`
   * element in the ScoreModel events. Falls back to the initial `<scoreDef>`
   * key for the staff, and finally to C Major if none is found.
   */
  public getKeyAt(pos: Position): Key {
    const scoreModel = this.meiFriend.getScoreModel();
    const iter = new ScorePositionIterator(scoreModel, pos, {
      scope: "staff",
      direction: "backward",
    });

    for (const event of iter) {
      const el = this.meiFriend.getElementById(event.id);
      if (!el) continue;
      const keySig = MeiKeySig.create(el);
      if (keySig) {
        const key = keySig.toKey();
        if (key) return key;
      }
    }

    return this.getInitialKeyForStaff(pos.staffN) ?? Key.parse("C Major");
  }
}
