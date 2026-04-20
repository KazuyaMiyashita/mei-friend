import * as Y from "yjs";
import type { MeiElement } from "../MeiElement.js";
import type { MeiFriend } from "../MeiFriend.js";
import { MeiTempo } from "../mei/events/MeiTempo.js";
import { MeiTie } from "../mei/events/MeiTie.js";
import type { Mei } from "../mei/Mei.js";
import { MeiStaffDef } from "../mei/score-def/MeiStaffDef.js";
import { getGlobalMeter } from "../mei/score-def/meter.js";
import { buildScore } from "../mei/structure/buildScore.js";
import { buildScoreModel } from "../mei/structure/buildScoreModel.js";
import { MeiMeasure } from "../mei/structure/MeiMeasure.js";
import type { Score } from "../models/containers.js";
import type { Meter, NoteInfo, ScoreModel } from "../models/score.js";
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
   * Appends or updates the title in the MEI document.
   * If the necessary wrapper elements (meiHead, fileDesc, titleStmt, title) do not exist,
   * they are created.
   *
   * @param title The title to set.
   * @returns A new MeiElement with the updated title.
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

  /** Returns all <tempo> elements as wrappers. */
  get tempos(): MeiTempo[] {
    const root = this.meiFriend.getRootElement();
    if (!root) return [];
    return root
      .getElementsByTagName("tempo")
      .map((t) => MeiTempo.create(t))
      .filter((t): t is MeiTempo => !!t);
  }

  /** Returns all <staffDef> elements as wrappers. */
  get staffDefs(): MeiStaffDef[] {
    const root = this.meiFriend.getRootElement();
    if (!root) return [];
    return root
      .getElementsByTagName("staffDef")
      .map((s) => MeiStaffDef.create(s))
      .filter((s): s is MeiStaffDef => !!s);
  }

  /** Returns all <measure> elements as wrappers. */
  get measures(): MeiMeasure[] {
    const root = this.meiFriend.getRootElement();
    if (!root) return [];
    return root
      .getElementsByTagName("measure")
      .map((m) => MeiMeasure.create(m))
      .filter((m): m is MeiMeasure => !!m);
  }

  /** Returns all <tie> elements as wrappers. */
  get ties(): MeiTie[] {
    const root = this.meiFriend.getRootElement();
    if (!root) return [];
    return root
      .getElementsByTagName("tie")
      .map((t) => MeiTie.create(t))
      .filter((t): t is MeiTie => !!t);
  }

  /** Returns the global meter information. */
  get meter(): Meter | undefined {
    const root = this.meiFriend.getRootElement();
    if (!root) return undefined;
    return getGlobalMeter(root);
  }

  /**
   * Converts the MEI structure into a logical Score model.
   */
  public toScore(): Score<NoteInfo> {
    const root = this.meiFriend.getRootElement();
    if (!root) throw new Error("No root element to convert to Score");
    return buildScore(root);
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
