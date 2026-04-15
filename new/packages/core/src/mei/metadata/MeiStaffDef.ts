import type { MeiElement } from "../../MeiElement.js";
import { Part } from "../../models/elements.js";

/**
 * Wrapper for <staffDef> element.
 */
export class MeiStaffDef {
  constructor(public readonly element: MeiElement) {}

  /**
   * Returns the staff number from @n.
   */
  get n(): string | undefined {
    return this.element.getAttribute("n");
  }

  /**
   * Returns the label text from <label> child.
   */
  get label(): string | undefined {
    const labelElem = this.element.children.find((c) => c.tagName === "label");
    return labelElem?.textContent;
  }

  /**
   * Returns the meter count from @meter.count.
   */
  get meterCount(): number | undefined {
    const count = this.element.getAttribute("meter.count");
    return count ? parseInt(count, 10) : undefined;
  }

  /**
   * Returns the meter unit from @meter.unit.
   */
  get meterUnit(): number | undefined {
    const unit = this.element.getAttribute("meter.unit");
    return unit ? parseInt(unit, 10) : undefined;
  }

  /**
   * Returns a logical Part based on label or @n.
   */
  getPart(): Part | undefined {
    const name = this.label ?? this.n;
    return name ? Part.of(name) : undefined;
  }
}
