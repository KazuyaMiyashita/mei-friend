/**
 * @vitest-environment jsdom
 */
import { MeiFriend } from "@mei-friend/core";
import { basicSetup, EditorView } from "codemirror";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CodeMirrorPlugin } from "../src/CodeMirrorPlugin.js";

// Helper: return the leading whitespace of the line containing `offset` in `text`
function getLineIndent(text: string, offset: number): string {
  const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
  const match = text.slice(lineStart).match(/^( *)</);
  return match ? match[1] : "";
}

const testXml = `
<mei xmlns="http://www.music-encoding.org/ns/mei">
  <music>
    <body xml:id="b1">
      <staff n="1" xml:id="s1">
        <layer xml:id="l1">
          <note xml:id="n1" pname="c" oct="4" dur="4"/>
          <note xml:id="n2" pname="d" oct="4" dur="4"/>
        </layer>
      </staff>
    </body>
  </music>
</mei>
`.trim();

describe("CodeMirrorPlugin", () => {
  let meiFriend: MeiFriend;

  beforeAll(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
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

  it("should initialize and destroy", () => {
    const plugin = new CodeMirrorPlugin(meiFriend);
    const view = new EditorView({
      doc: meiFriend.toXmlString(),
      extensions: [basicSetup, plugin.extensions],
    });
    expect(plugin.editorView).toBe(view);
    view.destroy();
    plugin.destroy();
  });

  describe("MeiFriend -> CodeMirror sync (Model to Editor)", () => {
    it("should sync attribute changes from model to editor", () => {
      const plugin = new CodeMirrorPlugin(meiFriend);
      const view = new EditorView({
        doc: meiFriend.toXmlString(),
        extensions: [basicSetup, plugin.extensions],
      });

      meiFriend.update("n1", '<note xml:id="n1" pname="e" oct="4" dur="4" />');

      const docText = view.state.doc.toString();
      expect(docText).toContain('pname="e"');
      expect(docText).toContain('xml:id="n1"');
      expect(docText).toContain(
        '<note xml:id="n1" dur="4" oct="4" pname="e"/>',
      );
      view.destroy();
      plugin.destroy();
    });

    it("should sync element additions from model to editor", () => {
      const plugin = new CodeMirrorPlugin(meiFriend);
      const view = new EditorView({
        doc: meiFriend.toXmlString(),
        extensions: [basicSetup, plugin.extensions],
      });

      meiFriend.update(
        "l1",
        '<layer xml:id="l1"><note xml:id="n1" pname="c" oct="4" dur="4" /><note xml:id="n2" pname="d" oct="4" dur="4" /><note xml:id="n3" pname="g" oct="4" dur="4" /></layer>',
      );

      const docText = view.state.doc.toString();
      expect(docText).toContain('xml:id="n3"');
      expect(docText).toContain(
        '<note xml:id="n3" dur="4" oct="4" pname="g"/>',
      );
      view.destroy();
      plugin.destroy();
    });

    it("should sync element removals from model to editor", () => {
      const plugin = new CodeMirrorPlugin(meiFriend);
      const view = new EditorView({
        doc: meiFriend.toXmlString(),
        extensions: [basicSetup, plugin.extensions],
      });

      meiFriend.update(
        "l1",
        '<layer xml:id="l1"><note xml:id="n2" pname="d" oct="4" dur="4" /></layer>',
      );

      const docText = view.state.doc.toString();
      expect(docText).not.toContain('xml:id="n1"');
      expect(docText).toContain('xml:id="n2"');
      expect(docText).toContain('<layer xml:id="l1">');
      view.destroy();
      plugin.destroy();
    });

    it("should maintain cursor position in unrelated parts", () => {
      const plugin = new CodeMirrorPlugin(meiFriend);
      const view = new EditorView({
        doc: meiFriend.toXmlString(),
        extensions: [basicSetup, plugin.extensions],
      });

      const lastPos = view.state.doc.length;
      view.dispatch({ selection: { anchor: lastPos } });

      meiFriend.update("n1", '<note xml:id="n1" pname="f" oct="4" dur="4" />');

      // Cursor should stay near the end
      expect(view.state.selection.main.anchor).toBeGreaterThan(lastPos - 10);
      view.destroy();
      plugin.destroy();
    });
  });

  describe("CodeMirror -> MeiFriend sync via Apply", () => {
    it("should sync attribute changes via apply()", () => {
      const plugin = new CodeMirrorPlugin(meiFriend);
      const view = new EditorView({
        doc: meiFriend.toXmlString(),
        extensions: [basicSetup, plugin.extensions],
      });

      const docText = view.state.doc.toString();
      const pos = docText.indexOf('pname="c"') + 7;

      // Edit the attribute value
      view.dispatch({
        changes: { from: pos, to: pos + 1, insert: "b" },
      });

      expect(plugin.isDirty).toBe(true);
      expect(plugin.state.status).toBe("dirty");

      // Model not updated yet
      expect(meiFriend.getElementById("n1")?.getAttribute("pname")).toBe("c");

      // Apply syncs to model
      const result = plugin.apply();
      expect(result).toBe(true);

      expect(meiFriend.getElementById("n1")?.getAttribute("pname")).toBe("b");
      expect(plugin.isDirty).toBe(false);
      expect(plugin.state.status).toBe("idle");

      view.destroy();
      plugin.destroy();
    });

    it("should sync element structural changes via apply()", () => {
      const plugin = new CodeMirrorPlugin(meiFriend);
      const view = new EditorView({
        doc: meiFriend.toXmlString(),
        extensions: [basicSetup, plugin.extensions],
      });

      const docText = view.state.doc.toString();
      const n2Pos = docText.indexOf('<note xml:id="n2"');

      // Insert a new note before n2
      view.dispatch({
        changes: {
          from: n2Pos,
          to: n2Pos,
          insert: '<note xml:id="n3" pname="a" oct="4"/>\n          ',
        },
      });

      plugin.apply();

      const n3 = meiFriend.getElementById("n3");
      expect(n3).toBeDefined();
      expect(n3?.getAttribute("pname")).toBe("a");

      view.destroy();
      plugin.destroy();
    });

    it("should be dirty but NOT update model when only whitespace is changed", () => {
      const plugin = new CodeMirrorPlugin(meiFriend);
      const view = new EditorView({
        doc: meiFriend.toXmlString(),
        extensions: [basicSetup, plugin.extensions],
      });

      const onUpdateSpy = vi.fn();
      meiFriend.onUpdate(onUpdateSpy);

      const docText = view.state.doc.toString();
      const n1Pos = docText.indexOf('<note xml:id="n1"');

      // Add a space inside the tag (formatting change)
      view.dispatch({
        changes: { from: n1Pos + 5, to: n1Pos + 5, insert: " " },
      });

      // Status is dirty (editor differs from base), but model is NOT updated automatically
      expect(plugin.state.status).toBe("dirty");
      expect(onUpdateSpy).not.toHaveBeenCalled();

      view.destroy();
      plugin.destroy();
    });

    it("should auto-inject xml:id when apply() is called on an element without one", () => {
      const plugin = new CodeMirrorPlugin(meiFriend);
      const view = new EditorView({
        doc: meiFriend.toXmlString(),
        extensions: [basicSetup, plugin.extensions],
      });

      const docText = view.state.doc.toString();
      const n1Pos = docText.indexOf('<note xml:id="n1"');

      // Type a new note without ID before n1
      view.dispatch({
        changes: {
          from: n1Pos,
          to: n1Pos,
          insert: '<note pname="e"/>\n          ',
        },
      });

      expect(plugin.isDirty).toBe(true);

      // Apply: the layer element is dirty (contains changes), MeiFriend assigns IDs
      plugin.apply();

      // The plugin receives the echo from MeiFriend with auto-generated xml:id
      const updatedText = view.state.doc.toString();
      expect(updatedText).toMatch(/<note xml:id="[a-zA-Z0-9-]+" pname="e"\/>/);

      view.destroy();
      plugin.destroy();
    });

    it("should not trigger a feedback loop", () => {
      const plugin = new CodeMirrorPlugin(meiFriend);
      const view = new EditorView({
        doc: meiFriend.toXmlString(),
        extensions: [basicSetup, plugin.extensions],
      });
      const dispatchSpy = vi.spyOn(view, "dispatch");

      // External model change
      meiFriend.update("n1", '<note xml:id="n1" pname="g" oct="4" dur="4" />');

      // At most one dispatch (for the element-level sync)
      const syncDispatches = dispatchSpy.mock.calls.filter(
        ([tr]) => tr && "changes" in tr,
      );
      expect(syncDispatches.length).toBeLessThanOrEqual(1);

      view.destroy();
      plugin.destroy();
    });

    it("apply() should return false for invalid XML", () => {
      const plugin = new CodeMirrorPlugin(meiFriend);
      const view = new EditorView({
        doc: meiFriend.toXmlString(),
        extensions: [basicSetup, plugin.extensions],
      });

      const docText = view.state.doc.toString();
      const n1Pos = docText.indexOf('<note xml:id="n1"');
      const n1End = docText.indexOf('"/>', n1Pos + 20) + 2;

      // Break the element by removing the closing />
      view.dispatch({
        changes: { from: n1End, to: n1End + 1, insert: "" },
      });

      const result = plugin.apply();
      expect(result).toBe(false);
      // Model should NOT be updated
      expect(meiFriend.getElementById("n1")?.getAttribute("pname")).toBe("c");

      view.destroy();
      plugin.destroy();
    });
  });

  describe("Indentation preservation (model → editor sync)", () => {
    it("reindentXml: adds baseIndent to every line except the first", () => {
      const xml = `<layer xml:id="l1">\n  <note xml:id="n1"/>\n  <note xml:id="n2"/>\n</layer>`;
      const result = CodeMirrorPlugin.reindentXml(xml, "        "); // 8 spaces
      const lines = result.split("\n");
      expect(lines[0]).toBe('<layer xml:id="l1">'); // first line unchanged
      expect(lines[1]).toBe('          <note xml:id="n1"/>'); // 8 + 2
      expect(lines[2]).toBe('          <note xml:id="n2"/>'); // 8 + 2
      expect(lines[3]).toBe("        </layer>"); // 8 spaces
    });

    it("reindentXml: returns original string when baseIndent is empty", () => {
      const xml = `<note xml:id="n1"/>`;
      expect(CodeMirrorPlugin.reindentXml(xml, "")).toBe(xml);
    });

    it("preserves indentation level when model adds a child element", () => {
      const plugin = new CodeMirrorPlugin(meiFriend);
      const initialDoc = meiFriend.toXmlString();
      const view = new EditorView({
        doc: initialDoc,
        extensions: [basicSetup, plugin.extensions],
      });

      // Capture base indent of <layer> in the initial document
      const layerOffset = initialDoc.indexOf('<layer xml:id="l1"');
      const expectedLayerIndent = getLineIndent(initialDoc, layerOffset);
      const expectedChildIndent = `${expectedLayerIndent}  `;

      // Add a third note to the layer via model update
      meiFriend.update(
        "l1",
        '<layer xml:id="l1"><note xml:id="n1" pname="c" oct="4" dur="4"/><note xml:id="n2" pname="d" oct="4" dur="4"/><note xml:id="n3" pname="g" oct="4" dur="4"/></layer>',
      );

      const docText = view.state.doc.toString();

      // <layer> opening tag must still start at the correct column
      const layerLineStart =
        docText.lastIndexOf("\n", docText.indexOf('<layer xml:id="l1"') - 1) +
        1;
      const layerActualIndent =
        docText.slice(layerLineStart).match(/^( *)</)?.[1] ?? "";
      expect(layerActualIndent).toBe(expectedLayerIndent);

      // Every <note> inside must be indented at expectedChildIndent
      const noteRegex = /\n( *)<note /g;
      let match: RegExpExecArray | null;
      const noteIndents: string[] = [];
      // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex loop
      while ((match = noteRegex.exec(docText)) !== null) {
        noteIndents.push(match[1]);
      }
      expect(noteIndents.length).toBe(3);
      for (const indent of noteIndents) {
        expect(indent).toBe(expectedChildIndent);
      }

      // Closing </layer> must be at expectedLayerIndent
      const closingMatch = docText.match(/\n( *)<\/layer>/);
      expect(closingMatch?.[1]).toBe(expectedLayerIndent);

      view.destroy();
      plugin.destroy();
    });

    it("preserves indentation when model removes a child element", () => {
      const plugin = new CodeMirrorPlugin(meiFriend);
      const initialDoc = meiFriend.toXmlString();
      const view = new EditorView({
        doc: initialDoc,
        extensions: [basicSetup, plugin.extensions],
      });

      const layerOffset = initialDoc.indexOf('<layer xml:id="l1"');
      const expectedLayerIndent = getLineIndent(initialDoc, layerOffset);
      const expectedChildIndent = `${expectedLayerIndent}  `;

      // Remove n1 from layer
      meiFriend.update(
        "l1",
        '<layer xml:id="l1"><note xml:id="n2" pname="d" oct="4" dur="4"/></layer>',
      );

      const docText = view.state.doc.toString();

      const noteRegex = /\n( *)<note /g;
      let match: RegExpExecArray | null;
      const noteIndents: string[] = [];
      // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex loop
      while ((match = noteRegex.exec(docText)) !== null) {
        noteIndents.push(match[1]);
      }
      expect(noteIndents.length).toBe(1);
      expect(noteIndents[0]).toBe(expectedChildIndent);

      const closingMatch = docText.match(/\n( *)<\/layer>/);
      expect(closingMatch?.[1]).toBe(expectedLayerIndent);

      view.destroy();
      plugin.destroy();
    });
  });

  describe("Utilities", () => {
    it("should jump to and highlight an element", () => {
      const plugin = new CodeMirrorPlugin(meiFriend);
      const view = new EditorView({
        doc: meiFriend.toXmlString(),
        extensions: [basicSetup, plugin.extensions],
      });

      const result = plugin.jumpToElement("n2");
      expect(result).toBe(true);

      const selection = view.state.selection.main;
      const selectedText = view.state.doc.sliceString(
        selection.from,
        selection.to,
      );
      expect(selectedText).toContain('xml:id="n2"');
      view.destroy();
      plugin.destroy();
    });

    it("should return false when jumping to non-existent ID", () => {
      const plugin = new CodeMirrorPlugin(meiFriend);
      const _view = new EditorView({
        doc: meiFriend.toXmlString(),
        extensions: [basicSetup, plugin.extensions],
      });
      const result = plugin.jumpToElement("ghost");
      expect(result).toBe(false);
      plugin.destroy();
    });
  });
});
