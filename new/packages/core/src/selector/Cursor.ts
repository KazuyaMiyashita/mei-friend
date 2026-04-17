import type { MeiElement } from "../MeiElement.js";
import type { MeiFriend } from "../MeiFriend.js";
import {
  getIdAtPosition,
  getPositionFromId,
  type Position,
} from "./Position.js";

/**
 * A Cursor represents a point of interaction in the score.
 * It provides methods to move logically through the music.
 */
export class Cursor {
  constructor(
    public readonly friend: MeiFriend,
    public readonly position: Position,
  ) {}

  /** Create a cursor from an xml:id. */
  static fromId(friend: MeiFriend, id: string): Cursor | undefined {
    const pos = getPositionFromId(friend, id);
    return pos ? new Cursor(friend, pos) : undefined;
  }

  /** Gets the xml:id of the element at the current cursor position. */
  getElementId(): string | undefined {
    return getIdAtPosition(this.friend, this.position);
  }

  /** Moves to the next logical event (note/rest/chord). */
  nextEvent(): Cursor {
    const currentId = this.getElementId();
    if (!currentId) return this;

    const element = this.friend.getElementById(currentId);
    if (!element) return this;

    // Find next sibling event in same layer
    let next = element.nextElementSibling;
    while (next && !this.isEvent(next)) {
      next = next.nextElementSibling;
    }

    if (next?.id) {
      const newPos = getPositionFromId(this.friend, next.id);
      return newPos ? new Cursor(this.friend, newPos) : this;
    }

    // Jump to next measure
    const nextMeasureIndex = this.position.measureIndex + 1;
    const allMeasures = this.friend.getElementsByTagName("measure");
    if (nextMeasureIndex < allMeasures.length) {
      const nextMeasure = allMeasures[nextMeasureIndex];
      const layer = this.findLayer(
        nextMeasure,
        this.position.staff,
        this.position.layer,
      );
      const firstEvent = layer?.children.find((c: MeiElement) =>
        this.isEvent(c),
      );
      if (firstEvent?.id) {
        const newPos = getPositionFromId(this.friend, firstEvent.id);
        return newPos ? new Cursor(this.friend, newPos) : this;
      }
    }

    return this;
  }

  /** Moves to the previous logical event. */
  prevEvent(): Cursor {
    const currentId = this.getElementId();
    if (!currentId) return this;

    const element = this.friend.getElementById(currentId);
    if (!element) return this;

    let prev = element.previousElementSibling;
    while (prev && !this.isEvent(prev)) {
      prev = prev.previousElementSibling;
    }

    if (prev?.id) {
      const newPos = getPositionFromId(this.friend, prev.id);
      return newPos ? new Cursor(this.friend, newPos) : this;
    }

    // Jump to prev measure
    const prevMeasureIndex = this.position.measureIndex - 1;
    if (prevMeasureIndex >= 0) {
      const allMeasures = this.friend.getElementsByTagName("measure");
      const prevMeasure = allMeasures[prevMeasureIndex];
      const layer = this.findLayer(
        prevMeasure,
        this.position.staff,
        this.position.layer,
      );
      const lastEvent = layer?.children
        .filter((c: MeiElement) => this.isEvent(c))
        .pop();
      if (lastEvent?.id) {
        const newPos = getPositionFromId(this.friend, lastEvent.id);
        return newPos ? new Cursor(this.friend, newPos) : this;
      }
    }

    return this;
  }

  /** Moves up a staff. */
  staffUp(): Cursor {
    const staffN = parseInt(this.position.staff, 10);
    if (Number.isNaN(staffN) || staffN <= 1) return this;
    return new Cursor(this.friend, {
      ...this.position,
      staff: (staffN - 1).toString(),
    });
  }

  /** Moves down a staff. */
  staffDown(): Cursor {
    const staffN = parseInt(this.position.staff, 10);
    if (Number.isNaN(staffN)) return this;
    return new Cursor(this.friend, {
      ...this.position,
      staff: (staffN + 1).toString(),
    });
  }

  private isEvent(element: MeiElement): boolean {
    const tag = element.tagName;
    return (
      tag === "note" || tag === "rest" || tag === "chord" || tag === "space"
    );
  }

  private findLayer(
    measure: MeiElement,
    staffN: string,
    layerN: string,
  ): MeiElement | undefined {
    const staffs = measure.children.filter(
      (c: MeiElement) => c.tagName === "staff",
    );
    const staff =
      staffs.find((s: MeiElement) => s.getAttribute("n") === staffN) ||
      staffs[0];
    if (!staff) return undefined;
    const layers = staff.children.filter(
      (c: MeiElement) => c.tagName === "layer",
    );
    return (
      layers.find((l: MeiElement) => l.getAttribute("n") === layerN) ||
      layers[0]
    );
  }
}
