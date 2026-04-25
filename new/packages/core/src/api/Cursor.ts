import type { MeiFriend } from "../MeiFriend.js";
import { isNavigable } from "../mei/utils/navigable.js";
import { Duration, Offset, Rational } from "../models/index.js";
import type { EventModel, Position, ScoreModel } from "../models/score.js";

/**
 * Cursor provides navigation logic over a ScoreModel, using MeiFriend to
 * determine musical properties like navigability and meters.
 */
export class Cursor {
  constructor(
    readonly meiFriend: MeiFriend,
    readonly scoreModel: ScoreModel,
    readonly position: Position,
  ) {}

  /**
   * Creates a Cursor from an element ID.
   * Returns undefined if the ID is not found in the ScoreModel's idIndex.
   */
  static fromId(meiFriend: MeiFriend, id: string): Cursor | undefined {
    const scoreModel = meiFriend.getScoreModel();
    const pos = scoreModel.getPositionById(id);
    // Cursor only points to precise time positions (Position)
    if (pos && "offset" in pos) {
      return new Cursor(meiFriend, scoreModel, pos);
    }
    return undefined;
  }

  /**
   * Returns true if the event at the given ID is a navigable musical event.
   * Top-level notes, rests, chords, etc. are navigable; notes inside chords are not.
   */
  private isNavigable(id: string): boolean {
    return isNavigable(this.meiFriend, id);
  }

  /** Returns the navigable EventModel at the current position, or undefined for virtual positions. */
  getEvent(): EventModel | undefined {
    const layer = this.scoreModel.getLayer(this.position);
    if (!layer) return undefined;

    for (const event of layer.events) {
      if (!this.isNavigable(event.id)) continue;
      const end = event.offset.add(event.duration);
      if (
        this.position.offset.compareTo(event.offset) >= 0 &&
        this.position.offset.compareTo(end) < 0
      ) {
        return event;
      }
    }

    // Fallback: cursor exactly at the end of the last navigable event
    const navigable = layer.events.filter((e) => this.isNavigable(e.id));
    const last = navigable[navigable.length - 1];
    if (last) {
      const end = last.offset.add(last.duration);
      if (end.compareTo(this.position.offset) === 0) return last;
    }

    return undefined;
  }

  /** Moves to the next navigable event (including across measure boundaries). */
  nextEvent(): Cursor {
    const { measureIndex, staffN, layerN, offset } = this.position;
    const layer = this.scoreModel.getLayer(this.position);
    if (!layer) return this;

    const navigable = layer.events.filter((e) => this.isNavigable(e.id));
    const next = navigable.find((e) => e.offset.compareTo(offset) > 0);
    if (next) {
      return new Cursor(this.meiFriend, this.scoreModel, {
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
    const firstNavig = nextLayer.events.find((e) => this.isNavigable(e.id));
    if (!firstNavig) return this;
    return new Cursor(this.meiFriend, this.scoreModel, {
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
    const layer = this.scoreModel.getLayer(this.position);
    if (!layer) return this;

    const navigable = layer.events.filter((e) => this.isNavigable(e.id));
    let prev: EventModel | undefined;
    for (const e of navigable) {
      if (e.offset.compareTo(offset) < 0) prev = e;
      else break;
    }
    if (prev) {
      return new Cursor(this.meiFriend, this.scoreModel, {
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
    const prevNavigable = prevLayer.events.filter((e) =>
      this.isNavigable(e.id),
    );
    const lastNavig = prevNavigable[prevNavigable.length - 1];
    if (!lastNavig) return this;
    return new Cursor(this.meiFriend, this.scoreModel, {
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
    return new Cursor(this.meiFriend, this.scoreModel, {
      ...this.position,
      staffN: newStaffN,
    });
  }

  /** Moves down one staff (validates against ScoreModel). */
  staffDown(): Cursor {
    const newStaffN = this.position.staffN + 1;
    const measure = this.scoreModel.getMeasure(this.position.measureIndex);
    if (!measure?.staves.has(newStaffN)) return this;
    return new Cursor(this.meiFriend, this.scoreModel, {
      ...this.position,
      staffN: newStaffN,
    });
  }

  /**
   * Advances to the next beat boundary within the measure, or moves to the start of the next measure.
   */
  nextBeat(): Cursor {
    const { measureIndex, staffN, layerN } = this.position;
    const measure = this.scoreModel.getMeasure(measureIndex);
    if (!measure) return this;

    // Use dynamic meter calculation from api
    const meter = this.meiFriend.api.getMeterAt(measureIndex);
    const beatDuration = meter.beatType;

    const k =
      Math.floor(
        this.position.offset.value.div(beatDuration.value).toDouble() + 1e-9,
      ) + 1;
    const nextOffset = new Offset(beatDuration.value.mul(k));

    const layer = measure.staves.get(staffN)?.layers.get(layerN);
    const navigable = layer?.events.filter((e) => this.isNavigable(e.id)) ?? [];
    const lastEvent = navigable[navigable.length - 1];
    const measureEnd = lastEvent
      ? lastEvent.offset.add(lastEvent.duration)
      : new Offset(beatDuration.value.mul(meter.beats));

    if (nextOffset.compareTo(measureEnd) < 0) {
      return new Cursor(this.meiFriend, this.scoreModel, {
        ...this.position,
        offset: nextOffset,
      });
    }

    const nextMeasureIndex = measureIndex + 1;
    if (nextMeasureIndex >= this.scoreModel.length) return this;
    const nextMeasure = this.scoreModel.getMeasure(nextMeasureIndex);
    if (!nextMeasure) return this;
    return new Cursor(this.meiFriend, this.scoreModel, {
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

    const meter = this.meiFriend.api.getMeterAt(measureIndex);
    const beatDuration = meter.beatType;

    const k =
      Math.ceil(
        this.position.offset.value.div(beatDuration.value).toDouble() - 1e-9,
      ) - 1;
    const prevOffset = new Offset(beatDuration.value.mul(k));

    if (prevOffset.value.compareTo(new Rational(0)) >= 0) {
      return new Cursor(this.meiFriend, this.scoreModel, {
        ...this.position,
        offset: prevOffset,
      });
    }

    if (measureIndex <= 0) return this;
    const prevMeasure = this.scoreModel.getMeasure(measureIndex - 1);
    if (!prevMeasure) return this;
    const prevMeter = this.meiFriend.api.getMeterAt(measureIndex - 1);
    const prevTotalDuration = this.getMeasureDuration(measureIndex - 1);
    const lastBeatOffset = prevTotalDuration.sub(prevMeter.beatType).asOffset();
    return new Cursor(this.meiFriend, this.scoreModel, {
      measureIndex: measureIndex - 1,
      staffN,
      layerN,
      offset: lastBeatOffset,
      measureId: prevMeasure.id,
    });
  }

  /**
   * Snaps the current position to the nearest preceding beat boundary strictly defined by beatType.
   */
  snapToBeat(): Cursor {
    const { measureIndex, offset } = this.position;
    const meter = this.meiFriend.api.getMeterAt(measureIndex);
    const beatDuration = meter.beatType;

    const k = Math.floor(
      offset.value.div(beatDuration.value).toDouble() + 1e-9,
    );
    const snappedOffset = new Offset(beatDuration.value.mul(k));

    if (snappedOffset.compareTo(offset) === 0) return this;
    return new Cursor(this.meiFriend, this.scoreModel, {
      ...this.position,
      offset: snappedOffset,
    });
  }

  /**
   * Snaps the current position to the nearest preceding navigable event in the current staff/layer.
   */
  snapToEvent(): Cursor {
    const { measureIndex, staffN, layerN, offset } = this.position;
    const measure = this.scoreModel.getMeasure(measureIndex);
    if (!measure) return this;

    const layer = measure.staves.get(staffN)?.layers.get(layerN);
    const navigable = layer?.events.filter((e) => this.isNavigable(e.id)) ?? [];
    let snappedOffset = Offset.of(0);
    for (const e of navigable) {
      if (e.offset.compareTo(offset) <= 0) {
        snappedOffset = e.offset;
      } else {
        break;
      }
    }

    if (snappedOffset.compareTo(offset) === 0) return this;
    return new Cursor(this.meiFriend, this.scoreModel, {
      ...this.position,
      offset: snappedOffset,
    });
  }

  private getMeasureDuration(index: number): Duration {
    const measure = this.scoreModel.getMeasure(index);
    if (!measure) return Duration.of(0);
    let maxDur = Duration.of(0);
    for (const staff of measure.staves.values()) {
      for (const layer of staff.layers.values()) {
        const navigable = layer.events.filter((e) => this.isNavigable(e.id));
        if (navigable.length > 0) {
          const last = navigable[navigable.length - 1];
          const end = last.offset.add(last.duration).asDuration();
          if (end.compareTo(maxDur) > 0) maxDur = end;
        }
      }
    }
    return maxDur;
  }
}
