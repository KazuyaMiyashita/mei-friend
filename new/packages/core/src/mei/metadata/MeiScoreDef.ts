import { MeiElement } from "../../MeiElement.js";
import { MeiMeterSig } from "./MeiMeterSig.js";
import { MeiStaffDef } from "./MeiStaffDef.js";

/**
 * Wrapper for <scoreDef> element.
 */
export class MeiScoreDef extends MeiElement {
  static create(element: MeiElement): MeiScoreDef | undefined {
    if (element.tagName === "scoreDef") {
      return new MeiScoreDef(element.yNode);
    }
    return undefined;
  }

  get staffDefs(): MeiStaffDef[] {
    return this.getElementsByTagName("staffDef").map(
      (el) => new MeiStaffDef(el.yNode),
    );
  }

  get meterSig(): MeiMeterSig | undefined {
    const el = this.getChildElement("meterSig");
    return el ? new MeiMeterSig(el.yNode) : undefined;
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
