import { MeiElement } from "../../../MeiElement.js";

/**
 * Wrapper for `<title>` element.
 *
 * https://music-encoding.org/guidelines/v5/elements/title.html
 */
export class MeiTitle extends MeiElement {
  static create(element: MeiElement): MeiTitle | undefined {
    if (element.tagName === "title") return new MeiTitle(element.yNode);
    return undefined;
  }

  /** The text content of the title element. */
  get text(): string {
    return this.textContent;
  }
}
