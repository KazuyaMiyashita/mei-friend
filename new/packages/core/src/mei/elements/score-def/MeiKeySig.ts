import { MeiElement } from "../../../MeiElement.js";
import { Key, Mode, NoteName } from "../../../models/index.js";

/**
 * Wrapper for `<keySig>` element.
 *
 * https://music-encoding.org/guidelines/v5/elements/keySig.html
 */
export class MeiKeySig extends MeiElement {
  static create(element: MeiElement): MeiKeySig | undefined {
    if (element.tagName === "keySig") {
      return new MeiKeySig(element.yNode);
    }
    return undefined;
  }

  /** The signature string, e.g. "0", "1s", "2f". */
  get sig(): string | undefined {
    return this.getAttribute("sig");
  }

  /** The mode string, e.g. "major", "minor". */
  get mode(): string | undefined {
    return this.getAttribute("mode");
  }

  /** Converts to a Key model, or undefined if sig is missing. */
  toKey(): Key | undefined {
    const sig = this.sig;
    if (sig === undefined) return undefined;
    let sigNum = 0;
    if (sig !== "0") {
      const n = parseInt(sig, 10); // parseInt("2f", 10) = 2
      sigNum = sig.endsWith("f") ? -n : n;
    }
    const modeObj = this.mode === "minor" ? Mode.Minor : Mode.Major;
    return new Key(new NoteName(sigNum - modeObj.offset), modeObj);
  }
}
