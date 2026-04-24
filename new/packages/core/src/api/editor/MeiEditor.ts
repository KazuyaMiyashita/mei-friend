import type { MeiElement } from "../../MeiElement.js";
import type { MeiFriend } from "../../MeiFriend.js";
import { MeiNote } from "../../mei/elements/events/MeiNote.js";
import { alterToAccidGes } from "../../mei/utils/duration.js";
import {
  IntervalStep,
  IPN,
  type IPNAlter,
  type Key,
  type Offset,
} from "../../models/index.js";

export interface AccidentalCorrection {
  readonly id: string;
  readonly element: MeiElement;
}

export interface PitchMoveResult {
  readonly note: MeiElement;
  readonly accidentalCorrections: ReadonlyArray<AccidentalCorrection>;
}

/**
 * Provides pitch-editing operations for `<note>` elements.
 *
 * All methods return a **`PitchMoveResult`** — they do not modify the document.
 * Apply the result with:
 * ```ts
 * const result = editor.pitchUp(noteId);
 * meiFriend.updateBatch([result.note, ...result.accidentalCorrections.map(c => c.element)]);
 * ```
 */
export class MeiEditor {
  constructor(private readonly meiFriend: MeiFriend) {}

  /**
   * Among notes *before* `noteId` in the same measure and staff that carry a
   * printed `<accid>` at `targetPos`, returns the alter of the most recent one.
   * Returns `undefined` when no such note exists.
   *
   * @param targetPos - The target staff position (IntervalStep from C4).
   * @param noteId    - The `xml:id` of the reference note.
   */
  private findPrecedingAccid(
    targetPos: IntervalStep,
    noteId: string,
  ): IPNAlter | undefined {
    const scoreModel = this.meiFriend.getScoreModel();
    const pos = scoreModel.getPositionById(noteId);
    if (!pos) return undefined;

    const candidates = scoreModel.eventsAtStaffPosition(
      pos.measureIndex,
      pos.staffN,
      targetPos,
    );

    let lastAlter: IPNAlter | undefined;
    let lastOffset: Offset | undefined;

    for (const event of candidates) {
      if (event.offset.compareTo(pos.offset) >= 0) continue;
      const el = this.meiFriend.getElementById(event.id);
      if (!el) continue;
      const note = MeiNote.create(el);
      if (!note?.hasPrintedAccidental) continue;
      const pitch = note.pitch;
      if (!pitch) continue;
      if (!lastOffset || event.offset.compareTo(lastOffset) > 0) {
        lastAlter = IPN.fromPitch(pitch).alter;
        lastOffset = event.offset;
      }
    }
    return lastAlter;
  }

  /**
   * Finds subsequent notes in the same measure and staff that need their
   * accidentals updated after the source note (which had a printed accidental)
   * has been moved away from `oldPos`.
   *
   * Returns corrections in temporal order.  Scanning stops as soon as an
   * independent accidental is encountered — one whose alter differs from the
   * key-signature default — because that note establishes a new accidental
   * context for later notes.
   *
   * @param oldPos - The staff position the source note is leaving (IntervalStep from C4).
   * @param noteId - The `xml:id` of the note being moved.
   * @param key    - The key signature in effect for the source note's staff.
   */
  private findContextualAccidUpdates(
    oldPos: IntervalStep,
    noteId: string,
    key: Key,
  ): AccidentalCorrection[] {
    const scoreModel = this.meiFriend.getScoreModel();
    const pos = scoreModel.getPositionById(noteId);
    if (!pos) return [];

    const keyAlter = key
      .diatonicScalePitch(oldPos)
      .internationalPitchNotation().alter;

    const candidates = scoreModel
      .eventsAtStaffPosition(pos.measureIndex, pos.staffN, oldPos)
      .filter((e) => e.offset.compareTo(pos.offset) > 0);

    const corrections: AccidentalCorrection[] = [];
    for (const event of candidates) {
      const el = this.meiFriend.getElementById(event.id);
      if (!el) continue;
      const note = MeiNote.create(el);
      if (!note) continue;

      if (!note.hasPrintedAccidental) {
        // Was relying on carry-over from the moved note → revert to key sig
        const corrected = this.meiFriend.produceElement(el, (draft) => {
          const accidGes = alterToAccidGes(keyAlter.value);
          if (accidGes) draft.setAttribute("accid.ges", accidGes);
          else draft.removeAttribute("accid.ges");
        });
        corrections.push({ id: event.id, element: corrected });
      } else {
        // Has printed accidental — check if it cancels the moved note's effect
        const pitch = note.pitch;
        if (!pitch) break;
        const intPitch = IPN.fromPitch(pitch);
        if (intPitch.alter.value === keyAlter.value) {
          // Cancellation accidental — now redundant, remove it
          const corrected = this.meiFriend.produceElement(el, (draft) => {
            draft.removeChildrenByTag("accid");
            const accidGes = alterToAccidGes(keyAlter.value);
            if (accidGes) draft.setAttribute("accid.ges", accidGes);
            else draft.removeAttribute("accid.ges");
          });
          corrections.push({ id: event.id, element: corrected });
          break;
        } else {
          // Independent accidental — establishes its own context, stop scanning
          break;
        }
      }
    }

    return corrections;
  }

  private transpose(noteId: string, step: IntervalStep): PitchMoveResult {
    const element = this.meiFriend.getElementById(noteId);
    if (!element) throw new Error(`Element "${noteId}" not found`);
    const note = MeiNote.create(element);
    if (!note) throw new Error(`Element "${noteId}" is not a <note>`);
    const currentPitch = note.pitch;
    if (!currentPitch) throw new Error(`Note "${noteId}" has no pitch`);

    // Staff positions: IntervalStep from C4 (C4=0, D4=1, …, B4=6, C5=7, B3=−1).
    // Incrementing by 1 moves up one diatonic step on the staff.
    const sourcePos = currentPitch.asInterval().step();
    const targetPos = new IntervalStep(sourcePos.value + step.value);

    const scoreModel = this.meiFriend.getScoreModel();
    const staffN = scoreModel.getPositionById(noteId)?.staffN ?? 1;
    const key = scoreModel.getKeyForStaff(staffN);

    const ip = key.diatonicScalePitch(targetPos).internationalPitchNotation();
    const alteredIp = new IPN(
      ip.step,
      this.findPrecedingAccid(targetPos, noteId) ?? ip.alter,
      ip.octave,
    );

    const updatedNote = this.meiFriend.produceElement(
      note,
      MeiNote.applyPitchRecipe(alteredIp),
    );

    // If the moving note had a printed accidental, subsequent notes in the
    // measure may have been relying on its carry-over effect.
    const accidentalCorrections = note.hasPrintedAccidental
      ? this.findContextualAccidUpdates(sourcePos, noteId, key)
      : [];

    // TODO: If a note is tied to the next note, that note also moves.

    return { note: updatedNote, accidentalCorrections };
  }

  /**
   * Returns a `PitchMoveResult` with the pitch raised by one diatonic step
   * (e.g. C→D, E→F, B→C in the octave above).
   *
   * **Pitch of the resulting note**
   *
   * The target staff position is always the next line or space above the
   * current note on the staff. Its accidental — if any — is resolved in this
   * order of priority:
   *
   * 1. **Preceding printed accidental in the same measure.**
   *    All notes that appear *before* this note in the same measure and on the
   *    same staff (every layer is considered) are inspected. Among those that
   *    carry a printed accidental (`<accid>` child element) at the same target
   *    staff position, the pitch of the *last* such note is used.
   *
   * 2. **Active key signature.**
   *    If no such preceding note exists, the accidental is taken from the key
   *    signature currently in effect for the staff (derived from the nearest
   *    `<keySig>` within the staff's `<staffDef>`). For example, raising E4 in
   *    G major (one sharp) produces F♯4, because F is sharp in that key.
   *
   * **No printed accidental on the result.**
   * The returned note never contains a `<accid>` child element, and any
   * `<accid>` child present on the original note is removed. The gestural
   * accidental (`accid.ges`) is updated to reflect the resolved pitch when
   * the note is not natural, and removed otherwise.
   *
   * **Contextual accidental corrections.**
   * If the source note carried a printed accidental (`<accid>` child), notes
   * later in the same measure at the same staff position may have been relying
   * on its carry-over effect. `accidentalCorrections` lists updated versions
   * of those notes:
   * - A note with no `<accid>` child (relying on carry-over) gets its
   *   `accid.ges` reverted to the key-signature default.
   * - A note whose printed accidental equals the key-signature default
   *   (a cancellation that is now redundant) has its `<accid>` child removed.
   * - Scanning stops at the first note with an independent accidental (one
   *   whose alter differs from the key-signature default).
   *
   * @param noteId - The `xml:id` of the `<note>` element to move.
   * @returns A `PitchMoveResult` with the updated note and any contextual corrections.
   * @throws If the element is not found or is not a `<note>` with a pitch.
   */
  pitchUp(noteId: string): PitchMoveResult {
    return this.transpose(noteId, new IntervalStep(1));
  }

  /**
   * Equivalent to {@link pitchUp}, but moves the note down by one diatonic
   * step instead (e.g. D→C, F→E, C→B in the octave below).
   * All pitch-resolution, accidental, and contextual-correction rules are identical.
   *
   * @param noteId - The `xml:id` of the `<note>` element to move.
   * @returns A `PitchMoveResult` with the updated note and any contextual corrections.
   * @throws If the element is not found or is not a `<note>` with a pitch.
   */
  pitchDown(noteId: string): PitchMoveResult {
    return this.transpose(noteId, new IntervalStep(-1));
  }
}
