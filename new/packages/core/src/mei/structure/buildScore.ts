import type { MeiElement } from "../../MeiElement.js";
import { Chord, Melody, Note, type Score } from "../../models/containers.js";
import { Duration, Part, Rest } from "../../models/elements.js";
import { type NoteInfo, TiesIndex } from "../../models/score.js";
import { MeiChord } from "../events/MeiChord.js";
import { MeiNote } from "../events/MeiNote.js";
import { MeiRest } from "../events/MeiRest.js";
import { MeiTie } from "../events/MeiTie.js";
import { MeiStaffDef } from "../metadata/MeiStaffDef.js";
import { getGlobalMeter } from "../metadata/meter.js";
import { MeiLayer } from "./MeiLayer.js";
import { MeiMeasure } from "./MeiMeasure.js";
import type { MeiStaff } from "./MeiStaff.js";

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function staffsToNotes(
  root: MeiElement,
  staffs: MeiStaff[],
  part: Part,
  ties: TiesIndex,
): Score<NoteInfo> {
  const globalMeter = getGlobalMeter(root);
  const measureDur = globalMeter
    ? globalMeter.beatType.mul(globalMeter.beats)
    : Duration.of(1); // Default to 4/4 if not found (1 duration = 4 quarters)

  const parseSafe = (
    element: MeiElement,
    currentPart: Part,
  ): Score<NoteInfo>[] => {
    const results: Score<NoteInfo>[] = [];
    for (const child of element.children) {
      switch (child.tagName) {
        case "layer": {
          const l = MeiLayer.create(child);
          if (!l) break;
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
                  id: child.id ?? generateId(),
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
          const c = MeiChord.create(child);
          if (!c) break;
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
                  id: n.id ?? generateId(),
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
                  id: child.id ?? generateId(),
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
          const n = MeiNote.create(child);
          if (!n) break;
          const pitch = n.pitch;
          const duration = n.duration ?? measureDur;
          if (pitch) {
            const isTieStarted = ties.hasStartId(n.id ?? "");
            const isTieEnded = ties.hasEndId(n.id ?? "");
            results.push(
              new Note<NoteInfo>(
                {
                  value: pitch,
                  id: n.id ?? generateId(),
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
                  id: n.id ?? generateId(),
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
          const r = MeiRest.create(child, measureDur);
          if (!r) break;
          const duration = r.duration ?? measureDur;
          results.push(
            new Note<NoteInfo>(
              {
                value: Rest,
                id: r.id ?? generateId(),
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
    const elems = parseSafe(staff, part);
    if (elems.length === 0) {
      scores.push(
        new Note<NoteInfo>(
          {
            value: Rest,
            id: staff.id ?? generateId(),
            isTieStarted: false,
            isTieEnded: false,
          },
          measureDur,
          part,
        ),
      );
    } else {
      const layers = staff.children.filter(
        (c: MeiElement) => c.tagName === "layer",
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

/**
 * Builds a logical Score model from the root MEI element.
 */
export function buildScore(root: MeiElement): Score<NoteInfo> {
  const staffDefs = root
    .getElementsByTagName("staffDef")
    .map((s) => MeiStaffDef.create(s))
    .filter((s): s is MeiStaffDef => !!s);
  const ties = root
    .getElementsByTagName("tie")
    .map((t) => MeiTie.create(t))
    .filter((t): t is MeiTie => !!t);
  const measures = root
    .getElementsByTagName("measure")
    .map((m) => MeiMeasure.create(m))
    .filter((m): m is MeiMeasure => !!m);

  const partMap = new Map<string, Part>();
  for (const sd of staffDefs) {
    const n = sd.n;
    const part = sd.getPart();
    if (n && part) {
      partMap.set(n, part);
    }
  }

  const tiesIndex = new TiesIndex(ties);

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
    melodies.push(staffsToNotes(root, staffs, part, tiesIndex));
  }

  if (melodies.length === 0) {
    // Return a minimal empty score if no melodies found
    return new Note<NoteInfo>(
      {
        value: Rest,
        id: generateId(),
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
          id: generateId(),
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
