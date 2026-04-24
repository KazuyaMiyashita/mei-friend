import { MeiElement } from "../../MeiElement.js";
import { Part } from "../../models/index.js";
import { MeiKeySig } from "./MeiKeySig.js";
import { MeiMeterSig } from "./MeiMeterSig.js";

/**
 * Wrapper for <staffDef> element.
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
    const el = this.getChildElement("keySig");
    return el ? new MeiKeySig(el.yNode) : undefined;
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

  public getPart(): Part {
    const label = this.getAttribute("label") || `Staff ${this.n || "?"}`;
    return Part.of(label);
  }
}
