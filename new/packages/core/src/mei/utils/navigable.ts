import type { MeiFriend } from "../../MeiFriend.js";

const NAVIGABLE_TAGS = new Set(["note", "rest", "chord", "space", "mRest"]);

/**
 * Returns true if the element with the given ID is a navigable musical event.
 * Top-level notes, rests, chords, etc. are navigable; notes inside chords are not.
 */
export function isNavigable(meiFriend: MeiFriend, id: string): boolean {
  const el = meiFriend.getElementById(id);
  if (!el) return false;
  if (!NAVIGABLE_TAGS.has(el.tagName)) return false;
  if (el.tagName === "note" && el.parentElement?.tagName === "chord")
    return false;
  return true;
}
