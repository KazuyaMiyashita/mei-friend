import type { Pitch, Rest } from "./elements.js";
import { type Duration, Offset } from "./elements.js";
import { Rational } from "./math.js";

// NOTE: NoteInfo and TiesIndex (used by Mei.ts for Score<NoteInfo> building)
export interface NoteInfo {
  value: Pitch | Rest;
  id: string;
  isTieStarted: boolean;
  isTieEnded: boolean;
}

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

// ---------------------------------------------------------------------------
// ScoreModel data types
// ---------------------------------------------------------------------------

export interface EventModel {
  readonly id: string;
  readonly offset: Offset;
  readonly duration: Duration;
  /**
   * True for top-level musical events (note, rest, chord, space, mRest).
   * False for notes inside a chord — kept for click-target ID resolution
   * but not treated as navigation steps.
   */
  readonly isNavigable: boolean;
}

export interface LayerModel {
  readonly id: string;
  readonly layerN: number;
  readonly events: ReadonlyArray<EventModel>;
}

export interface StaffModel {
  readonly id: string;
  readonly staffN: number;
  readonly layers: ReadonlyMap<number, LayerModel>;
}

export interface Meter {
  readonly beats: number;
  readonly beatType: Duration;
}

export interface MeasureModel {
  readonly id: string;
  readonly measureIndex: number;
  readonly measureN: number;
  readonly meter: Meter;
  readonly staves: ReadonlyMap<number, StaffModel>;
}

// ---------------------------------------------------------------------------
// Position
// ---------------------------------------------------------------------------

export interface Position {
  readonly measureIndex: number;
  readonly staffN: number;
  readonly layerN: number;
  readonly offset: Offset;
  readonly measureId?: string;
}

// ---------------------------------------------------------------------------
// ScoreModel class
// ---------------------------------------------------------------------------

export class ScoreModel {
  constructor(readonly measures: ReadonlyArray<MeasureModel>) {}

  getMeasure(index: number): MeasureModel | undefined {
    return this.measures[index];
  }

  get length(): number {
    return this.measures.length;
  }

  /**
   * Returns the navigable EventModel whose time span includes pos.offset.
   * Span: event.offset <= pos.offset < event.offset + event.duration.
   * For virtual beat positions (no note starts here), returns the note that is
   * currently sounding at that offset.
   */
  getEventAt(pos: Position): EventModel | undefined {
    const layer = this.getLayer(pos);
    if (!layer) return undefined;

    for (const event of layer.events) {
      if (!event.isNavigable) continue;
      const end = event.offset.add(event.duration);
      if (
        pos.offset.compareTo(event.offset) >= 0 &&
        pos.offset.compareTo(end) < 0
      ) {
        return event;
      }
    }

    // Fallback: cursor exactly at the end of the last navigable event
    const navigable = layer.events.filter((e) => e.isNavigable);
    const last = navigable[navigable.length - 1];
    if (last) {
      const end = last.offset.add(last.duration);
      if (end.compareTo(pos.offset) === 0) return last;
    }

    return undefined;
  }

  /**
   * Returns a Position for the given event id.
   * For chord-internal notes (isNavigable: false), returns the parent chord's position.
   */
  getPositionById(id: string): Position | undefined {
    for (const measure of this.measures) {
      for (const [staffN, staff] of measure.staves) {
        for (const [layerN, layer] of staff.layers) {
          for (const event of layer.events) {
            if (event.id !== id) continue;
            if (!event.isNavigable) {
              const parent = layer.events.find(
                (e) => e.isNavigable && e.offset.compareTo(event.offset) === 0,
              );
              if (!parent) return undefined;
              return {
                measureIndex: measure.measureIndex,
                staffN,
                layerN,
                offset: parent.offset,
                measureId: measure.id,
              };
            }
            return {
              measureIndex: measure.measureIndex,
              staffN,
              layerN,
              offset: event.offset,
              measureId: measure.id,
            };
          }
        }
      }
    }
    return undefined;
  }

  private getLayer(pos: Position): LayerModel | undefined {
    return this.getMeasure(pos.measureIndex)
      ?.staves.get(pos.staffN)
      ?.layers.get(pos.layerN);
  }
}

// ---------------------------------------------------------------------------
// Cursor
// ---------------------------------------------------------------------------

export class Cursor {
  constructor(
    readonly scoreModel: ScoreModel,
    readonly position: Position,
  ) {}

  static fromId(scoreModel: ScoreModel, id: string): Cursor | undefined {
    const pos = scoreModel.getPositionById(id);
    return pos ? new Cursor(scoreModel, pos) : undefined;
  }

  /** Returns the navigable EventModel at the current position, or undefined for virtual positions. */
  getEvent(): EventModel | undefined {
    return this.scoreModel.getEventAt(this.position);
  }

  /** Moves to the next navigable event (including across measure boundaries). */
  nextEvent(): Cursor {
    const { measureIndex, staffN, layerN, offset } = this.position;
    const layer = this.scoreModel
      .getMeasure(measureIndex)
      ?.staves.get(staffN)
      ?.layers.get(layerN);
    if (!layer) return this;

    const navigable = layer.events.filter((e) => e.isNavigable);
    const next = navigable.find((e) => e.offset.compareTo(offset) > 0);
    if (next) {
      return new Cursor(this.scoreModel, {
        ...this.position,
        offset: next.offset,
      });
    }

    // Jump to next measure's first navigable event
    const nextMeasureIndex = measureIndex + 1;
    if (nextMeasureIndex >= this.scoreModel.length) return this;
    const nextMeasure = this.scoreModel.getMeasure(nextMeasureIndex);
    if (!nextMeasure) return this;
    const nextLayer = nextMeasure.staves.get(staffN)?.layers.get(layerN);
    if (!nextLayer) return this;
    const firstNavig = nextLayer.events.find((e) => e.isNavigable);
    if (!firstNavig) return this;
    return new Cursor(this.scoreModel, {
      measureIndex: nextMeasureIndex,
      staffN,
      layerN,
      offset: firstNavig.offset,
      measureId: nextMeasure.id,
    });
  }

  /** Moves to the previous navigable event. */
  prevEvent(): Cursor {
    const { measureIndex, staffN, layerN, offset } = this.position;
    const layer = this.scoreModel
      .getMeasure(measureIndex)
      ?.staves.get(staffN)
      ?.layers.get(layerN);
    if (!layer) return this;

    const navigable = layer.events.filter((e) => e.isNavigable);
    let prev: EventModel | undefined;
    for (const e of navigable) {
      if (e.offset.compareTo(offset) < 0) prev = e;
      else break;
    }
    if (prev) {
      return new Cursor(this.scoreModel, {
        ...this.position,
        offset: prev.offset,
      });
    }

    // Jump to prev measure's last navigable event
    if (measureIndex <= 0) return this;
    const prevMeasure = this.scoreModel.getMeasure(measureIndex - 1);
    if (!prevMeasure) return this;
    const prevLayer = prevMeasure.staves.get(staffN)?.layers.get(layerN);
    if (!prevLayer) return this;
    const prevNavigable = prevLayer.events.filter((e) => e.isNavigable);
    const lastNavig = prevNavigable[prevNavigable.length - 1];
    if (!lastNavig) return this;
    return new Cursor(this.scoreModel, {
      measureIndex: measureIndex - 1,
      staffN,
      layerN,
      offset: lastNavig.offset,
      measureId: prevMeasure.id,
    });
  }

  /** Moves up one staff (validates against ScoreModel). */
  staffUp(): Cursor {
    const newStaffN = this.position.staffN - 1;
    if (newStaffN < 1) return this;
    const measure = this.scoreModel.getMeasure(this.position.measureIndex);
    if (!measure?.staves.has(newStaffN)) return this;
    return new Cursor(this.scoreModel, { ...this.position, staffN: newStaffN });
  }

  /** Moves down one staff (validates against ScoreModel). */
  staffDown(): Cursor {
    const newStaffN = this.position.staffN + 1;
    const measure = this.scoreModel.getMeasure(this.position.measureIndex);
    if (!measure?.staves.has(newStaffN)) return this;
    return new Cursor(this.scoreModel, { ...this.position, staffN: newStaffN });
  }

  /**
   * Advances to the next beat boundary within the measure, or moves to the start of the next measure.
   */
  nextBeat(): Cursor {
    const { measureIndex, staffN, layerN } = this.position;
    const measure = this.scoreModel.getMeasure(measureIndex);
    if (!measure) return this;
    const beatDuration = measure.meter.beatType;

    const k =
      Math.floor(
        this.position.offset.value.div(beatDuration.value).toDouble() + 1e-9,
      ) + 1;
    const nextOffset = new Offset(beatDuration.value.mul(k));

    const layer = measure.staves.get(staffN)?.layers.get(layerN);
    const navigable = layer?.events.filter((e) => e.isNavigable) ?? [];
    const lastEvent = navigable[navigable.length - 1];
    const measureEnd = lastEvent
      ? lastEvent.offset.add(lastEvent.duration)
      : new Offset(beatDuration.value.mul(measure.meter.beats));

    if (nextOffset.compareTo(measureEnd) < 0) {
      return new Cursor(this.scoreModel, {
        ...this.position,
        offset: nextOffset,
      });
    }

    const nextMeasureIndex = measureIndex + 1;
    if (nextMeasureIndex >= this.scoreModel.length) return this;
    const nextMeasure = this.scoreModel.getMeasure(nextMeasureIndex);
    if (!nextMeasure) return this;
    return new Cursor(this.scoreModel, {
      measureIndex: nextMeasureIndex,
      staffN,
      layerN,
      offset: Offset.of(0),
      measureId: nextMeasure.id,
    });
  }

  /**
   * Retreats to the previous beat boundary, or moves to the start of the previous measure.
   */
  prevBeat(): Cursor {
    const { measureIndex, staffN, layerN } = this.position;
    const measure = this.scoreModel.getMeasure(measureIndex);
    if (!measure) return this;
    const beatDuration = measure.meter.beatType;

    const k =
      Math.ceil(
        this.position.offset.value.div(beatDuration.value).toDouble() - 1e-9,
      ) - 1;
    const prevOffset = new Offset(beatDuration.value.mul(k));

    if (prevOffset.value.compareTo(new Rational(0)) >= 0) {
      return new Cursor(this.scoreModel, {
        ...this.position,
        offset: prevOffset,
      });
    }

    if (measureIndex <= 0) return this;
    const prevMeasure = this.scoreModel.getMeasure(measureIndex - 1);
    if (!prevMeasure) return this;
    return new Cursor(this.scoreModel, {
      measureIndex: measureIndex - 1,
      staffN,
      layerN,
      offset: Offset.of(0),
      measureId: prevMeasure.id,
    });
  }

  /**
   * Snaps the current position to the nearest preceding beat boundary strictly defined by beatType.
   * Example: 4/4 (beatType 1), offset 1.5 -> 1.0. Offset 1.0 -> 1.0.
   */
  snapToBeat(): Cursor {
    const { measureIndex, offset } = this.position;
    const measure = this.scoreModel.getMeasure(measureIndex);
    if (!measure) return this;
    const beatDuration = measure.meter.beatType;

    const k = Math.floor(
      offset.value.div(beatDuration.value).toDouble() + 1e-9,
    );
    const snappedOffset = new Offset(beatDuration.value.mul(k));

    if (snappedOffset.compareTo(offset) === 0) return this;
    return new Cursor(this.scoreModel, {
      ...this.position,
      offset: snappedOffset,
    });
  }

  /**
   * Snaps the current position to the nearest preceding navigable event in the current staff/layer.
   * If no such event exists, snaps to Offset 0.
   */
  snapToEvent(): Cursor {
    const { measureIndex, staffN, layerN, offset } = this.position;
    const measure = this.scoreModel.getMeasure(measureIndex);
    if (!measure) return this;

    const layer = measure.staves.get(staffN)?.layers.get(layerN);
    const navigable = layer?.events.filter((e) => e.isNavigable) ?? [];
    let snappedOffset = Offset.of(0);
    for (const e of navigable) {
      if (e.offset.compareTo(offset) <= 0) {
        snappedOffset = e.offset;
      } else {
        break;
      }
    }

    if (snappedOffset.compareTo(offset) === 0) return this;
    return new Cursor(this.scoreModel, {
      ...this.position,
      offset: snappedOffset,
    });
  }
}
