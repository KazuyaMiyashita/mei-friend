/**
 * @vitest-environment jsdom
 */

import { undo } from "@codemirror/commands";

import { MeiFriend } from "@mei-friend/core";
import { basicSetup, EditorView } from "codemirror";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CodeMirrorPlugin } from "../src/CodeMirrorPlugin.js";

const testXml = `
<mei xmlns="http://www.music-encoding.org/ns/mei">
  <music>
    <body xml:id="b1">
      <staff n="1" xml:id="s1">
        <layer xml:id="l1">
          <note xml:id="n1" pname="c" oct="4" dur="4"/>
        </layer>
      </staff>
    </body>
  </music>
</mei>
`.trim();

describe("Undo/Redo after Apply", () => {
  let meiFriend: MeiFriend;

  beforeAll(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    // Mock Range methods missing in jsdom
    if (typeof Range !== "undefined") {
      Range.prototype.getBoundingClientRect = () => ({
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
        x: 0,
        y: 0,
        toJSON: () => {},
      });
      Range.prototype.getClientRects = () =>
        ({
          length: 0,
          item: () => null,
          [Symbol.iterator]: function* () {},
        }) as unknown as DOMRectList;
    }
  });

  beforeEach(() => {
    meiFriend = MeiFriend.fromXmlString(testXml);
  });

  it("should be able to undo after apply()", () => {
    const plugin = new CodeMirrorPlugin(meiFriend);
    const view = new EditorView({
      doc: meiFriend.toXmlString(),
      extensions: [basicSetup, plugin.extensions],
    });

    const initialDoc = view.state.doc.toString();
    const noteStart = initialDoc.indexOf("<note ");
    const noteEnd = initialDoc.indexOf("/>", noteStart) + 2;

    // 1. User edit: Reorder attributes and change pname
    // Initial: <note xml:id="n1" pname="c" oct="4" dur="4"/>
    view.dispatch({
      changes: {
        from: noteStart,
        to: noteEnd,
        insert: '<note pname="d" oct="4" dur="4" xml:id="n1"/>',
      },
    });
    const afterEditDoc = view.state.doc.toString();
    expect(afterEditDoc).toContain('pname="d" oct="4" dur="4" xml:id="n1"');

    // 2. Apply changes
    const applySuccess = plugin.apply();
    expect(applySuccess).toBe(true);
    const afterApplyDoc = view.state.doc.toString();

    // MeiFriend reorders attributes to alphabetical (after xml:id)
    expect(afterApplyDoc).toContain('xml:id="n1" dur="4" oct="4" pname="d"');
    expect(afterApplyDoc).not.toBe(afterEditDoc);

    // The model should be updated
    expect(meiFriend.getElementById("n1")?.getAttribute("pname")).toBe("d");

    // 3. Undo
    // Now that we've removed addToHistory(false), the Apply echo is recorded.
    // CodeMirror might group it with the preceding edit if it happens quickly.
    undo(view);
    const afterUndoDoc = view.state.doc.toString();

    if (afterUndoDoc !== initialDoc) {
      expect(afterUndoDoc).toBe(afterEditDoc);
      undo(view);
      expect(view.state.doc.toString()).toBe(initialDoc);
    }

    view.destroy();
    plugin.destroy();
  });

  it("should be able to undo after refresh()", () => {
    const plugin = new CodeMirrorPlugin(meiFriend);
    const view = new EditorView({
      doc: meiFriend.toXmlString(),
      extensions: [basicSetup, plugin.extensions],
    });

    const initialDoc = view.state.doc.toString();

    // 1. User edit
    view.dispatch({
      changes: { from: 0, to: 0, insert: "<!-- User Edit -->\n" },
    });
    const afterEditDoc = view.state.doc.toString();

    // 2. Refresh (overwrites user edit with model content)
    plugin.refresh();
    const afterRefreshDoc = view.state.doc.toString();
    expect(afterRefreshDoc).not.toBe(afterEditDoc);
    // Refresh might have added declaration if it was missing, but Semantic content should be the same as initial
    expect(afterRefreshDoc).toContain("<mei");

    // 3. Undo
    undo(view);
    const afterUndo = view.state.doc.toString();
    if (afterUndo !== initialDoc) {
      expect(afterUndo).toBe(afterEditDoc);
      undo(view);
      expect(view.state.doc.toString()).toBe(initialDoc);
    }

    view.destroy();
    plugin.destroy();
  });
});
