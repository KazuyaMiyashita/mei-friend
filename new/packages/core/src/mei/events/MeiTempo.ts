import { MeiElement } from "../../MeiElement.js";

/**
 * Wrapper for <tempo> element.
 */
export class MeiTempo extends MeiElement {
  static create(element: MeiElement): MeiTempo | undefined {
    if (element.tagName === "tempo") {
      return new MeiTempo(element.yNode);
    }
    return undefined;
  }

  /**
   * Returns the BPM value from @midi.bpm.
   */
  get bpm(): number | undefined {
    const midiBpm = this.getAttribute("midi.bpm");
    if (midiBpm) return parseInt(midiBpm, 10);
    const mm = this.getAttribute("mm");
    if (mm) return parseInt(mm, 10);
    return undefined;
  }
}
