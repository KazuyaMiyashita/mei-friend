import type { MeiElement } from "../MeiElement.js";
import { MeiNote } from "../mei/events/MeiNote.js";
import { MeiKeySig } from "../mei/score-def/MeiKeySig.js";
import {
  InternationalPitch,
  InternationalPitchAlter,
  InternationalPitchStep,
  Key,
  type Offset,
} from "../models/elements.js";
import type { ScoreModel } from "../models/score.js";

export interface AccidentalCorrection {
  readonly id: string;
  readonly element: MeiElement;
}

export interface PitchMoveResult {
  readonly note: MeiElement;
  readonly accidentalCorrections: ReadonlyArray<AccidentalCorrection>;
}

function alterToAccidGes(alter: number): string | undefined {
  if (alter === 1) return "s";
  if (alter === -1) return "f";
  if (alter === 2) return "ss";
  if (alter === -2) return "ff";
  return undefined;
}

function getKeyAlter(
  targetStep: InternationalPitchStep,
  key: Key,
): InternationalPitchAlter {
  const SHARPS = ["F", "C", "G", "D", "A", "E", "B"];
  const FLATS = ["B", "E", "A", "D", "G", "C", "F"];
  const sigNum = key.signatureNum();
  if (sigNum > 0 && SHARPS.slice(0, sigNum).includes(targetStep.name)) {
    return new InternationalPitchAlter(1);
  }
  if (sigNum < 0 && FLATS.slice(0, -sigNum).includes(targetStep.name)) {
    return new InternationalPitchAlter(-1);
  }
  return new InternationalPitchAlter(0);
}

function getKeyForStaff(
  staffN: number,
  getElementsByTagName: (tag: string) => MeiElement[],
): Key {
  const staffDefs = getElementsByTagName("staffDef");
  for (const sd of staffDefs) {
    if (sd.getAttribute("n") !== String(staffN)) continue;
    const keySigEl = sd.getChildElement("keySig");
    if (keySigEl) {
      const key = MeiKeySig.create(keySigEl)?.toKey();
      if (key) return key;
    }
  }
  return Key.parse("C Major");
}

function findPrecedingAccid(
  targetStep: InternationalPitchStep,
  targetOctave: number,
  noteId: string,
  getElementById: (id: string) => MeiElement | undefined,
  getScoreModel: () => ScoreModel,
): InternationalPitchAlter | undefined {
  const scoreModel = getScoreModel();
  const pos = scoreModel.getPositionById(noteId);
  if (!pos) return undefined;

  const measure = scoreModel.getMeasure(pos.measureIndex);
  if (!measure) return undefined;

  let lastAlter: InternationalPitchAlter | undefined;
  let lastOffset: Offset | undefined;

  for (const [sN, staff] of measure.staves) {
    if (sN !== pos.staffN) continue;
    for (const [, layer] of staff.layers) {
      for (const event of layer.events) {
        if (event.offset.compareTo(pos.offset) >= 0) continue;
        const el = getElementById(event.id);
        if (!el) continue;
        // <accid> 子要素を持つもの（印刷された臨時記号）のみ対象
        if (!el.getChildElement("accid")) continue;
        const note = MeiNote.create(el);
        if (!note?.pitch) continue;
        const intPitch = InternationalPitch.fromPitch(note.pitch);
        if (
          intPitch.step !== targetStep ||
          intPitch.octave.value !== targetOctave
        )
          continue;
        if (!lastOffset || event.offset.compareTo(lastOffset) > 0) {
          lastAlter = intPitch.alter;
          lastOffset = event.offset;
        }
      }
    }
  }
  return lastAlter;
}

function calcTargetStep(
  intPitch: InternationalPitch,
  direction: 1 | -1,
): { step: InternationalPitchStep; octave: number } {
  const steps = InternationalPitchStep.values();
  if (direction === 1) {
    const targetStep = steps[(intPitch.step.ordinal + 1) % 7];
    // B (ordinal 6) → C crosses the octave boundary
    const targetOctave =
      intPitch.step.ordinal === 6
        ? intPitch.octave.value + 1
        : intPitch.octave.value;
    return { step: targetStep, octave: targetOctave };
  }
  const targetStep = steps[(intPitch.step.ordinal + 6) % 7]; // -1 mod 7
  // C (ordinal 0) → B crosses the octave boundary downward
  const targetOctave =
    intPitch.step.ordinal === 0
      ? intPitch.octave.value - 1
      : intPitch.octave.value;
  return { step: targetStep, octave: targetOctave };
}

function applyPitch(
  element: MeiElement,
  step: InternationalPitchStep,
  alter: InternationalPitchAlter,
  octave: number,
): MeiElement {
  const pname = step.name.toLowerCase();
  const oct = String(octave);
  const accidGes = alterToAccidGes(alter.value);

  return element.produce((draft) => {
    draft.setAttribute("pname", pname);
    draft.setAttribute("oct", oct);
    if (accidGes) {
      draft.setAttribute("accid.ges", accidGes);
    } else {
      draft.removeAttribute("accid.ges");
    }
    // Remove any existing <accid> children — moved notes never carry printed accidentals
    const children = draft.toArray();
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      if (
        "nodeName" in child &&
        (child as { nodeName: string }).nodeName === "accid"
      ) {
        draft.delete(i, 1);
      }
    }
  });
}

/**
 * Finds subsequent notes in the same measure and staff that need their
 * accidentals updated after the source note (which had a printed accidental)
 * has been moved away from (oldStep, oldOctave).
 *
 * Returns corrections in temporal order. Scanning stops when an independent
 * accidental is encountered (one whose alter differs from the key-signature
 * default), since it establishes a new accidental context for later notes.
 */
function findContextualAccidUpdates(
  oldStep: InternationalPitchStep,
  oldOctave: number,
  noteId: string,
  getElementById: (id: string) => MeiElement | undefined,
  getScoreModel: () => ScoreModel,
  key: Key,
): AccidentalCorrection[] {
  const scoreModel = getScoreModel();
  const pos = scoreModel.getPositionById(noteId);
  if (!pos) return [];

  const measure = scoreModel.getMeasure(pos.measureIndex);
  if (!measure) return [];

  const keyAlter = getKeyAlter(oldStep, key);

  const candidates: Array<{ offset: Offset; id: string; el: MeiElement }> = [];

  for (const [sN, staff] of measure.staves) {
    if (sN !== pos.staffN) continue;
    for (const [, layer] of staff.layers) {
      for (const event of layer.events) {
        if (event.offset.compareTo(pos.offset) <= 0) continue;
        const el = getElementById(event.id);
        if (!el) continue;
        const note = MeiNote.create(el);
        if (!note?.pitch) continue;
        const intPitch = InternationalPitch.fromPitch(note.pitch);
        if (intPitch.step !== oldStep || intPitch.octave.value !== oldOctave)
          continue;
        candidates.push({ offset: event.offset, id: event.id, el });
      }
    }
  }

  candidates.sort((a, b) => a.offset.compareTo(b.offset));

  const corrections: AccidentalCorrection[] = [];
  for (const { id, el } of candidates) {
    const hasAccidChild = !!el.getChildElement("accid");
    if (!hasAccidChild) {
      // Was relying on carry-over from the moved note → revert to key sig
      const accidGes = alterToAccidGes(keyAlter.value);
      const corrected = el.produce((draft) => {
        if (accidGes) draft.setAttribute("accid.ges", accidGes);
        else draft.removeAttribute("accid.ges");
      });
      corrections.push({ id, element: corrected });
    } else {
      // Has printed accidental — check if it's a cancellation of the moved note's effect
      const note = MeiNote.create(el);
      if (!note?.pitch) break;
      const intPitch = InternationalPitch.fromPitch(note.pitch);
      if (intPitch.alter.value === keyAlter.value) {
        // Cancellation accidental — now redundant, remove it
        const accidGes = alterToAccidGes(keyAlter.value);
        const corrected = el.produce((draft) => {
          const children = draft.toArray();
          for (let i = children.length - 1; i >= 0; i--) {
            const child = children[i];
            if (
              "nodeName" in child &&
              (child as { nodeName: string }).nodeName === "accid"
            ) {
              draft.delete(i, 1);
            }
          }
          if (accidGes) draft.setAttribute("accid.ges", accidGes);
          else draft.removeAttribute("accid.ges");
        });
        corrections.push({ id, element: corrected });
        break;
      } else {
        // Independent accidental — establishes its own context, stop scanning
        break;
      }
    }
  }

  return corrections;
}

/**
 * Provides pitch-editing operations for `<note>` elements.
 *
 * All methods return a **`PitchMoveResult`** — they do not modify the document.
 * Apply the result with:
 * ```ts
 * const result = editor.pitchUp(noteId);
 * meiFriend.update(noteId, result.note.toXmlString());
 * for (const c of result.accidentalCorrections) {
 *   meiFriend.update(c.id, c.element.toXmlString());
 * }
 * ```
 */
export class NoteEditor {
  constructor(
    private readonly getElementById: (id: string) => MeiElement | undefined,
    private readonly getElementsByTagName: (tag: string) => MeiElement[],
    private readonly getScoreModel: () => ScoreModel,
  ) {}

  private transpose(noteId: string, direction: 1 | -1): PitchMoveResult {
    const element = this.getElementById(noteId);
    if (!element) throw new Error(`Element "${noteId}" not found`);
    const note = MeiNote.create(element);
    if (!note) throw new Error(`Element "${noteId}" is not a <note>`);
    const currentPitch = note.pitch;
    if (!currentPitch) throw new Error(`Note "${noteId}" has no pitch`);

    const intPitch = InternationalPitch.fromPitch(currentPitch);
    const hadPrintedAccid = !!element.getChildElement("accid");

    const { step: targetStep, octave: targetOctave } = calcTargetStep(
      intPitch,
      direction,
    );

    const pos = this.getScoreModel().getPositionById(noteId);
    const staffN = pos?.staffN ?? 1;

    const key = getKeyForStaff(staffN, this.getElementsByTagName);
    const defaultAlter = getKeyAlter(targetStep, key);
    const alter =
      findPrecedingAccid(
        targetStep,
        targetOctave,
        noteId,
        this.getElementById,
        this.getScoreModel,
      ) ?? defaultAlter;

    const updatedNote = applyPitch(element, targetStep, alter, targetOctave);

    const accidentalCorrections = hadPrintedAccid
      ? findContextualAccidUpdates(
          intPitch.step,
          intPitch.octave.value,
          noteId,
          this.getElementById,
          this.getScoreModel,
          key,
        )
      : [];

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
   * TODO: Regarding the pitch of the subsequent notes, it might be possible to maintain the initially applied pitch, but what should be done?
   * TODO: The return value contains multiple Elements, and the user would need to perform several
   *       `meiFriend.update` calls on each of them. We want to consolidate this into a single `update` call.
   *       In that case, the return value would be `MeiStaff`.
   * 
   * @param noteId - The `xml:id` of the `<note>` element to move.
   * @returns A `PitchMoveResult` with the updated note and any contextual corrections.
   * @throws If the element is not found or is not a `<note>` with a pitch.
   */
  pitchUp(noteId: string): PitchMoveResult {
    return this.transpose(noteId, 1);
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
    return this.transpose(noteId, -1);
  }
}
