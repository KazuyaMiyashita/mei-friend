import type { MeiElement } from "../MeiElement.js";
import { Chord, Melody, Note, type Score } from "../models/containers.js";
import { Duration, Part, Rest } from "../models/elements.js";
import { type NoteInfo, TiesIndex } from "../models/score.js";
import { MeiHead } from "./document/MeiHead.js";
import { MeiChord } from "./events/MeiChord.js";
import { MeiNote } from "./events/MeiNote.js";
import { MeiRest } from "./events/MeiRest.js";
import { MeiTie } from "./events/MeiTie.js";
import { MeiMeterSig } from "./metadata/MeiMeterSig.js";
import { MeiScoreDef } from "./metadata/MeiScoreDef.js";
import { MeiStaffDef } from "./metadata/MeiStaffDef.js";
import { MeiTempo } from "./metadata/MeiTempo.js";
import { MeiLayer } from "./structure/MeiLayer.js";
import { MeiMeasure } from "./structure/MeiMeasure.js";
import type { MeiStaff } from "./structure/MeiStaff.js";

/**
 * High-level wrapper for an MEI score, providing extraction and conversion utilities.
 */
export class Mei {
  constructor(public readonly root: MeiElement) {}

  /** Returns the MEI header wrapper. */
  get head(): MeiHead {
    return new MeiHead(this.root);
  }

  /** Returns all <tempo> elements as wrappers. */
  get tempos(): MeiTempo[] {
    return this.root.getElementsByTagName("tempo").map((t) => new MeiTempo(t));
  }

  /** Returns all <staffDef> elements as wrappers. */
  get staffDefs(): MeiStaffDef[] {
    return this.root
      .getElementsByTagName("staffDef")
      .map((s) => new MeiStaffDef(s));
  }

  /** Returns all <measure> elements as wrappers. */
  get measures(): MeiMeasure[] {
    return this.root
      .getElementsByTagName("measure")
      .map((m) => new MeiMeasure(m));
  }

  /** Returns all <tie> elements as wrappers. */
  get ties(): MeiTie[] {
    return this.root.getElementsByTagName("tie").map((t) => new MeiTie(t));
  }

  /** Returns the meter count (beats per measure). */
  get meterCount(): number | undefined {
    const scoreDef = this.root.getElementsByTagName("scoreDef")[0];
    const meterSig = this.root.getElementsByTagName("meterSig")[0];
    const staffDef = this.root.getElementsByTagName("staffDef")[0];

    return (
      (scoreDef ? new MeiScoreDef(scoreDef).meterCount : undefined) ??
      (meterSig ? new MeiMeterSig(meterSig).count : undefined) ??
      (staffDef ? new MeiStaffDef(staffDef).meterCount : undefined)
    );
  }

  /** Returns the meter unit (beat duration). */
  get meterUnit(): number | undefined {
    const scoreDef = this.root.getElementsByTagName("scoreDef")[0];
    const meterSig = this.root.getElementsByTagName("meterSig")[0];
    const staffDef = this.root.getElementsByTagName("staffDef")[0];

    return (
      (scoreDef ? new MeiScoreDef(scoreDef).meterUnit : undefined) ??
      (meterSig ? new MeiMeterSig(meterSig).unit : undefined) ??
      (staffDef ? new MeiStaffDef(staffDef).meterUnit : undefined)
    );
  }

  /** Returns the duration of a full measure. */
  get measureDuration(): Duration | undefined {
    const count = this.meterCount;
    const unit = this.meterUnit;
    if (count === undefined || unit === undefined) return undefined;
    return Duration.of(count * 4, unit);
  }

  /**
   * Converts the MEI structure into a logical Score model.
   */
  public toScore(): Score<NoteInfo> {
    const partMap = new Map<string, Part>();
    for (const sd of this.staffDefs) {
      const n = sd.n;
      const part = sd.getPart();
      if (n && part) {
        partMap.set(n, part);
      }
    }

    const tiesIndex = new TiesIndex(this.ties);
    const measures = this.measures;

    // Collect all staffs and group by @n
    const staffsByPartN = new Map<string, MeiStaff[]>();
    for (const m of measures) {
      for (const s of m.staffs) {
        if (s.n) {
          if (!staffsByPartN.has(s.n)) staffsByPartN.set(s.n, []);
          staffsByPartN.get(s.n)?.push(s);
        }
      }
    }

    const melodies: Score<NoteInfo>[] = [];
    for (const [partN, staffs] of staffsByPartN.entries()) {
      const part = partMap.get(partN) ?? Part.of(partN);
      melodies.push(this.staffsToNotes(staffs, part, tiesIndex));
    }

    if (melodies.length === 0) {
      // Return a minimal empty score if no melodies found
      return new Note<NoteInfo>(
        {
          value: Rest,
          id: this.generateId(),
          isTieStarted: false,
          isTieEnded: false,
        },
        Duration.of(0, 1),
        Part.of("empty"),
      );
    }

    const maxDuration = melodies.reduce(
      (max, m) => (m.duration.compareTo(max) > 0 ? m.duration : max),
      Duration.of(0),
    );

    const adjustedMelodies = melodies.map((m) => {
      if (m.duration.compareTo(maxDuration) < 0) {
        const paddingDuration = maxDuration.sub(m.duration);
        const padding = new Note<NoteInfo>(
          {
            value: Rest,
            id: this.generateId(),
            isTieStarted: false,
            isTieEnded: false,
          },
          paddingDuration,
          m.part,
        );
        return new Melody<NoteInfo>([m, padding]);
      }
      return m;
    });

    if (adjustedMelodies.length === 1) {
      return adjustedMelodies[0];
    }
    return new Chord(new Set(adjustedMelodies));
  }

  private staffsToNotes(
    staffs: MeiStaff[],
    part: Part,
    ties: TiesIndex,
  ): Score<NoteInfo> {
    const measureDur = this.measureDuration ?? Duration.of(4, 4);

    const parseSafe = (
      element: MeiElement,
      currentPart: Part,
    ): Score<NoteInfo>[] => {
      const results: Score<NoteInfo>[] = [];
      for (const child of element.children) {
        switch (child.tagName) {
          case "layer": {
            const l = new MeiLayer(child);
            const subPart =
              l.n === "1" || !l.n ? currentPart : currentPart.spawn(l.n);
            const notes = parseSafe(child, subPart);
            if (notes.length > 0) {
              results.push(new Melody<NoteInfo>(notes));
            } else {
              results.push(
                new Note<NoteInfo>(
                  {
                    value: Rest,
                    id: child.id ?? this.generateId(),
                    isTieStarted: false,
                    isTieEnded: false,
                  },
                  measureDur,
                  subPart,
                ),
              );
            }
            break;
          }
          case "chord": {
            const c = new MeiChord(child);
            const duration = c.duration ?? measureDur;
            const notes = c.notes.flatMap((n, i) => {
              const pitch = n.pitch;
              if (!pitch) return [];
              const subPart =
                i === 0 ? currentPart : currentPart.spawn((i + 1).toString());
              const isTieStarted = ties.hasStartId(n.id ?? "");
              const isTieEnded = ties.hasEndId(n.id ?? "");
              return [
                new Note<NoteInfo>(
                  {
                    value: pitch,
                    id: n.id ?? this.generateId(),
                    isTieStarted,
                    isTieEnded,
                  },
                  duration,
                  subPart,
                ),
              ];
            });
            if (notes.length > 0) {
              results.push(new Chord<NoteInfo>(new Set(notes)));
            } else {
              results.push(
                new Note<NoteInfo>(
                  {
                    value: Rest,
                    id: child.id ?? this.generateId(),
                    isTieStarted: false,
                    isTieEnded: false,
                  },
                  duration,
                  currentPart,
                ),
              );
            }
            break;
          }
          case "note": {
            const n = new MeiNote(child);
            const pitch = n.pitch;
            const duration = n.duration ?? measureDur;
            if (pitch) {
              const isTieStarted = ties.hasStartId(n.id ?? "");
              const isTieEnded = ties.hasEndId(n.id ?? "");
              results.push(
                new Note<NoteInfo>(
                  {
                    value: pitch,
                    id: n.id ?? this.generateId(),
                    isTieStarted,
                    isTieEnded,
                  },
                  duration,
                  currentPart,
                ),
              );
            } else {
              results.push(
                new Note<NoteInfo>(
                  {
                    value: Rest,
                    id: n.id ?? this.generateId(),
                    isTieStarted: false,
                    isTieEnded: false,
                  },
                  duration,
                  currentPart,
                ),
              );
            }
            break;
          }
          case "rest":
          case "mRest":
          case "mSpace": {
            const r = new MeiRest(child, this.measureDuration);
            const duration = r.duration ?? measureDur;
            results.push(
              new Note<NoteInfo>(
                {
                  value: Rest,
                  id: r.id ?? this.generateId(),
                  isTieStarted: false,
                  isTieEnded: false,
                },
                duration,
                currentPart,
              ),
            );
            break;
          }
          default: {
            // Recurse for other containers that might hold music elements
            const subNotes = parseSafe(child, currentPart);
            if (subNotes.length > 0) {
              results.push(new Melody<NoteInfo>(subNotes));
            }
            break;
          }
        }
      }
      return results;
    };

    const scores: Score<NoteInfo>[] = [];
    for (const staff of staffs) {
      const elems = parseSafe(staff.element, part);
      if (elems.length === 0) {
        scores.push(
          new Note<NoteInfo>(
            {
              value: Rest,
              id: staff.element.id ?? this.generateId(),
              isTieStarted: false,
              isTieEnded: false,
            },
            measureDur,
            part,
          ),
        );
      } else {
        const layers = staff.element.children.filter(
          (c) => c.tagName === "layer",
        );
        if (layers.length > 1) {
          scores.push(new Chord<NoteInfo>(new Set(elems)));
        } else {
          scores.push(...elems);
        }
      }
    }
    return new Melody<NoteInfo>(scores);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11);
  }
}
