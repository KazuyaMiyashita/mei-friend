import { MeiElement } from "../../MeiElement.js";

/**
 * Wrapper for <tempo> element.
 */
export class MeiTempo extends MeiElement {
  static create(element: MeiElement): MeiTempo | undefined {
    if (element.tagName === "tempo") {
      return new MeiTempo(element.yNode, element.doc);
    }
    return undefined;
  }

  /**
   * Returns the BPM value from @midi.bpm.
   */
  get bpm(): number | undefined {
    const bpm = this.getAttribute("midi.bpm");
    return bpm ? parseFloat(bpm) : undefined;
  }
}
