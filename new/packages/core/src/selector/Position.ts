import type { MeiElement } from "../MeiElement.js";
import type { MeiFriend } from "../MeiFriend.js";
import { MeiChord } from "../mei/events/MeiChord.js";
import { MeiNote } from "../mei/events/MeiNote.js";
import { MeiRest } from "../mei/events/MeiRest.js";
import { type Duration, Offset } from "../models/elements.js";

/**
 * Represents a logical position in a musical score.
 */
export interface Position {
  /** The 'n' attribute of the staff (e.g., "1"). */
  readonly staff: string;
  /** The 'n' attribute of the layer (e.g., "1"). */
  readonly layer: string;
  /** 0-based index of the measure in the document. */
  readonly measureIndex: number;
  /** Logical offset from the start of the measure. */
  readonly offset: Offset;
  /** Optional hint xml:id of the measure. */
  readonly measureId?: string;
}

/**
 * Calculates the logical position of an element given its xml:id.
 */
export function getPositionFromId(
  friend: MeiFriend,
  id: string,
): Position | undefined {
  const element = friend.getElementById(id);
  if (!element) return undefined;

  let current: MeiElement | undefined = element;
  let layerN = "1";
  let staffN = "1";
  let measureElement: MeiElement | undefined;

  // Trace up to find containers
  while (current) {
    const tagName = current.tagName;
    if (tagName === "layer") {
      layerN = current.getAttribute("n") || "1";
    } else if (tagName === "staff") {
      staffN = current.getAttribute("n") || "1";
    } else if (tagName === "measure") {
      measureElement = current;
      break;
    }
    current = current.parentElement;
  }

  if (!measureElement) return undefined;

  // Calculate measureIndex
  const allMeasures = friend.getElementsByTagName("measure");
  const measureId = measureElement.id;
  // Compare the underlying Yjs nodes for reliable identity check
  const measureIndex = allMeasures.findIndex(
    (m) => m.yNode === measureElement?.yNode,
  );

  // Re-find the layer inside the measure to be safe
  const targetLayer = findLayer(measureElement, staffN, layerN);
  if (!targetLayer) return undefined;

  let offset = Offset.of(0);
  for (const child of targetLayer.children) {
    if (child.id === id) {
      break;
    }
    const duration = getElementDuration(child);
    if (duration) {
      offset = offset.add(duration);
    }
    // If the target is INSIDE a chord, we need to handle that.
    if (child.tagName === "chord") {
      const notes = child.children.filter(
        (c: MeiElement) => c.tagName === "note",
      );
      if (notes.some((n: MeiElement) => n.id === id)) break;
    }
  }

  return { staff: staffN, layer: layerN, measureIndex, offset, measureId };
}

function findLayer(
  measure: MeiElement,
  staffN: string,
  layerN: string,
): MeiElement | undefined {
  const staffs = measure.children.filter(
    (c: MeiElement) => c.tagName === "staff",
  );
  const staff =
    staffs.find((s: MeiElement) => s.getAttribute("n") === staffN) || staffs[0];
  if (!staff) return undefined;
  const layers = staff.children.filter(
    (c: MeiElement) => c.tagName === "layer",
  );
  return (
    layers.find((l: MeiElement) => l.getAttribute("n") === layerN) || layers[0]
  );
}

function getElementDuration(element: MeiElement): Duration | undefined {
  const tag = element.tagName;
  if (tag === "note") return new MeiNote(element).duration;
  if (tag === "rest") return new MeiRest(element).duration;
  if (tag === "chord") return new MeiChord(element).duration;
  if (tag === "space") return new MeiRest(element).duration; // Space behaves like rest for duration
  return undefined;
}

/**
 * Finds the element xml:id at a given position.
 */
export function getIdAtPosition(
  friend: MeiFriend,
  pos: Position,
): string | undefined {
  const allMeasures = friend.getElementsByTagName("measure");
  const measure = allMeasures[pos.measureIndex];
  if (!measure) return undefined;

  const layer = findLayer(measure, pos.staff, pos.layer);
  if (!layer) return undefined;

  let currentOffset = Offset.of(0);
  for (const child of layer.children) {
    const duration = getElementDuration(child);
    if (duration) {
      const nextOffset = currentOffset.add(duration);
      // If the target offset is within this element's duration
      if (
        pos.offset.compareTo(currentOffset) >= 0 &&
        pos.offset.compareTo(nextOffset) < 0
      ) {
        return child.id;
      }
      currentOffset = nextOffset;
    }
  }

  // Fallback: if exactly at the end of the last element
  const lastChild = layer.children
    .filter((c: MeiElement) => getElementDuration(c))
    .pop();
  if (lastChild && currentOffset.compareTo(pos.offset) === 0) {
    return lastChild.id;
  }

  return undefined;
}
