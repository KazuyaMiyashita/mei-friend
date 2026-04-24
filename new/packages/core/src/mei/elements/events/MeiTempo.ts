import { MeiElement } from "../../../MeiElement.js";

/**
 * Wrapper for `<tempo>` element.
 *
 * https://music-encoding.org/guidelines/v5/elements/tempo.html
 */
export class MeiTempo extends MeiElement {
  static create(element: MeiElement): MeiTempo | undefined {
    if (element.tagName === "tempo") {
      return new MeiTempo(element.yNode);
    }
    return undefined;
  }

  /**
   * Returns the BPM value from `@midi.bpm`.
   */
  get midiBpm(): number | undefined {
    const midiBpm = this.getAttribute("midi.bpm");
    if (midiBpm) return parseInt(midiBpm, 10);
    return undefined;
  }
}
