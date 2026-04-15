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
 * It does not have any information about MeiTie, so you need to get it from MeiFriend using getElementById.
 */
export class TiesIndex {
  /**
   * Map of Note ID to Tie ID for ties starting at this note.
   * Key: The ID of the note that starts the tie (@startid).
   * Value: The ID of the tie element itself (@xml:id).
   */
  private startNoteToTie = new Map<string, string>();

  /**
   * Map of Note ID to Tie ID for ties ending at this note.
   * Key: The ID of the note that ends the tie (@endid).
   * Value: The ID of the tie element itself (@xml:id).
   */
  private endNoteToTie = new Map<string, string>();

  constructor(ties: { id?: string; startId?: string; endId?: string }[]) {
    for (const t of ties) {
      const tieId = t.id ?? "";
      if (t.startId) this.startNoteToTie.set(t.startId, tieId);
      if (t.endId) this.endNoteToTie.set(t.endId, tieId);
    }
  }

  /** Checks if a note with the given ID starts a tie. */
  hasStartId(noteId: string): boolean {
    return this.startNoteToTie.has(noteId);
  }

  /** Checks if a note with the given ID ends a tie. */
  hasEndId(noteId: string): boolean {
    return this.endNoteToTie.has(noteId);
  }

  /** Gets the ID of the tie that starts at the given note ID. */
  getTieIdByStartId(noteId: string): string | undefined {
    return this.startNoteToTie.get(noteId);
  }

  /** Gets the ID of the tie that ends at the given note ID. */
  getTieIdByEndId(noteId: string): string | undefined {
    return this.endNoteToTie.get(noteId);
  }
}
