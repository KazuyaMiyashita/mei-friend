import type { MeiElement } from "../../MeiElement.js";
import type { Meter } from "../../models/score.js";
import { MeiScoreDef } from "../elements/score-def/MeiScoreDef.js";
import { MeiStaffDef } from "../elements/score-def/MeiStaffDef.js";

/**
 * Returns the global meter of the score.
 *
 * Checks `<scoreDef>` attributes first, then falls back to the first `<staffDef>`
 * that defines a meter. Per MEI convention, `<scoreDef>` carries meter via
 * `meter.count`/`meter.unit` attributes; `<staffDef>` may additionally use a
 * `<meterSig>` child element.
 *
 * Returns `undefined` if no meter information is found anywhere.
 */
export function getGlobalMeter(root: MeiElement): Meter | undefined {
  for (const sd of root.getElementsByTagName("scoreDef")) {
    const meter = MeiScoreDef.create(sd)?.getMeter();
    if (meter) return meter;
  }

  for (const staffDef of root.findDescendants(MeiStaffDef)) {
    const meter = staffDef.getMeter();
    if (meter) return meter;
  }

  return undefined;
}

/**
 * Returns a map of staff IDs to their specific meters.
 * If a staff has no specific meter defined, it is not included in the map.
 */
export function getStaffMeters(root: MeiElement): Map<string, Meter> {
  const meters = new Map<string, Meter>();
  for (const staffDef of root.findDescendants(MeiStaffDef)) {
    const meter = staffDef.getMeter();
    if (meter) meters.set(staffDef.id, meter);
  }
  return meters;
}
