import type { MeiElement } from "../../MeiElement.js";
import { Duration } from "../../models/elements.js";
import { Rational } from "../../models/math.js";

/**
 * Utility to calculate duration from MEI attributes.
 */
export function getDurationFromAttributes(
  attributes: Record<string, string>,
): Duration | undefined {
  if (!attributes.dur) return undefined;

  let baseDur: Rational;
  const durAttr = attributes.dur;

  if (durAttr === "maxima") {
    baseDur = new Rational(32);
  } else if (durAttr === "longa") {
    baseDur = new Rational(16);
  } else if (durAttr === "breve") {
    baseDur = new Rational(8);
  } else {
    const dur = parseInt(durAttr, 10);
    if (Number.isNaN(dur)) return undefined;
    baseDur = new Rational(4, dur);
  }

  const dots = attributes.dots ? parseInt(attributes.dots, 10) : 0;
  const denom = 1 << dots;
  const multiplier = new Rational(denom * 2 - 1, denom);
  return new Duration(baseDur.mul(multiplier));
}

/**
 * Calculates the musical duration of an element, accounting for tuplets.
 */
export function getDuration(element: MeiElement): Duration | undefined {
  let duration = getDurationFromAttributes(element.getAttributes());
  if (!duration) return undefined;

  let current = element.parentElement;
  while (current) {
    if (current.tagName === "tuplet") {
      const num = current.getAttribute("num");
      const numbase = current.getAttribute("numbase");
      if (num && numbase) {
        const n = parseInt(num, 10);
        const nb = parseInt(numbase, 10);
        if (!Number.isNaN(n) && !Number.isNaN(nb) && n !== 0) {
          duration = duration.mul(new Rational(nb, n));
        }
      }
    }
    current = current.parentElement;
  }
  return duration;
}
