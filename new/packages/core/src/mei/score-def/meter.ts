import type { MeiElement } from "../../MeiElement.js";
import { Duration } from "../../models/index.js";
import type { Meter } from "../../models/score.js";
import { MeiMeterSig } from "./MeiMeterSig.js";
import { MeiScoreDef } from "./MeiScoreDef.js";
import { MeiStaffDef } from "./MeiStaffDef.js";

/**
 * Creates a Meter object from count and unit.
 */
function createMeter(count: number, unit: number): Meter {
  return {
    beats: count,
    beatType: Duration.of(4, unit),
  };
}

/**
 * Returns the global meter of the score.
 * It checks for meter information in <scoreDef> and the first <staffDef>.
 * Returns undefined if no meter information is found.
 */
export function getGlobalMeter(root: MeiElement): Meter | undefined {
  const scoreDefs = root.getElementsByTagName("scoreDef");
  for (const sd of scoreDefs) {
    const scoreDef = MeiScoreDef.create(sd);
    if (
      scoreDef &&
      scoreDef.meterCount !== undefined &&
      scoreDef.meterUnit !== undefined
    ) {
      return createMeter(scoreDef.meterCount, scoreDef.meterUnit);
    }
    // Also check for <meterSig> inside <scoreDef>
    const meterSigEl = sd.getChildElement("meterSig");
    if (meterSigEl) {
      const ms = MeiMeterSig.create(meterSigEl);
      if (ms && ms.count !== undefined && ms.unit !== undefined) {
        return createMeter(ms.count, ms.unit);
      }
    }
  }

  const staffDefs = root.getElementsByTagName("staffDef");
  for (const sd of staffDefs) {
    const staffDef = MeiStaffDef.create(sd);
    if (
      staffDef &&
      staffDef.meterCount !== undefined &&
      staffDef.meterUnit !== undefined
    ) {
      return createMeter(staffDef.meterCount, staffDef.meterUnit);
    }
    const meterSigEl = sd.getChildElement("meterSig");
    if (meterSigEl) {
      const ms = MeiMeterSig.create(meterSigEl);
      if (ms && ms.count !== undefined && ms.unit !== undefined) {
        return createMeter(ms.count, ms.unit);
      }
    }
  }

  return undefined;
}

/**
 * Returns a map of staff IDs to their specific meters.
 * If a staff has no specific meter defined, it is not included in the map.
 */
export function getStaffMeters(root: MeiElement): Map<string, Meter> {
  const meters = new Map<string, Meter>();
  const staffDefs = root.getElementsByTagName("staffDef");
  for (const sd of staffDefs) {
    const staffDef = MeiStaffDef.create(sd);
    if (!staffDef?.id) continue;

    if (staffDef.meterCount !== undefined && staffDef.meterUnit !== undefined) {
      meters.set(
        staffDef.id,
        createMeter(staffDef.meterCount, staffDef.meterUnit),
      );
      continue;
    }

    const meterSigEl = sd.getChildElement("meterSig");
    if (meterSigEl) {
      const ms = MeiMeterSig.create(meterSigEl);
      if (ms && ms.count !== undefined && ms.unit !== undefined) {
        meters.set(staffDef.id, createMeter(ms.count, ms.unit));
      }
    }
  }
  return meters;
}
