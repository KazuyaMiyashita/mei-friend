import { MeiElement } from "../../../MeiElement.js";
import { Duration } from "../../../models/index.js";
import type { Meter } from "../../../models/score.js";
import { MeiMeterSig } from "./MeiMeterSig.js";
import { MeiStaffDef } from "./MeiStaffDef.js";

/**
 * Wrapper for `<scoreDef>` element.
 *
 * https://music-encoding.org/guidelines/v5/elements/scoreDef.html
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

  get meterSig(): MeiMeterSig | undefined {
    return this.findChild(MeiMeterSig);
  }

  /** The `meter.count` attribute value only. Does not fall back to `<meterSig>`. */
  get meterCount(): number | undefined {
    const val = this.getAttribute("meter.count");
    return val ? parseInt(val, 10) : undefined;
  }

  /** The `meter.unit` attribute value only. Does not fall back to `<meterSig>`. */
  get meterUnit(): number | undefined {
    const val = this.getAttribute("meter.unit");
    return val ? parseInt(val, 10) : undefined;
  }

  /**
   * Returns the meter defined by this element, resolving `meter.count`/`meter.unit`
   * attributes first, then falling back to a `<meterSig>` child.
   * Returns `undefined` if neither is present.
   */
  getMeter(): Meter | undefined {
    const count = this.meterCount ?? this.meterSig?.count;
    const unit = this.meterUnit ?? this.meterSig?.unit;
    if (count !== undefined && unit !== undefined) {
      return { beats: count, beatType: Duration.of(4, unit) };
    }
    return undefined;
  }
}
