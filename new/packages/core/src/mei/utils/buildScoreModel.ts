import type { MeiElement } from "../../MeiElement.js";
import { Duration, type Key, Offset } from "../../models/index.js";
import {
  type EventModel,
  type LayerModel,
  type MeasureModel,
  ScoreModel,
  type StaffModel,
} from "../../models/score.js";
import { MeiNote } from "../elements/events/MeiNote.js";
import { MeiKeySig } from "../elements/score-def/MeiKeySig.js";
import { MeiMeterSig } from "../elements/score-def/MeiMeterSig.js";
import { MeiScoreDef } from "../elements/score-def/MeiScoreDef.js";
import { MeiLayer } from "../elements/structure/MeiLayer.js";
import { MeiMeasure } from "../elements/structure/MeiMeasure.js";
import { MeiStaff } from "../elements/structure/MeiStaff.js";
import { getDuration } from "./duration.js";
import { getGlobalMeter } from "./meter.js";

const EVENT_TAGS = new Set(["note", "rest", "chord", "space", "mRest"]);
const CONTAINER_TAGS = new Set(["beam", "tuplet", "ftrem", "btrem"]);

/**
 * Collects the key signature in effect for each staff by scanning all
 * `<staffDef>` elements in the document.  When a staff has multiple
 * `<staffDef>` entries (e.g. a mid-piece key change), the first one in
 * document order is used — full per-measure key tracking is a TODO.
 */
function buildStaffKeys(root: MeiElement): ReadonlyMap<number, Key> {
  const map = new Map<number, Key>();
  for (const sd of root.getElementsByTagName("staffDef")) {
    const n = Number.parseInt(sd.getAttribute("n") ?? "0", 10);
    if (!n || map.has(n)) continue;
    const keySigEl = sd.getChildElement("keySig");
    if (!keySigEl) continue;
    const key = MeiKeySig.create(keySigEl)?.toKey();
    if (key) map.set(n, key);
  }
  return map;
}

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
      // Staff position: diatonic line/space as an IntervalStep from C4
      // (C4=0, D4=1, …, B4=6, C5=7, B3=−1). Two notes share a staff position
      // when their values are equal, regardless of accidentals.
      const staffPosition = MeiNote.create(child)?.pitch?.asInterval().step();
      events.push({
        id,
        offset,
        duration: dur,
        isNavigable: navigable,
        staffPosition,
      });

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
 *
 * // TODO テストがないぞ？？？
 */
export function buildScoreModel(root: MeiElement): ScoreModel {
  const staffKeys = buildStaffKeys(root);
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
        const meter = MeiScoreDef.create(scoreDefEl)?.getMeter();
        if (meter) currentMeter = meter;
      }
    }

    const measureN = MeiMeasure.create(mEl)?.n;
    const staffModels = new Map<number, StaffModel>();

    const staves = mEl.getElementsByTagName("staff");
    for (const sEl of staves) {
      if (sEl.parentElement?.id !== mEl.id) continue;

      const staffN = MeiStaff.create(sEl)?.n ?? 1;
      const layerModels = new Map<number, LayerModel>();

      const layers = sEl.getElementsByTagName("layer");
      for (const lEl of layers) {
        if (lEl.parentElement?.id !== sEl.id) continue;

        const layerN = MeiLayer.create(lEl)?.n ?? 1;
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

  return new ScoreModel(measureModels, staffKeys);
}
