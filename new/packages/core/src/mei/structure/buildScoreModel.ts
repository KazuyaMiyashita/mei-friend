import type { MeiElement } from "../../MeiElement.js";
import { Duration, Offset } from "../../models/elements.js";
import {
  type EventModel,
  type LayerModel,
  type MeasureModel,
  ScoreModel,
  type StaffModel,
} from "../../models/score.js";
import { getDuration } from "../events/utils.js";
import { MeiMeterSig } from "../metadata/MeiMeterSig.js";
import { MeiScoreDef } from "../metadata/MeiScoreDef.js";
import { getGlobalMeter } from "../metadata/meter.js";

const EVENT_TAGS = new Set(["note", "rest", "chord", "space", "mRest"]);
const CONTAINER_TAGS = new Set(["beam", "tuplet", "ftrem", "btrem"]);

/**
 * Recursively collects musical events from a layer element,
 * accumulating logical offsets. All MEI element-name knowledge lives here.
 */
function collectEvents(
  el: MeiElement,
  baseOffset: Offset,
  events: EventModel[],
  navigable: boolean,
): Offset {
  let offset = baseOffset;
  for (const child of el.children) {
    const tag = child.tagName;
    const id = child.id ?? "";

    if (EVENT_TAGS.has(tag)) {
      const dur = getDuration(child) ?? Duration.of(0);
      events.push({ id, offset, duration: dur, isNavigable: navigable });

      if (tag === "chord") {
        collectEvents(child, offset, events, false);
      }

      offset = offset.add(dur);
    } else if (CONTAINER_TAGS.has(tag)) {
      offset = collectEvents(child, offset, events, true);
    }
  }
  return offset;
}

/**
 * Builds a ScoreModel from the root MEI element.
 */
export function buildScoreModel(root: MeiElement): ScoreModel {
  let currentMeter = getGlobalMeter(root);

  const measures = root.getElementsByTagName("measure");
  const measureModels: MeasureModel[] = [];

  for (let measureIndex = 0; measureIndex < measures.length; measureIndex++) {
    const mEl = measures[measureIndex];

    // Update meter if measure has a scoreDef or meterSig
    const meterSigEl = mEl.getElementsByTagName("meterSig")[0];
    if (meterSigEl) {
      const ms = MeiMeterSig.create(meterSigEl);
      if (ms && ms.count !== undefined && ms.unit !== undefined) {
        currentMeter = { beats: ms.count, beatType: Duration.of(4, ms.unit) };
      }
    } else {
      const scoreDefEl = mEl.getElementsByTagName("scoreDef")[0];
      if (scoreDefEl && scoreDefEl.parentElement?.id === mEl.id) {
        const sd = MeiScoreDef.create(scoreDefEl);
        if (sd) {
          const count = sd.meterCount;
          const unit = sd.meterUnit;
          if (count !== undefined && unit !== undefined) {
            currentMeter = { beats: count, beatType: Duration.of(4, unit) };
          }
        }
      }
    }

    const measureN = mEl.getAttribute("n");
    const staffModels = new Map<number, StaffModel>();

    const staves = mEl.getElementsByTagName("staff");
    for (const sEl of staves) {
      if (sEl.parentElement?.id !== mEl.id) continue;

      const staffN = Number.parseInt(sEl.getAttribute("n") ?? "1", 10);
      const layerModels = new Map<number, LayerModel>();

      const layers = sEl.getElementsByTagName("layer");
      for (const lEl of layers) {
        if (lEl.parentElement?.id !== sEl.id) continue;

        const layerN = Number.parseInt(lEl.getAttribute("n") ?? "1", 10);
        const events: EventModel[] = [];
        collectEvents(lEl, Offset.of(0), events, true);

        layerModels.set(layerN, { id: lEl.id ?? "", layerN, events });
      }

      staffModels.set(staffN, {
        id: sEl.id ?? "",
        staffN,
        layers: layerModels,
      });
    }

    // Calculate total duration (max length among all layers)
    let totalDuration = Duration.of(0);
    for (const staff of staffModels.values()) {
      for (const layer of staff.layers.values()) {
        const navigable = layer.events.filter((e) => e.isNavigable);
        if (navigable.length > 0) {
          const last = navigable[navigable.length - 1];
          const end = last.offset.add(last.duration).asDuration();
          if (end.compareTo(totalDuration) > 0) {
            totalDuration = end;
          }
        }
      }
    }

    // Determine final meter for this measure
    const measureMeter = currentMeter ?? {
      beats: totalDuration.value.toDouble(),
      beatType: Duration.of(1),
    };

    measureModels.push({
      id: mEl.id ?? "",
      measureIndex,
      measureN,
      meter: measureMeter,
      totalDuration,
      staves: staffModels,
    });
  }

  return new ScoreModel(measureModels);
}
