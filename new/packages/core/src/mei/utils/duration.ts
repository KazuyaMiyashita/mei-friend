import type { MeiElement } from "../../MeiElement.js";
import { Duration } from "../../models/index.js";
import { Rational } from "../../models/math.js";
import { MeiAccid } from "../elements/events/MeiAccid.js";
import { MeiTuplet } from "../elements/events/MeiTuplet.js";

/**
 * Converts an IPN alter value to the MEI `accid.ges` attribute string.
 * Delegates to `MeiAccid.alterToAccidGes`.
 */
export function alterToAccidGes(alter: number): string | undefined {
  return MeiAccid.alterToAccidGes(alter);
}

/**
 * Utility to calculate duration from MEI attributes.
 */
function getDurationFromAttributes(
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
    const tupletMultiplier = MeiTuplet.create(current)?.multiplier;
    if (tupletMultiplier) {
      duration = duration.mul(tupletMultiplier);
    }
    current = current.parentElement;
  }
  return duration;
}
