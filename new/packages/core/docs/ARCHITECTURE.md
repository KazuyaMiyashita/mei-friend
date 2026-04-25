# @mei-friend/core — Architecture

## Overview

This document describes the intended architecture of `packages/core`.
It serves as a guide for reading the code and records the rationale behind key design decisions.

---

## Directory Structure and Layer Design

```
src/
├── MeiFriend.ts          # Document state management (Yjs CRDT)
├── MeiElement.ts         # Read-only XML wrapper
├── MeiDraft.ts           # Writable wrapper used inside produceElement recipes
├── MeiUpdateEvent.ts     # Types for document update events
├── utils/
│   ├── IdGenerator.ts    # xml:id generation
│   └── XmlSerde.ts       # XML ↔ Yjs serialization
├── models/               # Music theory and score structure models (MEI-agnostic)
│   ├── pitch.ts          # Pitch, PitchNoteName, PitchOctave, PitchNumber, IPN, IPNStep, IPNAlter, IPNOctave
│   ├── interval.ts       # Interval, IntervalStep, IntervalAlter, IntervalNumber
│   ├── key.ts            # Key, Mode, Degree, DegreeStep, DegreeAlter
│   ├── time.ts           # Duration, Offset, Span, Scope
│   ├── part.ts           # Part
│   ├── score.ts          # ScoreModel, AnyPosition, Position, MeasureModel, StaffModel, LayerModel, EventModel, ScorePositionIterator
│   ├── math.ts           # Rational (rational number arithmetic)
│   └── index.ts
├── mei/                  # MEI-element knowledge (references models/)
│   ├── attributes/       # Attribute value knowledge shared across multiple MEI elements
│   │   └── accid.ts      # data.ACCIDENTAL.WRITTEN / GESTURAL mappings
│   ├── elements/         # MEI element classes (one file per class)
│   │   ├── Mei.ts        # <mei> wrapper
│   │   ├── header/
│   │   │   ├── MeiHead.ts
│   │   │   ├── MeiFileDesc.ts
│   │   │   ├── MeiTitleStmt.ts
│   │   │   └── MeiTitle.ts
│   │   ├── score-def/
│   │   │   ├── MeiScoreDef.ts
│   │   │   ├── MeiStaffDef.ts
│   │   │   ├── MeiMeterSig.ts
│   │   │   └── MeiKeySig.ts
│   │   ├── structure/
│   │   │   ├── MeiMeasure.ts
│   │   │   ├── MeiStaff.ts
│   │   │   └── MeiLayer.ts
│   │   └── events/
│   │       ├── MeiNote.ts
│   │       ├── MeiChord.ts
│   │       ├── MeiRest.ts
│   │       ├── MeiMRest.ts
│   │       ├── MeiAccid.ts
│   │       ├── MeiTuplet.ts
│   │       ├── MeiTie.ts
│   │       └── MeiTempo.ts
│   ├── utils/            # Utility functions spanning multiple MEI element classes
│   │   ├── buildScoreModel.ts  # MEI → ScoreModel conversion (incremental update support)
│   │   ├── navigable.ts        # Determines whether a given element is a navigable event
│   │   ├── meter.ts            # Meter retrieval utilities
│   │   └── duration.ts         # Duration retrieval utilities (tuplet-aware)
│   └── index.ts          # Re-exports everything from attributes/, elements/, utils/
├── api/
│   ├── MeiApi.ts               # High-level queries and metadata editing
│   ├── Cursor.ts               # Navigates positions within the score
│   ├── index.ts
│   └── editor/
│       └── MeiEditor.ts        # Score editing operations (pitchUp, pitchDown, etc.)
└── index.ts
```

---

## Layer Dependency Direction

| Layer | May depend on | Notes |
|---|---|---|
| `models/` | nothing | |
| `MeiElement`, `MeiDraft` | nothing (Yjs only) | |
| `mei/` | `models/`, `MeiElement`, `MeiDraft` | Must not depend on `MeiFriend` |
| `MeiFriend` | `MeiElement`, `MeiDraft`, `models/`, `mei/` | Mutual reference with `api/`; provides accessors into `api/` |
| `api/` | all of the above | Mutual reference with `MeiFriend` |

---

## Layer Design Policies

### `models/` — Music Theory and Score Structure

**Contains no MEI knowledge.** Everything here is expressed as general music theory and score structure.

- `pitch.ts`, `interval.ts`, `key.ts`, `time.ts`, `part.ts` — domain primitives.
  MEI attribute names such as `pname`, `oct`, and `dur` do not appear here.
- `score.ts` — structural model of measures, staves, layers, and events.
  - Each model retains the `xml:id` of its corresponding MEI element, enabling access to the element via `mei/` classes.
  - The premise is that this structure *happens to align* with MEI's structure. Any correspondence to MEI elements is noted only in comments.
  - `ScoreModel` is a read-only snapshot of the computed score structure.
  - **Full event mapping**: every MEI element inside `<layer>` is recorded as an `EventModel`. Elements with no intrinsic duration (e.g. `keySig`) are recorded with `duration: 0`.
  - **Fast position resolution**: an `idIndex` map allows O(1) resolution from `xml:id` to `AnyPosition`.
  - **`ScorePositionIterator`**: iterates events forward or backward from a given `Position`, crossing measure boundaries and optionally spanning an entire staff.

**What `models/` should and should not store**

Pre-computable structural information (offsets, hierarchy) is embedded at build time in `ScoreModel`.
Global-context-dependent information — time signatures (`Meter`) and key signatures (`Key`) — is *not* stored per `MeasureModel`. It is computed dynamically via the `api/` layer (`MeiApi`) or managed as a global map.

### `mei/` — MEI Element Knowledge

- **One file per class** is the rule. Utilities that span multiple elements are the only exception, placed in `utils/`.
- All classes extend `MeiElement` and follow the uniform `static create(element: MeiElement): T | undefined` factory pattern.
- **Attribute and element name knowledge is centralised here.**
  Direct DOM queries such as `getElementsByTagName("note")` or `getAttribute("pname")` must not appear outside `mei/` classes (i.e. not in `api/` or `MeiFriend.ts`).
  All element access must go through the corresponding class's methods or getters.
- Recipe patterns (e.g. `MeiNote.applyPitchRecipe`) are defined as static methods on `mei/` classes and called from `api/`.

| Directory | Contents | Placement criteria |
|---|---|---|
| `mei/attributes/` | MEI data type mappings (`data.ACCIDENTAL.WRITTEN`, etc.) | Attribute knowledge referenced by multiple element classes |
| `mei/elements/` | Read-only wrapper classes for MEI elements | One file per class; attribute knowledge relevant only to a single element stays inside the class |
| `mei/utils/` | Functions spanning multiple element classes | Cross-cutting logic that does not belong inside a single element class (converters, query helpers, etc.) |

### `api/` — High-Level Operations

- `MeiApi.ts` — queries and reading/writing metadata.
- `Cursor.ts` — navigation over the score structure. References `MeiFriend` and uses `isNavigable` from `mei/utils/navigable.ts` to determine which events can be navigated to.
- `MeiEditor.ts` — score editing.

### `MeiFriend.ts` — State Management

- Manages the Yjs CRDT document, the ID index, and undo/redo.
- **Incremental ScoreModel updates**: on each document change (`onUpdate`), only the affected `MeasureModel`(s) are rebuilt starting from the changed `xmlId`, and `ScoreModel` is updated immutably (reconciliation). A full rebuild is triggered only when the entire document is replaced (`replaceXmlString`).
- **`produceElement(elem, recipe)` pattern**: clones the target element, applies the recipe function to the clone, and returns the modified `MeiElement`. The caller applies it via `updateElement(...)`.

### `MeiDraft.ts` — Writable Wrapper

- A mutable wrapper used exclusively inside `produceElement` recipe functions.
- `MeiDraft` does not extend `MeiElement`. Defining a shared interface (e.g. `IMeiNode`) so that `mei/` recipe methods can accept either a `MeiDraft` or a `MeiElement` remains an open design question.

