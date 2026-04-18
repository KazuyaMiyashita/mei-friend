import type { MeiElement } from "../MeiElement.js";
import type { Score } from "../models/containers.js";
import type { Duration } from "../models/elements.js";
import type { NoteInfo, ScoreModel } from "../models/score.js";
import { MeiHead } from "./document/MeiHead.js";
import { MeiTie } from "./events/MeiTie.js";
import { MeiStaffDef } from "./metadata/MeiStaffDef.js";
import { MeiTempo } from "./metadata/MeiTempo.js";
import { buildScore } from "./structure/buildScore.js";
import { buildScoreModel } from "./structure/buildScoreModel.js";
import { MeiMeasure } from "./structure/MeiMeasure.js";
import {
  getMeasureDuration,
  getMeterCount,
  getMeterUnit,
} from "./utils/score.js";

/**
 * High-level wrapper for an MEI score, providing extraction and conversion utilities.
 */
export class Mei {
  constructor(public readonly root: MeiElement) {}

  /** Returns the MEI header wrapper. */
  get head(): MeiHead | undefined {
    const headEl = this.root.getChildElement("meiHead");
    return headEl ? MeiHead.create(headEl) : undefined;
  }

  /** Returns all <tempo> elements as wrappers. */
  get tempos(): MeiTempo[] {
    return this.root
      .getElementsByTagName("tempo")
      .map((t) => MeiTempo.create(t))
      .filter((t): t is MeiTempo => !!t);
  }

  /** Returns all <staffDef> elements as wrappers. */
  get staffDefs(): MeiStaffDef[] {
    return this.root
      .getElementsByTagName("staffDef")
      .map((s) => MeiStaffDef.create(s))
      .filter((s): s is MeiStaffDef => !!s);
  }

  /** Returns all <measure> elements as wrappers. */
  get measures(): MeiMeasure[] {
    return this.root
      .getElementsByTagName("measure")
      .map((m) => MeiMeasure.create(m))
      .filter((m): m is MeiMeasure => !!m);
  }

  /** Returns all <tie> elements as wrappers. */
  get ties(): MeiTie[] {
    return this.root
      .getElementsByTagName("tie")
      .map((t) => MeiTie.create(t))
      .filter((t): t is MeiTie => !!t);
  }

  /** Returns the meter count (beats per measure). */
  get meterCount(): number | undefined {
    return getMeterCount(this.root);
  }

  /** Returns the meter unit (beat duration). */
  get meterUnit(): number | undefined {
    return getMeterUnit(this.root);
  }

  /** Returns the duration of a full measure. */
  get measureDuration(): Duration | undefined {
    return getMeasureDuration(this.root);
  }

  /**
   * Converts the MEI structure into a logical Score model.
   */
  public toScore(): Score<NoteInfo> {
    return buildScore(this.root);
  }

  /**
   * Converts the MEI structure into a structural ScoreModel.
   */
  public toScoreModel(): ScoreModel {
    return buildScoreModel(this.root);
  }
}
