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

export function buildScoreModel(doc: Document): ScoreModel {
  const model: ScoreModel = new Map();
  const measures = Array.from(doc.querySelectorAll("measure"));

  for (const mEl of measures) {
    const mN = Number.parseInt(mEl.getAttribute("n") || "1", 10);
    const staffModels = new Map<number, StaffModel>();

    const staves = Array.from(mEl.querySelectorAll("staff"));
    for (const sEl of staves) {
      const sN = Number.parseInt(sEl.getAttribute("n") || "1", 10);
      const layerModels = new Map<number, LayerModel>();

      const layers = Array.from(sEl.querySelectorAll("layer"));
      for (const lEl of layers) {
        const lN = Number.parseInt(lEl.getAttribute("n") || "1", 10);
        const notes: NoteModel[] = [];

        // Find all notes, rests, chords, mRests
        const noteElements = Array.from(
          lEl.querySelectorAll("note, rest, chord, mRest"),
        );
        for (const nEl of noteElements) {
          const id = nEl.getAttribute("xml:id") || "";
          if (id) {
            notes.push({ id });
          }
        }

        layerModels.set(lN, {
          xmlId: lEl.getAttribute("xml:id") || "",
          notes,
        });
      }

      staffModels.set(sN, {
        xmlId: sEl.getAttribute("xml:id") || "",
        layers: layerModels,
      });
    }

    model.set(mN, {
      xmlId: mEl.getAttribute("xml:id") || "",
      staves: staffModels,
    });
  }

  return model;
}
