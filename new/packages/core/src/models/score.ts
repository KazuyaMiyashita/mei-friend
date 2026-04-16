import type { MeiElement } from "../MeiElement.js";
import type { MeiFriend } from "../MeiFriend.js";
import type { Pitch, Rest } from "./elements.js";

/**
 * Information associated with a note or rest in a logical score model.
 */
export interface NoteInfo {
  value: Pitch | Rest;
  id: string;
  isTieStarted: boolean;
  isTieEnded: boolean;
}

/**
 * Index for quick lookup of tie presence by note ID.
 */
export class TiesIndex {
  private startNoteToTie = new Map<string, string>();
  private endNoteToTie = new Map<string, string>();

  constructor(ties: { id?: string; startId?: string; endId?: string }[]) {
    for (const t of ties) {
      const tieId = t.id ?? "";
      if (t.startId) this.startNoteToTie.set(t.startId, tieId);
      if (t.endId) this.endNoteToTie.set(t.endId, tieId);
    }
  }

  hasStartId(noteId: string): boolean {
    return this.startNoteToTie.has(noteId);
  }

  hasEndId(noteId: string): boolean {
    return this.endNoteToTie.has(noteId);
  }

  getTieIdByStartId(noteId: string): string | undefined {
    return this.startNoteToTie.get(noteId);
  }

  getTieIdByEndId(noteId: string): string | undefined {
    return this.endNoteToTie.get(noteId);
  }
}

// --- Logical Score Model for Rendering/Overlays ---

export interface NoteModel {
  id: string;
}

export interface LayerModel {
  xmlId: string;
  notes: NoteModel[];
}

export interface StaffModel {
  xmlId: string;
  layers: Map<number, LayerModel>;
}

export interface MeasureModel {
  xmlId: string;
  staves: Map<number, StaffModel>;
}

export type ScoreModel = Map<number, MeasureModel>;

/**
 * Recursively collects musical events (notes, rests, chords, etc.) from an element.
 */
function collectEvents(element: MeiElement, events: NoteModel[]) {
  for (const child of element.children) {
    const tagName = child.tagName;
    if (["note", "rest", "chord", "mRest"].includes(tagName)) {
      if (child.id) {
        events.push({ id: child.id });
      }
      // If it's a chord, we also want to collect the notes inside it
      if (tagName === "chord") {
        collectEvents(child, events);
      }
    } else if (
      ["beam", "tuplet", "ftrem", "btrem", "layer"].includes(tagName)
    ) {
      // Recurse into containers
      collectEvents(child, events);
    }
  }
}

/**
 * Builds a logical score model from a MeiFriend instance.
 * This model is used for mapping between MEI elements and their rendered counterparts.
 */
export function buildScoreModel(mei: MeiFriend): ScoreModel {
  const model: ScoreModel = new Map();
  const measures = mei.getElementsByTagName("measure");

  for (const mEl of measures) {
    const mN = Number.parseInt(mEl.getAttribute("n") || "1", 10);
    const staffModels = new Map<number, StaffModel>();

    const staves = mEl.getElementsByTagName("staff");
    for (const sEl of staves) {
      if (sEl.parentElement?.id !== mEl.id) continue;

      const sN = Number.parseInt(sEl.getAttribute("n") || "1", 10);
      const layerModels = new Map<number, LayerModel>();

      const layers = sEl.getElementsByTagName("layer");
      for (const lEl of layers) {
        if (lEl.parentElement?.id !== sEl.id) continue;

        const lN = Number.parseInt(lEl.getAttribute("n") || "1", 10);
        const notes: NoteModel[] = [];

        collectEvents(lEl, notes);

        layerModels.set(lN, {
          xmlId: lEl.id || "",
          notes: notes,
        });
      }

      staffModels.set(sN, {
        xmlId: sEl.id || "",
        layers: layerModels,
      });
    }

    model.set(mN, {
      xmlId: mEl.id || "",
      staves: staffModels,
    });
  }

  return model;
}
