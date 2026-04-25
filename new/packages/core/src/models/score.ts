import { type Duration, Offset } from "./index.js";
import { Rational } from "./math.js";

// ---------------------------------------------------------------------------
// ScoreModel data types
// ---------------------------------------------------------------------------

export interface EventModel {
  /** The `xml:id` of the corresponding element. Unique within the document. */
  readonly id: string;
  readonly offset: Offset;
  /**
   * The logical duration of this event.
   * May be `Duration.of(0)` for grace notes or elements whose duration cannot
   * be determined.
   */
  readonly duration: Duration;
  /**
   * True for top-level musical events (note, rest, chord, space, mRest).
   * False for notes inside a chord — kept so that `ScoreModel.getPositionById`
   * can resolve a chord-internal note ID to its parent chord's position, but
   * not treated as a navigation step by `Cursor`.
   */
  readonly isNavigable: boolean;
}

export interface LayerModel {
  /** The `xml:id` of the corresponding `<layer>` element. Unique within the document. */
  readonly id: string;
  /** The value of the `n` attribute on the corresponding `<layer>` element. */
  readonly layerN: number;
  /**
   * Events in document order. Offsets are not guaranteed to be monotonically
   * increasing — out-of-order offsets can arise from certain MEI constructs.
   * TODO: Consider enforcing ascending offset order as a model invariant.
   */
  readonly events: ReadonlyArray<EventModel>;
}

export interface StaffModel {
  /** The `xml:id` of the corresponding `<staff>` element. Unique within the document. */
  readonly id: string;
  /**
   * The value of the `n` attribute on the corresponding `<staffDef>` / `<staff>`
   * element, as defined in the score definition. Not necessarily a contiguous
   * sequence — e.g. a score may define only n=1 and n=3.
   */
  readonly staffN: number;
  /** Keyed by `layerN`. */
  readonly layers: ReadonlyMap<number, LayerModel>;
}

export interface Meter {
  readonly beats: number;
  readonly beatType: Duration;
}

export interface MeasureModel {
  /** The `xml:id` of the corresponding `<measure>` element. Unique within the document. */
  readonly id: string;
  /**
   * Zero-based index into `ScoreModel.measures`. Unique across the score.
   * Use this for all programmatic position references.
   */
  readonly measureIndex: number;
  /**
   * The value of the `n` attribute on the corresponding `<measure>` element —
   * the number printed on the score. May be duplicated across measures (e.g.
   * first and second endings share the same number) and may be `undefined`
   * when the attribute is absent.
   */
  readonly measureN: string | undefined;
  readonly meter: Meter;
  readonly totalDuration: Duration;
  /** Keyed by `staffN`. */
  readonly staves: ReadonlyMap<number, StaffModel>;
}

// ---------------------------------------------------------------------------
// Position
// ---------------------------------------------------------------------------

export interface Position {
  /** Zero-based index into `ScoreModel.measures`. */
  readonly measureIndex: number;
  /** The `n` attribute value of the target `<staff>`. See `StaffModel.staffN`. */
  readonly staffN: number;
  /** The `n` attribute value of the target `<layer>`. See `LayerModel.layerN`. */
  readonly layerN: number;
  readonly offset: Offset;
  /**
   * The `xml:id` of the measure element at this position.
   * `undefined` for virtual beat positions that do not correspond to a
   * specific measure in the document.
   */
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
// ScorePositionIterator
// ---------------------------------------------------------------------------

export interface ScorePositionIteratorOptions {
  /** Whether to include only the specific layer or all layers of the staff. */
  readonly scope: "layer" | "staff";
  /**
   * `"backward"` yields events from `position.offset` descending to the
   * beginning of the score.
   * `"forward"` yields events from `position.offset` ascending to the end.
   *
   * In both directions the event at exactly `position.offset` is **included**.
   */
  readonly direction: "backward" | "forward";
}

/**
 * Iterates over events in a score starting from a given `Position`.
 *
 * - `direction: "backward"` — from `position.offset` toward the start of the
 *   score, yielding events in descending offset order, crossing measure
 *   boundaries as needed.
 * - `direction: "forward"` — from `position.offset` toward the end of the
 *   score, yielding events in ascending offset order.
 *
 * The event at exactly `position.offset` is included in both directions.
 *
 * `scope: "layer"` restricts iteration to the layer identified by `layerN`.
 * `scope: "staff"` includes all layers of the staff.
 *
 * @example
 * ```ts
 * // Find the most recent keySig before (and at) a position
 * for (const event of new ScorePositionIterator(scoreModel, pos, {
 *   scope: "staff",
 *   direction: "backward",
 * })) {
 *   const el = meiFriend.getElementById(event.id);
 *   if (MeiKeySig.create(el)) { ... }
 * }
 * ```
 */
export class ScorePositionIterator implements Iterable<EventModel> {
  constructor(
    readonly scoreModel: ScoreModel,
    readonly position: Position,
    readonly options: ScorePositionIteratorOptions,
  ) {}

  [Symbol.iterator](): Iterator<EventModel> {
    const { scoreModel, position, options } = this;
    const { measureIndex, staffN, layerN, offset } = position;
    const { scope, direction } = options;

    function getLayers(measure: MeasureModel): ReadonlyArray<LayerModel> {
      const staff = measure.staves.get(staffN);
      if (!staff) return [];
      if (scope === "staff") return [...staff.layers.values()];
      const layer = staff.layers.get(layerN);
      return layer ? [layer] : [];
    }

    function* backward(): Generator<EventModel> {
      for (let mi = measureIndex; mi >= 0; mi--) {
        const measure = scoreModel.getMeasure(mi);
        if (!measure) continue;

        const collected: EventModel[] = [];
        for (const layer of getLayers(measure)) {
          for (const event of layer.events) {
            if (mi === measureIndex && event.offset.compareTo(offset) > 0) {
              continue; // skip events strictly after the reference offset
            }
            collected.push(event);
          }
        }
        collected.sort((a, b) => b.offset.compareTo(a.offset));
        yield* collected;
      }
    }

    function* forward(): Generator<EventModel> {
      for (let mi = measureIndex; mi < scoreModel.length; mi++) {
        const measure = scoreModel.getMeasure(mi);
        if (!measure) continue;

        const collected: EventModel[] = [];
        for (const layer of getLayers(measure)) {
          for (const event of layer.events) {
            if (mi === measureIndex && event.offset.compareTo(offset) < 0) {
              continue; // skip events strictly before the reference offset
            }
            collected.push(event);
          }
        }
        collected.sort((a, b) => a.offset.compareTo(b.offset));
        yield* collected;
      }
    }

    return direction === "backward" ? backward() : forward();
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
