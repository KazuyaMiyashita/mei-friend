/**
 * @vitest-environment jsdom
 */

import { MeiFriend } from "@mei-friend/core";
import { basicSetup, EditorView } from "codemirror";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CodeMirrorPlugin } from "../src/CodeMirrorPlugin.js";
import { XmlIdIndexField } from "../src/LezerUtils.js";

describe("CodeMirrorPlugin State Machine", () => {
  let meiFriend: MeiFriend;
  let plugin: CodeMirrorPlugin;
  let view: EditorView;
  const initialXml = `<?xml version="1.0" encoding="UTF-8"?>
<mei xmlns="http://www.music-encoding.org/ns/mei" xml:id="m-1">
  <meiHead xml:id="h-1"/>
  <music xml:id="mu-1">
    <body xml:id="b-1">
      <mdiv xml:id="md-1">
        <score xml:id="s-1">
          <section xml:id="sec-1">
            <measure xml:id="ms-1">
              <staff xml:id="st-1">
                <layer xml:id="l-1">
                  <note xml:id="n-1" dur="4" oct="4" pname="c"/>
                </layer>
              </staff>
            </measure>
          </section>
        </score>
      </mdiv>
    </body>
  </music>
</mei>`;

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    // Polyfill for CodeMirror in jsdom
    if (typeof Range !== "undefined") {
      Range.prototype.getClientRects = vi.fn(
        () =>
          ({
            item: () => null,
            length: 0,
            [Symbol.iterator]: function* () {},
          }) as unknown as DOMRectList,
      );
      Range.prototype.getBoundingClientRect = vi.fn(() => ({
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));
    }

    meiFriend = MeiFriend.fromXmlString(initialXml);
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    plugin = new CodeMirrorPlugin(meiFriend);
    view = new EditorView({
      doc: meiFriend.toXmlString(),
      extensions: [basicSetup, plugin.extensions],
      parent,
    });
  });

  function getElementPos(id: string) {
    const idMap = view.state.field(XmlIdIndexField);
    return idMap.get(id);
  }

  it("should be idle when content matches model", () => {
    expect(plugin.state.status).toBe("idle");
    expect(plugin.isDirty).toBe(false);
  });

  it("should become dirty on any edit and apply transitions back to idle", () => {
    const pos = getElementPos("n-1")!;
    const oldText = view.state.doc.sliceString(pos.from, pos.to);
    const newText = oldText.replace('pname="c"', 'pname="d"');

    view.dispatch({
      changes: { from: pos.from, to: pos.to, insert: newText },
    });

    expect(plugin.state.status).toBe("dirty");
    expect(plugin.isDirty).toBe(true);

    const success = plugin.apply();
    expect(success).toBe(true);

    expect(plugin.state.status).toBe("idle");
    expect(plugin.isDirty).toBe(false);
    const note = meiFriend.getElementById("n-1");
    expect(note?.getAttribute("pname")).toBe("d");
  });

  it("should become invalid on Lezer syntax error, apply() returns false", () => {
    const pos = getElementPos("n-1")!;
    const oldText = view.state.doc.sliceString(pos.from, pos.to);
    // Remove closing /> to create a Lezer syntax error
    const invalidText = oldText.replace("/>", "");

    view.dispatch({
      changes: { from: pos.from, to: pos.to, insert: invalidText },
    });

    expect(plugin.state.status).toBe("invalid");

    // apply() should be blocked
    const result = plugin.apply();
    expect(result).toBe(false);

    // Core model should NOT be updated
    const note = meiFriend.getElementById("n-1");
    expect(note?.getAttribute("pname")).toBe("c");

    // Fix the error
    const fixedText = `${invalidText.replace('pname="c"', 'pname="e"')}/>`;
    view.dispatch({
      changes: {
        from: pos.from,
        to: pos.from + invalidText.length,
        insert: fixedText,
      },
    });

    expect(plugin.state.status).toBe("dirty");
    plugin.apply();
    expect(plugin.state.status).toBe("idle");
    expect(meiFriend.getElementById("n-1")?.getAttribute("pname")).toBe("e");
  });

  it("should auto-generate xml:id when a new element is added and applied", () => {
    const layerPos = getElementPos("l-1")!;

    // Insert a new note without ID inside the layer
    const newNoteText = '\n                  <note dur="8" oct="4" pname="g"/>';
    const insertPos = layerPos.to - 10;

    view.dispatch({
      changes: { from: insertPos, to: insertPos, insert: newNoteText },
    });

    expect(plugin.isDirty).toBe(true);

    // Apply: sends to MeiFriend which assigns xml:id
    const result = plugin.apply();
    expect(result).toBe(true);

    // After apply, editor receives echo with auto-generated xml:id
    const updatedDoc = view.state.doc.toString();
    expect(updatedDoc).toMatch(/xml:id="note-[a-z0-9]+"/);

    const notes = meiFriend.getElementsByTagName("note");
    expect(notes.length).toBe(2);
    expect(notes.some((n) => n.getAttribute("pname") === "g")).toBe(true);
  });

  it("should accept external change when dirty element is updated externally (conflict)", () => {
    const pos = getElementPos("n-1")!;

    // Local edit: change pname to "e" (makes editor dirty)
    const oldText = view.state.doc.sliceString(pos.from, pos.to);
    view.dispatch({
      changes: {
        from: pos.from,
        to: pos.to,
        insert: oldText.replace('pname="c"', 'pname="e"'),
      },
    });

    expect(plugin.isDirty).toBe(true);

    // External update: change pname to "f"
    meiFriend.update(
      "n-1",
      '<note xml:id="n-1" pname="f" oct="4" dur="4" />',
      "external",
    );

    // External change wins; editor shows pname="f"
    const updatedText = view.state.doc.toString();
    expect(updatedText).toContain('pname="f"');
    expect(updatedText).not.toContain('pname="e"');
    expect(plugin.isDirty).toBe(false);
    expect(plugin.state.status).toBe("idle");
  });

  it("should accept external change even when editor is in invalid (broken) state", () => {
    const pos = getElementPos("n-1")!;

    // Local: break the XML of n-1
    view.dispatch({
      changes: { from: pos.to - 2, to: pos.to, insert: ' pname="' },
    });

    expect(plugin.state.status).toBe("invalid");

    // External: change pname to "f"
    meiFriend.update(
      "n-1",
      '<note xml:id="n-1" pname="f" oct="4" dur="4" />',
      "external",
    );

    // Editor should be updated immediately and fix the syntax
    const updatedText = view.state.doc.toString();
    expect(updatedText).toContain('pname="f"');
    expect(plugin.state.status).toBe("idle");
    expect(plugin.isDirty).toBe(false);
  });

  it("should discard dirty edits when an ancestor element is updated externally", () => {
    // Per spec: external update to dirty element OR ITS PARENT discards dirty edits.
    const pos = getElementPos("n-1")!;
    const originalN1Text = view.state.doc.sliceString(pos.from, pos.to);

    const dirtyText = originalN1Text.replace('pname="c"', 'pname="x"');
    view.dispatch({
      changes: { from: pos.from, to: pos.to, insert: dirtyText },
    });
    expect(plugin.isDirty).toBe(true);

    // External: update the parent measure (which contains n-1 as descendant)
    meiFriend.update(
      "ms-1",
      '<measure xml:id="ms-1" n="1"><staff xml:id="st-1"><layer xml:id="l-1"><note xml:id="n-1" dur="4" oct="4" pname="c"/></layer></staff></measure>',
      "external",
    );

    // Ancestor update → dirty edits are discarded, external (model) content wins
    const updatedPos = view.state.field(XmlIdIndexField).get("n-1")!;
    const updatedText = view.state.doc.sliceString(
      updatedPos.from,
      updatedPos.to,
    );
    expect(updatedText).not.toContain('pname="x"');
    expect(plugin.isDirty).toBe(false);
    expect(plugin.state.status).toBe("idle");
  });

  it("should preserve dirty element text when an unrelated sibling is updated externally", () => {
    // Per spec: external update that doesn't change the dirty element preserves it.
    const _noteXml = `<note xml:id="n-1" dur="4" oct="4" pname="c"/>`;
    const meiFriendWithSibling = MeiFriend.fromXmlString(
      initialXml.replace(
        '<note xml:id="n-1" dur="4" oct="4" pname="c"/>',
        '<note xml:id="n-1" dur="4" oct="4" pname="c"/>\n                  <note xml:id="n-2" dur="8" oct="5" pname="g"/>',
      ),
    );
    // Rebuild with sibling
    const localPlugin = new CodeMirrorPlugin(meiFriendWithSibling);
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const localView = new EditorView({
      doc: meiFriendWithSibling.toXmlString(),
      extensions: [basicSetup, localPlugin.extensions],
      parent,
    });

    const idMap = localView.state.field(XmlIdIndexField);
    const n1Pos = idMap.get("n-1")!;
    const n1Text = localView.state.doc.sliceString(n1Pos.from, n1Pos.to);

    // Make n-1 dirty
    const dirtyN1 = n1Text.replace('pname="c"', 'pname="x"');
    localView.dispatch({
      changes: { from: n1Pos.from, to: n1Pos.to, insert: dirtyN1 },
    });
    expect(localPlugin.isDirty).toBe(true);

    // External update to sibling n-2 only
    meiFriendWithSibling.update(
      "n-2",
      '<note xml:id="n-2" dur="8" oct="5" pname="f"/>',
      "external",
    );

    // n-1 dirty text should be preserved
    const updatedIdMap = localView.state.field(XmlIdIndexField);
    const newN1Pos = updatedIdMap.get("n-1")!;
    const newN1Text = localView.state.doc.sliceString(
      newN1Pos.from,
      newN1Pos.to,
    );
    expect(newN1Text).toContain('pname="x"');
    expect(localPlugin.isDirty).toBe(true);

    // n-2 should reflect external update
    const newN2Pos = updatedIdMap.get("n-2")!;
    const newN2Text = localView.state.doc.sliceString(
      newN2Pos.from,
      newN2Pos.to,
    );
    expect(newN2Text).toContain('pname="f"');

    localView.destroy();
    localPlugin.destroy();
  });

  it("should not be dirty after refresh()", () => {
    const pos = getElementPos("n-1")!;
    const oldText = view.state.doc.sliceString(pos.from, pos.to);
    view.dispatch({
      changes: {
        from: pos.from,
        to: pos.to,
        insert: oldText.replace('pname="c"', 'pname="e"'),
      },
    });

    expect(plugin.isDirty).toBe(true);

    plugin.refresh();

    expect(plugin.isDirty).toBe(false);
    expect(plugin.state.status).toBe("idle");
    // Model unchanged (refresh only overwrites editor with model content)
    expect(meiFriend.getElementById("n-1")?.getAttribute("pname")).toBe("c");
  });
});
