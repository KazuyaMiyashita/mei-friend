import type { Duration, Offset } from "./index.js";

// ---------------------------------------------------------------------------
// ScoreModel data types
// ---------------------------------------------------------------------------

export interface EventModel {
  /** The `xml:id` of the corresponding element. Unique within the document. */
  readonly id: string;
  readonly offset: Offset;
  /**
   * The logical duration of this event.
   * May be `Duration.of(0)` for elements whose duration cannot be determined
   * or that do not occupy time (e.g. keySig, meterSig, clef).
   */
  readonly duration: Duration;
}

export interface LayerModel {
  /** The `xml:id` of the corresponding `<layer>` element. Unique within the document. */
  readonly id: string;
  /** The value of the `n` attribute on the corresponding `<layer>` element. */
  readonly layerN: number;
  /**
   * Events in document order. Offsets are not guaranteed to be monotonically
   * increasing — out-of-order offsets can arise from certain MEI constructs.
   */
  readonly events: ReadonlyArray<EventModel>;
}

export interface StaffModel {
  /** The `xml:id` of the corresponding `<staff>` element. Unique within the document. */
  readonly id: string;
  /**
   * The value of the `n` attribute on the corresponding `<staffDef>` / `<staff>`
   * element, as defined in the score definition.
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
   * the number printed on the score. May be duplicated across measures.
   */
  readonly measureN: string | undefined;
  /** Keyed by `staffN`. */
  readonly staves: ReadonlyMap<number, StaffModel>;
}

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

export interface MeasurePosition {
  readonly measureIndex: number;
}

export interface StaffPosition extends MeasurePosition {
  readonly staffN: number;
}

export interface LayerPosition extends StaffPosition {
  readonly layerN: number;
}

/**
 * Represents a precise time position within a specific layer of the score.
 */
export interface Position extends LayerPosition {
  readonly offset: Offset;
  /**
   * The `xml:id` of the measure element at this position.
   * `undefined` for virtual beat positions that do not correspond to a
   * specific measure in the document.
   */
  readonly measureId?: string;
}

/**
 * A union type representing a position at any level of the score hierarchy.
 */
export type AnyPosition =
  | MeasurePosition
  | StaffPosition
  | LayerPosition
  | Position;

// ---------------------------------------------------------------------------
// ScoreModel class
// ---------------------------------------------------------------------------

export class ScoreModel {
  constructor(
    readonly measures: ReadonlyArray<MeasureModel>,
    /** Fast lookup from xml:id to its position in the model. */
    readonly idIndex: ReadonlyMap<string, AnyPosition> = new Map(),
  ) {}

  getMeasure(index: number): MeasureModel | undefined {
    return this.measures[index];
  }

  get length(): number {
    return this.measures.length;
  }

  /**
   * Returns a Position for the given element id.
   * Uses the internal idIndex for O(1) lookup.
   */
  getPositionById(id: string): AnyPosition | undefined {
    return this.idIndex.get(id);
  }

  getLayer(pos: LayerPosition): LayerModel | undefined {
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
              continue;
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
              continue;
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
