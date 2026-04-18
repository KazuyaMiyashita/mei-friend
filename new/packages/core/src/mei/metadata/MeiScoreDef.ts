import { MeiElement } from "../../MeiElement.js";
import { Duration } from "../../models/elements.js";
import type { Meter } from "../../models/score.js";

/**
 * Wrapper for <scoreDef> element.
 */
export class MeiScoreDef extends MeiElement {
  static create(element: MeiElement): MeiScoreDef | undefined {
    if (element.tagName === "scoreDef") {
      return new MeiScoreDef(element.yNode, element.doc);
    }
    return undefined;
  }

  /**
   * Returns the meter count from @meter.count.
   */
  get meterCount(): number | undefined {
    const count = this.getAttribute("meter.count");
    return count ? parseInt(count, 10) : undefined;
  }

  /**
   * Returns the meter unit from @meter.unit.
   */
  get meterUnit(): number | undefined {
    const unit = this.getAttribute("meter.unit");
    return unit ? parseInt(unit, 10) : undefined;
  }

  /**
   * Extracts meter information from the scoreDef attributes.
   */
  get meter(): Partial<Meter> {
    const count = this.meterCount;
    const unit = this.meterUnit;
    const meter: { beats?: number; beatType?: Duration } = {};
    if (count !== undefined) meter.beats = count;
    if (unit !== undefined) meter.beatType = Duration.of(4, unit);
    return meter;
  }
}
