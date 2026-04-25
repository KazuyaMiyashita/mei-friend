import { MeiElement } from "../../../MeiElement.js";
import { Duration } from "../../../models/index.js";
import type { Meter } from "../../../models/score.js";
import { MeiStaffDef } from "./MeiStaffDef.js";

/**
 * Wrapper for `<scoreDef>` element.
 *
 * https://music-encoding.org/guidelines/v5/elements/scoreDef.html
 *
 * Note: `<scoreDef>` expresses meter via `meter.count`/`meter.unit` attributes only.
 * `<meterSig>` appears as a direct child of `<staffDef>`, not `<scoreDef>`.
 * Callers should fall back to per-staff information when `getMeter()` returns `undefined`.
 */
export class MeiScoreDef extends MeiElement {
  static create(element: MeiElement): MeiScoreDef | undefined {
    if (element.tagName === "scoreDef") {
      return new MeiScoreDef(element.yNode);
    }
    return undefined;
  }

  get staffDefs(): MeiStaffDef[] {
    return this.findDescendants(MeiStaffDef);
  }

  get meterCount(): number | undefined {
    const val = this.getAttribute("meter.count");
    return val ? parseInt(val, 10) : undefined;
  }

  get meterUnit(): number | undefined {
    const val = this.getAttribute("meter.unit");
    return val ? parseInt(val, 10) : undefined;
  }

  /**
   * Returns the meter from `meter.count`/`meter.unit` attributes.
   * Returns `undefined` if these attributes are absent — callers must then
   * fall back to per-staff meter information via `MeiStaffDef.getMeter()`.
   */
  getMeter(): Meter | undefined {
    const count = this.meterCount;
    const unit = this.meterUnit;
    if (count !== undefined && unit !== undefined) {
      return { beats: count, beatType: Duration.of(4, unit) };
    }
    return undefined;
  }
}
