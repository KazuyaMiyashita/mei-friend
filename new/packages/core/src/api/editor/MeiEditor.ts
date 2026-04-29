import type { MeiElement } from "../../MeiElement.js";
import type { MeiFriend } from "../../MeiFriend.js";
import { MeiNote } from "../../mei/elements/events/MeiNote.js";
import {
  Interval,
  IntervalNumber,
  IntervalStep,
  IPN,
  IPNAlter,
  IPNStep,
  Key,
  Octave,
  type Offset,
  Pitch,
} from "../../models/index.js";
import type { EventModel } from "../../models/score.js";
import type { MeiApi } from "../MeiApi.js";

/**
 * Provides pitch-editing operations for `<note>` elements.
 *
 * All methods return an array of `MeiElement`s — they do not modify the document.
 * The returned array contains the moved note and any notes that required
 * contextual accidental corrections.
 * Apply the result with:
 * ```ts
 * const elements = editor.pitchUp(noteId);
 * meiFriend.updateBatch(elements);
 * ```
 */
export class MeiEditor {
  constructor(
    private readonly meiFriend: MeiFriend,
    private readonly meiApi: MeiApi,
  ) {}

  /**
   * Returns all events in the specified measure and staff whose diatonic staff
   * position equals `targetPos`, sorted by offset ascending.
   */
  private eventsAtPosition(
    measureIndex: number,
    staffN: number,
    targetPos: IntervalStep,
  ): EventModel[] {
    const measure = this.meiFriend.getScoreModel().getMeasure(measureIndex);
    const result: EventModel[] = [];
    for (const layer of measure?.staves.get(staffN)?.layers.values() ?? []) {
      for (const event of layer.events) {
        const el = this.meiFriend.getElementById(event.id);
        if (!el) continue;
        const pos = MeiNote.create(el)?.pitch?.asInterval().step();
        if (pos?.value === targetPos.value) result.push(event);
      }
    }
    result.sort((a, b) => a.offset.compareTo(b.offset));
    return result;
  }

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
    if (!pos || !("staffN" in pos) || !("offset" in pos)) return undefined;

    const candidates = this.eventsAtPosition(
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
   * Finds the immediately following note in the same measure and staff that
   * may need an accidental added after the source note (which had a printed
   * accidental) has been moved away from `oldPos`.
   *
   * Only the immediately following note at `oldPos` is checked. If it has no
   * printed accidental, and its current pitch differs from the key-signature
   * default, a printed accidental is added to it to preserve its musical pitch.
   *
   * @param oldPos - The staff position the source note is leaving (IntervalStep from C4).
   * @param key    - The key signature in effect for the source note's staff.
   * @param pos    - The position of the note being moved.
   */
  private findContextualAccidUpdates(
    oldPos: IntervalStep,
    key: Key,
    pos: { measureIndex: number; staffN: number; offset: Offset },
  ): MeiElement[] {
    const keyAlter = key
      .diatonicScalePitch(oldPos)
      .internationalPitchNotation().alter;

    const candidates = this.eventsAtPosition(
      pos.measureIndex,
      pos.staffN,
      oldPos,
    ).filter((e) => e.offset.compareTo(pos.offset) > 0);

    if (candidates.length === 0) return [];

    const event = candidates[0];
    const el = this.meiFriend.getElementById(event.id);
    if (!el) return [];
    const note = MeiNote.create(el);
    if (!note || note.hasPrintedAccidental) return [];

    const pitch = note.pitch;
    if (!pitch) return [];
    const ipn = IPN.fromPitch(pitch);

    if (ipn.alter.value !== keyAlter.value) {
      // Needs a printed accidental to maintain its pitch
      const corrected = this.meiFriend.produceElement(
        el,
        MeiNote.applyPitchRecipe(ipn, ipn.alter),
      );
      return [corrected];
    }

    return [];
  }

  private transpose(noteId: string, step: IntervalStep): MeiElement[] {
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
    const pos = scoreModel.getPositionById(noteId);
    const key =
      pos && "offset" in pos
        ? this.meiApi.getKeyAt(pos)
        : (this.meiApi.getInitialKeyForStaff(1) ?? Key.parse("C Major"));

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
    const accidentalCorrections =
      note.hasPrintedAccidental && pos && "staffN" in pos && "offset" in pos
        ? this.findContextualAccidUpdates(sourcePos, key, {
            measureIndex: pos.measureIndex,
            staffN: pos.staffN,
            offset: pos.offset,
          })
        : [];

    // TODO: If a note is tied to the next note, that note also moves.

    return [updatedNote, ...accidentalCorrections];
  }

  private transposeByInterval(
    noteId: string,
    interval: Interval,
  ): MeiElement[] {
    const element = this.meiFriend.getElementById(noteId);
    if (!element) throw new Error(`Element "${noteId}" not found`);
    const note = MeiNote.create(element);
    if (!note) throw new Error(`Element "${noteId}" is not a <note>`);
    const currentPitch = note.pitch;
    if (!currentPitch) throw new Error(`Note "${noteId}" has no pitch`);

    // Staff positions: IntervalStep from C4 (C4=0, D4=1, …, B4=6, C5=7, B3=−1).
    const sourcePos = currentPitch.asInterval().step();
    const targetPitch = currentPitch.add(interval);
    const targetPos = targetPitch.asInterval().step();
    const targetIpn = targetPitch.internationalPitchNotation();

    const scoreModel = this.meiFriend.getScoreModel();
    const pos = scoreModel.getPositionById(noteId);
    const key =
      pos && "offset" in pos
        ? this.meiApi.getKeyAt(pos)
        : (this.meiApi.getInitialKeyForStaff(1) ?? Key.parse("C Major"));

    const precedingAlter = this.findPrecedingAccid(targetPos, noteId);
    const expectedAlter =
      precedingAlter ??
      key.diatonicScalePitch(targetPos).internationalPitchNotation().alter;

    const needsPrintedAccid = targetIpn.alter.value !== expectedAlter.value;

    const updatedNote = this.meiFriend.produceElement(
      note,
      MeiNote.applyPitchRecipe(
        targetIpn,
        needsPrintedAccid ? targetIpn.alter : undefined,
      ),
    );

    // If the moving note had a printed accidental, subsequent notes in the
    // measure may have been relying on its carry-over effect.
    const accidentalCorrections =
      note.hasPrintedAccidental && pos && "staffN" in pos && "offset" in pos
        ? this.findContextualAccidUpdates(sourcePos, key, {
            measureIndex: pos.measureIndex,
            staffN: pos.staffN,
            offset: pos.offset,
          })
        : [];

    return [updatedNote, ...accidentalCorrections];
  }

  private transposeChromatic(
    noteId: string,
    direction: "up" | "down",
  ): MeiElement[] {
    const element = this.meiFriend.getElementById(noteId);
    if (!element) throw new Error(`Element "${noteId}" not found`);
    const note = MeiNote.create(element);
    if (!note) throw new Error(`Element "${noteId}" is not a <note>`);
    const currentPitch = note.pitch;
    if (!currentPitch) throw new Error(`Note "${noteId}" has no pitch`);

    const sourcePos = currentPitch.asInterval().step();

    // 1. Calculate target PitchNumber
    const stepVal = direction === "up" ? 1 : -1;
    const targetNum = currentPitch.num().add(new IntervalNumber(stepVal));

    // 2. Generate candidates with alter in [-1, 0, 1]
    const candidates: Pitch[] = [];
    for (const step of IPNStep.values()) {
      for (const alterVal of [-1, 0, 1]) {
        const noteName = IPN.toNoteName(step, new IPNAlter(alterVal));
        const remainder = targetNum.value - noteName.value * 7;
        if (remainder % 12 === 0) {
          const octaveVal = remainder / 12;
          candidates.push(new Pitch(new Octave(octaveVal), noteName));
        }
      }
    }

    if (candidates.length === 0) {
      throw new Error(
        `Could not find a valid enharmonic spelling for PitchNumber ${targetNum.value}`,
      );
    }

    // 3. Select the best candidate based on rules
    const scoreModel = this.meiFriend.getScoreModel();
    const pos = scoreModel.getPositionById(noteId);
    const key =
      pos && "offset" in pos
        ? this.meiApi.getKeyAt(pos)
        : (this.meiApi.getInitialKeyForStaff(1) ?? Key.parse("C Major"));

    const diatonicNoteNameValues = new Set(
      Array.from(
        { length: 7 },
        (_, i) =>
          Key.calculateScalePitch(key.tonic.value, key.mode.offset, i).fifth,
      ),
    );

    let targetPitch: Pitch | undefined;

    // Priority 1: Diatonic in key
    targetPitch = candidates.find((p) =>
      diatonicNoteNameValues.has(p.noteName.value),
    );

    // Priority 2: Natural
    if (!targetPitch) {
      targetPitch = candidates.find((p) => IPN.fromPitch(p).alter.value === 0);
    }

    // Priority 3: Sharp for UP, Flat for DOWN
    if (!targetPitch) {
      const preferredAlter = direction === "up" ? 1 : -1;
      targetPitch = candidates.find(
        (p) => IPN.fromPitch(p).alter.value === preferredAlter,
      );
    }

    // Fallback: Just take the first one
    if (!targetPitch) {
      targetPitch = candidates[0];
    }

    const targetPos = targetPitch.asInterval().step();
    const targetIpn = targetPitch.internationalPitchNotation();

    const precedingAlter = this.findPrecedingAccid(targetPos, noteId);
    const expectedAlter =
      precedingAlter ??
      key.diatonicScalePitch(targetPos).internationalPitchNotation().alter;

    const needsPrintedAccid = targetIpn.alter.value !== expectedAlter.value;

    const updatedNote = this.meiFriend.produceElement(
      note,
      MeiNote.applyPitchRecipe(
        targetIpn,
        needsPrintedAccid ? targetIpn.alter : undefined,
      ),
    );

    const accidentalCorrections =
      note.hasPrintedAccidental && pos && "staffN" in pos && "offset" in pos
        ? this.findContextualAccidUpdates(sourcePos, key, {
            measureIndex: pos.measureIndex,
            staffN: pos.staffN,
            offset: pos.offset,
          })
        : [];

    return [updatedNote, ...accidentalCorrections];
  }

  /**
   * Returns an array of `MeiElement`s with the pitch raised by one diatonic step
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
   * Following these rules, the resulting note contains no printed accidental.
   *
   * Contextual accidental corrections:
   * Only the moving note's pitch is modified. However, if the moving note had a printed
   * accidental, the immediately following note at the same staff position in the measure
   * may require a new accidental to be added. This correction is handled automatically.
   *
   * @param noteId - The `xml:id` of the `<note>` element to move.
   * @returns An array of updated `MeiElement`s, including the moved note and any contextual corrections.
   * @throws If the element is not found or is not a `<note>` with a pitch.
   */
  pitchUp(noteId: string): MeiElement[] {
    return this.transpose(noteId, new IntervalStep(1));
  }

  /**
   * Equivalent to {@link pitchUp}, but moves the note down by one diatonic
   * step instead (e.g. D→C, F→E, C→B in the octave below).
   * All pitch-resolution, accidental, and contextual-correction rules are identical.
   *
   * @param noteId - The `xml:id` of the `<note>` element to move.
   * @returns An array of updated `MeiElement`s, including the moved note and any contextual corrections.
   * @throws If the element is not found or is not a `<note>` with a pitch.
   */
  pitchDown(noteId: string): MeiElement[] {
    return this.transpose(noteId, new IntervalStep(-1));
  }

  /**
   * Returns an array of `MeiElement`s with the pitch raised by one octave
   * (Perfect 8th).
   *
   * Unlike {@link pitchUp}, this operation preserves the original pitch's
   * accidental alteration (e.g., C#4 → C#5). A printed accidental is added
   * or removed as necessary based on the key signature and preceding notes
   * at the target staff position.
   *
   * Contextual accidental corrections for subsequent notes are handled
   * identically to {@link pitchUp}.
   *
   * @param noteId - The `xml:id` of the `<note>` element to move.
   * @returns An array of updated `MeiElement`s, including the moved note and any contextual corrections.
   * @throws If the element is not found or is not a `<note>` with a pitch.
   */
  pitchOctaveUp(noteId: string): MeiElement[] {
    return this.transposeByInterval(noteId, Interval.P8);
  }

  /**
   * Equivalent to {@link pitchOctaveUp}, but moves the note down by one octave
   * (e.g., C#4 → C#3).
   *
   * @param noteId - The `xml:id` of the `<note>` element to move.
   * @returns An array of updated `MeiElement`s, including the moved note and any contextual corrections.
   * @throws If the element is not found or is not a `<note>` with a pitch.
   */
  pitchOctaveDown(noteId: string): MeiElement[] {
    return this.transposeByInterval(noteId, Interval.P8.abs().mul(-1));
  }

  /**
   * Returns an array of `MeiElement`s with the pitch raised chromatically
   * (by one semitone).
   *
   * Enharmonic spelling is chosen based on:
   * 1. The pitch being in the current key signature.
   * 2. The pitch being natural (no accidental).
   * 3. The pitch being sharp (since we are raising the pitch).
   *
   * @param noteId - The `xml:id` of the `<note>` element to move.
   * @returns An array of updated `MeiElement`s, including the moved note and any contextual corrections.
   * @throws If the element is not found or is not a `<note>` with a pitch.
   */
  pitchChromaticUp(noteId: string): MeiElement[] {
    return this.transposeChromatic(noteId, "up");
  }

  /**
   * Equivalent to {@link pitchChromaticUp}, but lowers the pitch chromatically
   * (by one semitone).
   *
   * Enharmonic spelling prioritizes flat accidentals as a fallback instead of sharp.
   *
   * @param noteId - The `xml:id` of the `<note>` element to move.
   * @returns An array of updated `MeiElement`s, including the moved note and any contextual corrections.
   * @throws If the element is not found or is not a `<note>` with a pitch.
   */
  pitchChromaticDown(noteId: string): MeiElement[] {
    return this.transposeChromatic(noteId, "down");
  }
}
