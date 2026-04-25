# @mei-friend/core

The core library of the next-generation [*mei-friend*](https://mei-friend.mdw.ac.at) editor — a web-based "last mile" editor for [Music Encoding Initiative (MEI)](https://music-encoding.org) encodings.

This package provides the structured document model that powers bidirectional editing between MEI XML and music notation: you can load an MEI file, edit elements programmatically through a high-level API, navigate the score structure, and serialize the result back to XML. Changes flow in both directions — from notation to code and back — making this library the foundation for building tightly coupled, interactive MEI editors.

[Yjs](https://yjs.dev/) CRDT is used internally to represent the document. This provides built-in undo/redo and — as a bonus — makes real-time collaborative editing available by simply attaching a sync provider to the underlying Yjs document.

## Features

- Load and serialize MEI XML via `MeiFriend.fromXmlString` / `toXmlString`
- High-level document API (`MeiApi`) for metadata, key/meter queries, and score conversion
- Typed wrappers for MEI elements — `MeiNote`, `MeiMeasure`, `MeiKeySig`, etc. — with music-specific properties such as `note.pitch`
- MEI-agnostic music theory models: `Pitch`, `Key`, `Duration`, `Interval`, and more
- Immutable edit pattern via `produceElement` / `updateElement` / `updateBatch`
- Key-aware pitch transposition with automatic accidental resolution (`MeiEditor`)
- Cursor-based score navigation (next/prev event, beat, staff) via `Cursor`
- Structural `ScoreModel` for fast position queries across measures, staves, layers, and events
- Full undo/redo support
- Real-time collaborative editing via any Yjs sync provider

## Note on `xml:id` Handling

`MeiFriend` holds the document as a structured in-memory model rather than as a raw XML string. To maintain a reliable two-way binding between the internal model and any external representation (text editor, renderer, collaboration peer), every element must carry a unique `xml:id`. Any element missing an ID is automatically assigned one when the document is loaded.

As a result, the XML produced by `toXmlString()` may contain more `xml:id` attributes than the original input. The document structure, element order, and all other attributes are preserved exactly; only missing IDs are added.

## Installation

```bash
npm install @mei-friend/core
```

## Quick Start

### 1. Load a document, set the title, and serialize back to XML

```ts
import { MeiFriend } from "@mei-friend/core";

const meiXml = `<?xml version="1.0" encoding="UTF-8"?>
<mei xmlns="http://www.music-encoding.org/ns/mei">
  ...
</mei>`;

const meiFriend = MeiFriend.fromXmlString(meiXml);

// MeiApi provides high-level read/write access to document metadata.
const api = meiFriend.api;

console.log(api.getTitle()); // e.g. "Untitled" or undefined

// api.withTitle() returns a modified clone of the root element.
// Apply it with updateElement to write the change into the document.
meiFriend.updateElement(api.withTitle("Sonata in G Major"));

// Serialize the current state back to MEI XML.
console.log(meiFriend.toXmlString());
```

`MeiApi` also provides meter and key queries used internally by the editor, and converts the document into a `ScoreModel` for structural traversal:

```ts
const meter = api.getMeterAt(0);           // { beats: 4, beatType: Duration } for the first measure
const key   = api.getInitialKeyForStaff(1); // Key | undefined
```

---

### 2. MEI elements and music theory models

Every MEI element retrieved from `MeiFriend` is wrapped in a `MeiElement`. The `mei/` layer defines typed subclasses — one per MEI element — that expose music-specific properties.

```ts
import { MeiNote } from "@mei-friend/core";

// Retrieve an element by xml:id.
const el = meiFriend.getElementById("note-1");

// MeiNote.create() returns undefined if the element is not a <note>.
const note = el ? MeiNote.create(el) : undefined;

if (note) {
  // pitch is a Pitch instance from models/ — MEI-agnostic music theory.
  const pitch = note.pitch;
  console.log(pitch?.toString()); // e.g. "F#4"

  // Pitch exposes step, alter, and octave via International Pitch Notation.
  const ipn = pitch?.internationalPitchNotation();
  console.log(ipn?.step.name, ipn?.alter.value, ipn?.octave.value); // "F"  1  4
}
```

The `models/` layer contains MEI-agnostic primitives for music theory:

```ts
import { Pitch, Key, Duration, Offset } from "@mei-friend/core";

const pitch    = Pitch.parse("Bb3");
const key      = Key.parse("F Major");
const quarter  = Duration.of(1);        // quarter note (quarter note = 1)
const dotted   = Duration.of(3, 2);     // dotted quarter
const offset   = Offset.of(1, 2);       // half a quarter note from the measure start
```

---

### 3. Edit pitches with `MeiEditor`

`MeiEditor` computes pitch changes without touching the document. All editing methods return a list of updated `MeiElement` instances; apply them with `updateBatch` to write all changes as a single atomic transaction.

```ts
import { MeiNote } from "@mei-friend/core";

const el   = meiFriend.getElementById("note-1");
const note = el ? MeiNote.create(el) : undefined;

if (note) {
  const editor = meiFriend.api.editor;

  // pitchUp moves the note up by one diatonic step, respecting the active key signature.
  // Neighbouring notes whose accidentals depended on this note are corrected automatically.
  const result = editor.pitchUp(note.id);

  // result.note and result.accidentalCorrections are all MeiElement instances.
  // Apply them together so the entire change lands in one undo step.
  meiFriend.updateBatch([
    result.note,
    ...result.accidentalCorrections.map((c) => c.element),
  ]);

  // pitchDown is the mirror operation.
  // meiFriend.updateBatch([...editor.pitchDown(note.id)...]);
}
```

**How the target pitch is resolved.** When a note moves to a new staff position, its accidental is determined in this order:

1. The printed accidental of the last preceding note at the same staff position in the same measure.
2. The key signature currently in effect for the staff.

---

### 4. Update the document and react to changes

```ts
// Update a single element (one undo step).
meiFriend.updateElement(updatedElement);

// Update multiple elements atomically (one undo step).
meiFriend.updateBatch([el1, el2, el3]);

// Replace the entire document (e.g. when the user edits the raw XML).
meiFriend.replaceXmlString(newMeiXml);

// Listen to all document changes.
const unsubscribe = meiFriend.onUpdate((events) => {
  for (const event of events) {
    if (event.type === "document-replace") {
      // The entire document was replaced; event.xmlString is the new root <mei>.
      console.log("document replaced:", event.xmlId);
    } else {
      // A single element was updated.
      // event.xmlString contains the new XML for that element — ready to
      // sync with a text editor or renderer.
      console.log("element updated:", event.xmlId, event.isLocal);
    }
  }
});

unsubscribe(); // stop listening
```

The `origin` parameter on each update method is passed through to `onUpdate`, letting you distinguish your own changes from those of other sources (e.g. a remote collaborator or a text editor):

```ts
meiFriend.updateElement(el, "notation-panel");

meiFriend.onUpdate((events) => {
  for (const event of events) {
    if (event.origin === "notation-panel") { /* ... */ }
  }
});
```

---

### 5. ScoreModel, Cursor, and undo/redo

#### `ScoreModel` — score structure and positions

`ScoreModel` is a pre-computed read-only snapshot of the measure/staff/layer/event hierarchy, kept up to date incrementally on every document change.

```ts
const scoreModel = meiFriend.getScoreModel();

// Iterate over all measures, staves, layers, and events.
for (let i = 0; i < scoreModel.length; i++) {
  const measure = scoreModel.getMeasure(i);
  for (const staff of measure?.staves.values() ?? []) {
    for (const layer of staff.layers.values()) {
      for (const event of layer.events) {
        // event.id, event.offset (from measure start), event.duration
      }
    }
  }
}

// Resolve the score position of any element by xml:id.
const pos = scoreModel.getPositionById("note-1");
if (pos && "offset" in pos) {
  console.log(pos.measureIndex, pos.staffN, pos.offset.toString());
}
```

#### `Cursor` — score navigation

`Cursor` is an immutable value that wraps a score position and provides step-by-step navigation. Each method returns a new `Cursor`.

```ts
import { Cursor } from "@mei-friend/core";

const cursor = Cursor.fromId(meiFriend, "note-1");

const next      = cursor?.nextEvent();   // next navigable note/rest/chord
const prev      = cursor?.prevEvent();   // previous navigable event
const nextBeat  = cursor?.nextBeat();    // next beat boundary (meter-aware)
const prevBeat  = cursor?.prevBeat();
const staffUp   = cursor?.staffUp();     // move to the staff above
const staffDown = cursor?.staffDown();

// Read the event at the cursor's current position.
const event = cursor?.getEvent(); // EventModel | undefined
```

#### Undo / Redo

```ts
meiFriend.undo();
meiFriend.redo();

console.log(meiFriend.canUndo); // boolean
console.log(meiFriend.canRedo); // boolean

// Close the current undo step so subsequent edits start a new one.
meiFriend.commitUndoStep();
```

---

## Immutable Edit Pattern

All edits follow the `produceElement` → `updateElement` pattern. `produceElement` creates a modified clone of an element via a recipe function; no change touches the live document until `updateElement` is called.

```ts
// Produce a modified clone without changing the document.
const updated = meiFriend.produceElement(el, (draft) => {
  draft
    .getOrInsertChild("meiHead")
    .getOrInsertChild("fileDesc")
    .getOrInsertChild("titleStmt")
    .getOrInsertChild("title")
    .setTextContent("New Title");
});

// Apply the clone to the live document.
meiFriend.updateElement(updated);
```

You can also provide raw XML for a targeted element update:

```ts
meiFriend.updateXmlString("note-1", `<note xml:id="note-1" pname="g" oct="4" dur="4"/>`);
```

---

## Real-Time Collaboration

Because `MeiFriend` stores its document in a Yjs `Y.Doc`, connecting any Yjs sync provider enables real-time collaboration with no changes to your editing logic.

```ts
import { WebrtcProvider } from "y-webrtc";

const provider = new WebrtcProvider("my-room", meiFriend.yDoc);

meiFriend.onUpdate((events) => {
  for (const event of events) {
    if (!event.isLocal) {
      // Apply a remote change to your renderer or text editor.
    }
  }
});
```

---

## Lifecycle

```ts
meiFriend.destroy(); // destroy the document and release all Yjs resources
```

---

## Architecture

For an in-depth description of the package's layer design, dependency rules, see [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).
