import type { MeiElement } from "../../MeiElement.js";
import { Duration, Offset } from "../../models/index.js";
import {
  type AnyPosition,
  type EventModel,
  type LayerModel,
  type LayerPosition,
  type MeasureModel,
  ScoreModel,
  type StaffModel,
  type StaffPosition,
} from "../../models/score.js";
import { MeiLayer } from "../elements/structure/MeiLayer.js";
import { MeiMeasure } from "../elements/structure/MeiMeasure.js";
import { MeiStaff } from "../elements/structure/MeiStaff.js";
import { getDuration } from "./duration.js";

/**
 * Recursively collects musical events from an element, accumulating logical offsets.
 * Includes ALL elements in the layer as events (e.g. keySig, meterSig, beam, etc.).
 */
function collectEvents(
  el: MeiElement,
  baseOffset: Offset,
  events: EventModel[],
  layerPos: LayerPosition & { measureId: string },
  idIndex: Map<string, AnyPosition>,
): Offset {
  let offset = baseOffset;
  for (const child of el.children) {
    const dur = getDuration(child) ?? Duration.of(0);
    const id = child.id;

    // Add every element to events and index
    events.push({ id, offset, duration: dur });
    idIndex.set(id, { ...layerPos, offset });

    if (child.tagName === "chord") {
      // Notes inside a chord share the same offset and duration as the chord itself.
      for (const note of child.children) {
        events.push({ id: note.id, offset, duration: dur });
        idIndex.set(note.id, { ...layerPos, offset });
      }
      offset = offset.add(dur);
    } else {
      // For other elements, recurse to collect children, then advance offset by this element's duration.
      if (child.children.length > 0) {
        collectEvents(child, offset, events, layerPos, idIndex);
      }
      offset = offset.add(dur);
    }
  }
  return offset;
}

/** Builds a LayerModel and populates the idIndex for it and its contents. */
export function buildLayerModel(
  lEl: MeiElement,
  layerPos: LayerPosition & { measureId: string },
  idIndex: Map<string, AnyPosition>,
): LayerModel {
  const layerN = MeiLayer.create(lEl)?.n ?? 1;
  idIndex.set(lEl.id, {
    measureIndex: layerPos.measureIndex,
    staffN: layerPos.staffN,
    layerN,
  });

  const events: EventModel[] = [];
  collectEvents(lEl, Offset.of(0), events, { ...layerPos, layerN }, idIndex);

  return { id: lEl.id, layerN, events };
}

/** Builds a StaffModel and populates the idIndex for it and its contents. */
export function buildStaffModel(
  sEl: MeiElement,
  staffPos: StaffPosition & { measureId: string },
  idIndex: Map<string, AnyPosition>,
): StaffModel {
  const staffN = MeiStaff.create(sEl)?.n ?? 1;
  idIndex.set(sEl.id, {
    measureIndex: staffPos.measureIndex,
    staffN,
  });

  const layerModels = new Map<number, LayerModel>();
  const layers = sEl.getElementsByTagName("layer");
  for (const lEl of layers) {
    if (lEl.parentElement?.id !== sEl.id) continue;

    const layerN = MeiLayer.create(lEl)?.n ?? 1;
    const layer = buildLayerModel(
      lEl,
      { ...staffPos, staffN, layerN },
      idIndex,
    );
    layerModels.set(layerN, layer);
  }

  return { id: sEl.id, staffN, layers: layerModels };
}

/** Builds a MeasureModel and populates the idIndex for it and its contents. */
export function buildMeasureModel(
  mEl: MeiElement,
  measureIndex: number,
  idIndex: Map<string, AnyPosition>,
): MeasureModel {
  const measureN = MeiMeasure.create(mEl)?.n;
  idIndex.set(mEl.id, { measureIndex });

  const staffModels = new Map<number, StaffModel>();
  const staves = mEl.getElementsByTagName("staff");
  for (const sEl of staves) {
    if (sEl.parentElement?.id !== mEl.id) continue;

    const staffN = MeiStaff.create(sEl)?.n ?? 1;
    const staff = buildStaffModel(
      sEl,
      { measureIndex, staffN, measureId: mEl.id },
      idIndex,
    );
    staffModels.set(staffN, staff);
  }

  return {
    id: mEl.id,
    measureIndex,
    measureN,
    staves: staffModels,
  };
}

/**
 * Builds a complete ScoreModel from the root MEI element.
 */
export function buildScoreModel(root: MeiElement): ScoreModel {
  const measures = root.getElementsByTagName("measure");
  const measureModels: MeasureModel[] = [];
  const idIndex = new Map<string, AnyPosition>();

  for (let i = 0; i < measures.length; i++) {
    measureModels.push(buildMeasureModel(measures[i], i, idIndex));
  }

  return new ScoreModel(measureModels, idIndex);
}

/**
 * Updates a ScoreModel incrementally based on changed xmlIds.
 */
export function reconcileScoreModel(
  oldModel: ScoreModel,
  meiFriend: {
    getRootElement: () => MeiElement | undefined;
    getElementById: (id: string) => MeiElement | undefined;
  },
  updatedXmlIds: string[],
): ScoreModel {
  const root = meiFriend.getRootElement();
  if (!root) return oldModel;

  // If old model is empty or not initialized, do a full build
  if (oldModel.measures.length === 0) {
    return buildScoreModel(root);
  }

  const currentMeasureEls = root.getElementsByTagName("measure");
  // If the number of measures changed, rebuild everything to keep indices correct.
  if (currentMeasureEls.length !== oldModel.measures.length) {
    return buildScoreModel(root);
  }

  const dirtyMeasureIndices = new Set<number>();
  let needsFullRebuild = false;

  for (const id of updatedXmlIds) {
    const pos = oldModel.getPositionById(id);
    if (pos) {
      dirtyMeasureIndices.add(pos.measureIndex);
    } else {
      // Element not in old model index — might be newly added or outside measures.
      const el = meiFriend.getElementById(id);
      let curr = el;
      let foundMeasure = false;
      while (curr) {
        if (curr.tagName === "measure") {
          const idx = currentMeasureEls.findIndex((m) => m.id === curr?.id);
          if (idx !== -1) {
            dirtyMeasureIndices.add(idx);
            foundMeasure = true;
          }
          break;
        }
        curr = curr.parentElement;
      }
      if (!foundMeasure) {
        // Change is outside any measure (e.g., scoreDef in header)
        needsFullRebuild = true;
        break;
      }
    }
  }

  if (needsFullRebuild) {
    return buildScoreModel(root);
  }

  // Immutable update of dirty measures
  const newMeasures = [...oldModel.measures];
  const newIdIndex = new Map(oldModel.idIndex);

  for (const idx of dirtyMeasureIndices) {
    const mEl = currentMeasureEls[idx];
    if (mEl) {
      newMeasures[idx] = buildMeasureModel(mEl, idx, newIdIndex);
    }
  }

  return new ScoreModel(newMeasures, newIdIndex);
}
