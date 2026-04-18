import type { MeiElement } from "../../MeiElement.js";
import { Duration, Offset } from "../../models/elements.js";
import {
  type EventModel,
  type LayerModel,
  type MeasureModel,
  type Meter,
  ScoreModel,
  type StaffModel,
} from "../../models/score.js";
import { getDurationFromAttributes } from "../events/utils.js";

const EVENT_TAGS = new Set(["note", "rest", "chord", "space", "mRest"]);
const CONTAINER_TAGS = new Set(["beam", "tuplet", "ftrem", "btrem"]);

/**
 * Extracts meter information from a scoreDef element.
 */
function getMeterFromScoreDef(scoreDef: MeiElement): Partial<Meter> {
  const count = scoreDef.getAttribute("meter.count");
  const unit = scoreDef.getAttribute("meter.unit");
  const meter: { beats?: number; beatType?: Duration } = {};
  if (count) meter.beats = Number.parseInt(count, 10);
  if (unit) meter.beatType = Duration.of(4, Number.parseInt(unit, 10));
  return meter;
}

/**
 * Recursively collects musical events from a layer element,
 * accumulating logical offsets. All MEI element-name knowledge lives here.
 *
 * @param el           - Element to traverse (layer or container)
 * @param baseOffset   - Offset at the start of this element
 * @param events       - Accumulator for collected EventModels
 * @param navigable    - Whether children are top-level navigable events
 * @returns The offset after the last event found
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
      const dur =
        getDurationFromAttributes(child.getAttributes()) ?? Duration.of(0);
      events.push({ id, offset, duration: dur, isNavigable: navigable });

      if (tag === "chord") {
        // Chord's internal notes are non-navigable (kept for click-target resolution)
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
  let currentMeter: Meter = { beats: 4, beatType: Duration.of(1) }; // Default 4/4

  // Initial meter from global scoreDef
  const globalScoreDef = root.getElementsByTagName("scoreDef")[0];
  if (globalScoreDef) {
    const m = getMeterFromScoreDef(globalScoreDef);
    currentMeter = { ...currentMeter, ...m };
  }

  const measures = root.getElementsByTagName("measure");
  const measureModels: MeasureModel[] = [];

  for (let measureIndex = 0; measureIndex < measures.length; measureIndex++) {
    const mEl = measures[measureIndex];

    // Update meter if measure has a scoreDef
    const measureScoreDef = mEl.getElementsByTagName("scoreDef")[0];
    if (measureScoreDef && measureScoreDef.parentElement?.id === mEl.id) {
      const m = getMeterFromScoreDef(measureScoreDef);
      currentMeter = { ...currentMeter, ...m };
    }

    const measureN = Number.parseInt(mEl.getAttribute("n") ?? "1", 10);
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

    measureModels.push({
      id: mEl.id ?? "",
      measureIndex,
      measureN,
      meter: currentMeter,
      staves: staffModels,
    });
  }

  return new ScoreModel(measureModels);
}
