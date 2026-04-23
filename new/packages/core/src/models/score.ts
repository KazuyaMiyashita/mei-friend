import { type Duration, type IntervalStep, Key, Offset } from "./elements.js";
import { Rational } from "./math.js";

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
  /**
   * The diatonic staff position of this event, encoded as an `IntervalStep`
   * from C4 (C4 = 0, D4 = 1, …, B4 = 6, C5 = 7, B3 = −1, C3 = −7).
   * Defined only for pitched events (`<note>`); `undefined` for rests,
   * spaces, chords, and other non-pitched elements.
   *
   * Two events share a staff line or space when their `staffPosition` values
   * are equal, regardless of accidentals.
   */
  readonly staffPosition?: IntervalStep;
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
  readonly measureN: string | undefined;
  readonly meter: Meter;
  readonly totalDuration: Duration;
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
  constructor(
    readonly measures: ReadonlyArray<MeasureModel>,
    private readonly staffKeys: ReadonlyMap<number, Key> = new Map(),
  ) {}

  getMeasure(index: number): MeasureModel | undefined {
    return this.measures[index];
  }

  get length(): number {
    return this.measures.length;
  }

  /**
   * Returns the key signature in effect for the given staff number.
   * Falls back to C Major when no key signature is defined for the staff.
   *
   * @param staffN - Staff number (1-based).
   */
  getKeyForStaff(staffN: number): Key {
    return this.staffKeys.get(staffN) ?? Key.parse("C Major");
  }

  /**
   * Returns all events in the specified measure and staff whose diatonic
   * staff position equals `staffPos`, sorted by temporal offset ascending.
   *
   * Only events that carry a `staffPosition` (i.e., pitched `<note>` elements)
   * are returned.  Rests, spaces, chords, and other non-pitched events are
   * excluded.  All layers of the staff are searched.
   *
   * @param measureIndex - Zero-based measure index.
   * @param staffN - Staff number (1-based).
   * @param staffPos - Target staff position as an `IntervalStep` from C4.
   * @returns Events sorted by offset ascending, or an empty array if the
   *   measure or staff does not exist or has no matching events.
   */
  eventsAtStaffPosition(
    measureIndex: number,
    staffN: number,
    staffPos: IntervalStep,
  ): ReadonlyArray<EventModel> {
    const staff = this.getMeasure(measureIndex)?.staves.get(staffN);
    if (!staff) return [];

    const result: EventModel[] = [];
    for (const layer of staff.layers.values()) {
      for (const event of layer.events) {
        if (event.staffPosition?.value === staffPos.value) {
          result.push(event);
        }
      }
    }
    result.sort((a, b) => a.offset.compareTo(b.offset));
    return result;
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
    const lastBeatOffset = prevMeasure.totalDuration
      .sub(prevMeasure.meter.beatType)
      .asOffset();
    return new Cursor(this.scoreModel, {
      measureIndex: measureIndex - 1,
      staffN,
      layerN,
      offset: lastBeatOffset,
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
