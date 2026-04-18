import type { MeiElement } from "../../MeiElement.js";
import { Duration } from "../../models/elements.js";
import { MeiMeterSig } from "../metadata/MeiMeterSig.js";
import { MeiScoreDef } from "../metadata/MeiScoreDef.js";
import { MeiStaffDef } from "../metadata/MeiStaffDef.js";

/**
 * Returns the meter count (beats per measure) from a root or scoreDef element.
 */
export function getMeterCount(el: MeiElement): number | undefined {
  const scoreDef = el.getElementsByTagName("scoreDef")[0];
  const meterSig = el.getElementsByTagName("meterSig")[0];
  const staffDef = el.getElementsByTagName("staffDef")[0];

  return (
    (scoreDef ? new MeiScoreDef(scoreDef).meterCount : undefined) ??
    (meterSig ? new MeiMeterSig(meterSig).count : undefined) ??
    (staffDef ? new MeiStaffDef(staffDef).meterCount : undefined)
  );
}

/**
 * Returns the meter unit (beat duration) from a root or scoreDef element.
 */
export function getMeterUnit(el: MeiElement): number | undefined {
  const scoreDef = el.getElementsByTagName("scoreDef")[0];
  const meterSig = el.getElementsByTagName("meterSig")[0];
  const staffDef = el.getElementsByTagName("staffDef")[0];

  return (
    (scoreDef ? new MeiScoreDef(scoreDef).meterUnit : undefined) ??
    (meterSig ? new MeiMeterSig(meterSig).unit : undefined) ??
    (staffDef ? new MeiStaffDef(staffDef).meterCount : undefined)
  );
}

/**
 * Returns the duration of a full measure based on the meter of the given element.
 */
export function getMeasureDuration(el: MeiElement): Duration | undefined {
  const count = getMeterCount(el);
  const unit = getMeterUnit(el);
  if (count === undefined || unit === undefined) return undefined;
  return Duration.of(count * 4, unit);
}
