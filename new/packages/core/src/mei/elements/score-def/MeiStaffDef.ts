import { MeiElement } from "../../../MeiElement.js";
import { Duration, Part } from "../../../models/index.js";
import type { Meter } from "../../../models/score.js";
import { MeiKeySig } from "./MeiKeySig.js";
import { MeiMeterSig } from "./MeiMeterSig.js";

/**
 * Wrapper for `<staffDef>` element.
 *
 * https://music-encoding.org/guidelines/v5/elements/staffDef.html
 */
export class MeiStaffDef extends MeiElement {
  static create(element: MeiElement): MeiStaffDef | undefined {
    if (element.tagName === "staffDef") {
      return new MeiStaffDef(element.yNode);
    }
    return undefined;
  }

  get n(): string | undefined {
    return this.getAttribute("n");
  }

  get keySig(): MeiKeySig | undefined {
    return this.findChild(MeiKeySig);
  }

  get meterSig(): MeiMeterSig | undefined {
    return this.findChild(MeiMeterSig);
  }

  get meterCount(): number | undefined {
    const val = this.getAttribute("meter.count");
    return val ? parseInt(val, 10) : this.meterSig?.count;
  }

  get meterUnit(): number | undefined {
    const val = this.getAttribute("meter.unit");
    return val ? parseInt(val, 10) : this.meterSig?.unit;
  }

  /**
   * Returns the meter for this staff, resolving `meter.count`/`meter.unit`
   * attributes first, then falling back to a `<meterSig>` child element.
   * Returns `undefined` if neither is present.
   */
  getMeter(): Meter | undefined {
    const count = this.meterCount;
    const unit = this.meterUnit;
    if (count !== undefined && unit !== undefined) {
      return { beats: count, beatType: Duration.of(4, unit) };
    }
    return undefined;
  }

  public getPart(): Part {
    const label = this.getAttribute("label") || `Staff ${this.n || "?"}`;
    return Part.of(label);
  }
}
