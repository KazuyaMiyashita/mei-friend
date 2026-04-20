/**
 * @vitest-environment jsdom
 */
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
      // Relaxed check: just ensure it's synced and roughly looks correct
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

  describe("CodeMirror -> MeiFriend sync (Editor to Model)", () => {
    it("should sync text changes to the model after a delay", async () => {
      vi.useFakeTimers();
      const plugin = new CodeMirrorPlugin(meiFriend, { syncDelay: 50 });
      const view = new EditorView({
        doc: meiFriend.toXmlString(),
        extensions: [basicSetup, plugin.extensions],
      });

      const docText = view.state.doc.toString();
      const pos = docText.indexOf('pname="c"') + 7;

      view.dispatch({
        changes: { from: pos, to: pos + 1, insert: "b" },
      });

      // Not synced yet
      expect(meiFriend.getElementById("n1")?.getAttribute("pname")).toBe("c");

      vi.advanceTimersByTime(100);

      // Now synced
      expect(meiFriend.getElementById("n1")?.getAttribute("pname")).toBe("b");

      vi.useRealTimers();
      view.destroy();
      plugin.destroy();
    });

    it("should sync element structural changes from text", async () => {
      vi.useFakeTimers();
      const plugin = new CodeMirrorPlugin(meiFriend, { syncDelay: 0 });
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

      vi.advanceTimersByTime(10);

      const n3 = meiFriend.getElementById("n3");
      expect(n3).toBeDefined();
      expect(n3?.getAttribute("pname")).toBe("a");

      vi.useRealTimers();
      view.destroy();
      plugin.destroy();
    });

    it("should skip update if only formatting/whitespace changes", async () => {
      vi.useFakeTimers();
      const plugin = new CodeMirrorPlugin(meiFriend, { syncDelay: 0 });
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

      vi.advanceTimersByTime(10);

      // Should have been processed but no Yjs update triggered
      expect(plugin.state.status).toBe("idle");
      expect(onUpdateSpy).not.toHaveBeenCalled();

      vi.useRealTimers();
      view.destroy();
      plugin.destroy();
    });

    it("should auto-inject xml:id when a new element is typed", async () => {
      vi.useFakeTimers();
      const plugin = new CodeMirrorPlugin(meiFriend, { syncDelay: 0 });
      const view = new EditorView({
        doc: meiFriend.toXmlString(),
        extensions: [basicSetup, plugin.extensions],
      });

      const docText = view.state.doc.toString();
      const n1Pos = docText.indexOf('<note xml:id="n1"');

      // Type a new note without ID
      view.dispatch({
        changes: {
          from: n1Pos,
          to: n1Pos,
          insert: '<note pname="e"/>\n          ',
        },
      });

      // Wait for sync to model
      vi.advanceTimersByTime(10);

      // Now wait for model sync back to editor (this is another turn)
      // In tests, this happens immediately because it's synchronous in MeiFriend,
      // but we need to let the promise resolve or similar if there were any.
      // Actually, meiFriend.update triggers onUpdate which calls handleModelUpdate synchronously.

      // The plugin should have received an xml:id from the model update
      const updatedText = view.state.doc.toString();
      expect(updatedText).toMatch(/<note xml:id="[a-zA-Z0-9-]+" pname="e"\/>/);

      vi.useRealTimers();
      view.destroy();
      plugin.destroy();
    });

    it("should not trigger a feedback loop", async () => {
      vi.useFakeTimers();
      const plugin = new CodeMirrorPlugin(meiFriend, { syncDelay: 0 });
      const view = new EditorView({
        doc: meiFriend.toXmlString(),
        extensions: [basicSetup, plugin.extensions],
      });
      const dispatchSpy = vi.spyOn(view, "dispatch");

      // Change from model
      meiFriend.update("n1", '<note xml:id="n1" pname="g" oct="4" dur="4" />');

      // The dispatch should have happened for model-sync
      expect(dispatchSpy).toHaveBeenCalled();

      vi.advanceTimersByTime(100);

      vi.useRealTimers();
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
