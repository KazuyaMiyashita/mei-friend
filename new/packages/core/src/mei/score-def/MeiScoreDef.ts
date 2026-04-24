import { MeiElement } from "../../MeiElement.js";
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

  get meterCount(): number | undefined {
    const val = this.getAttribute("meter.count");
    return val ? parseInt(val, 10) : this.meterSig?.count;
  }

  get meterUnit(): number | undefined {
    const val = this.getAttribute("meter.unit");
    return val ? parseInt(val, 10) : this.meterSig?.unit;
  }
}
