import type { MeiElement } from "../../MeiElement.js";

/**
 * Wrapper for <tempo> element.
 */
export class MeiTempo {
  constructor(public readonly element: MeiElement) {}

  /**
   * Returns the BPM value from @midi.bpm.
   */
  get bpm(): number | undefined {
    const bpm = this.element.getAttribute("midi.bpm");
    return bpm ? parseFloat(bpm) : undefined;
  }
}
