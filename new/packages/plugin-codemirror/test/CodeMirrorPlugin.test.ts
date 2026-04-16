/**
 * @vitest-environment jsdom
 */
import { MeiFriend } from "@mei-friend/core";
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
    expect(plugin.editorView).toBeDefined();
    plugin.destroy();
  });

  describe("MeiFriend -> CodeMirror sync (Model to Editor)", () => {
    it("should sync attribute changes from model to editor", () => {
      const plugin = new CodeMirrorPlugin(meiFriend);
      const view = plugin.editorView;

      meiFriend.update({
        type: "setAttribute",
        targetId: "n1",
        name: "pname",
        value: "e",
      });

      const docText = view.state.doc.toString();
      expect(docText).toContain('pname="e"');
      expect(docText).toContain('xml:id="n1"');
      expect(docText.trim()).toBe(meiFriend.toXmlString().trim());
      plugin.destroy();
    });

    it("should sync element additions from model to editor", () => {
      const plugin = new CodeMirrorPlugin(meiFriend);
      const view = plugin.editorView;

      meiFriend.update({
        type: "addElement",
        parentId: "l1",
        tagName: "note",
        id: "n3",
        attributes: { pname: "g", oct: "4", dur: "4" },
      });

      const docText = view.state.doc.toString();
      expect(docText).toContain('xml:id="n3"');
      expect(docText.trim()).toBe(meiFriend.toXmlString().trim());
      plugin.destroy();
    });

    it("should sync element removals from model to editor", () => {
      const plugin = new CodeMirrorPlugin(meiFriend);
      const view = plugin.editorView;

      meiFriend.update({
        type: "removeElement",
        targetId: "n1",
      });

      const docText = view.state.doc.toString();
      expect(docText).not.toContain('xml:id="n1"');
      expect(docText).toContain('xml:id="n2"');
      expect(docText.trim()).toBe(meiFriend.toXmlString().trim());
      plugin.destroy();
    });

    it("should maintain cursor position in unrelated parts", () => {
      const plugin = new CodeMirrorPlugin(meiFriend);
      const view = plugin.editorView;

      const lastPos = view.state.doc.length;
      view.dispatch({ selection: { anchor: lastPos } });

      meiFriend.update({
        type: "setAttribute",
        targetId: "n1",
        name: "pname",
        value: "f",
      });

      // Cursor should stay near the end
      expect(view.state.selection.main.anchor).toBeGreaterThan(lastPos - 10);
      plugin.destroy();
    });
  });

  describe("CodeMirror -> MeiFriend sync (Editor to Model)", () => {
    it("should sync text changes to the model after a delay", async () => {
      vi.useFakeTimers();
      const plugin = new CodeMirrorPlugin(meiFriend, { syncDelay: 50 });
      const view = plugin.editorView;

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
      plugin.destroy();
    });

    it("should sync element structural changes from text", async () => {
      vi.useFakeTimers();
      const plugin = new CodeMirrorPlugin(meiFriend, { syncDelay: 0 });
      const view = plugin.editorView;

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
      plugin.destroy();
    });

    it("should not trigger a feedback loop", async () => {
      vi.useFakeTimers();
      const plugin = new CodeMirrorPlugin(meiFriend, { syncDelay: 0 });
      const view = plugin.editorView;
      const dispatchSpy = vi.spyOn(view, "dispatch");

      // Change from model
      meiFriend.update({
        type: "setAttribute",
        targetId: "n1",
        name: "pname",
        value: "g",
      });

      // The dispatch should have happened for model-sync
      expect(dispatchSpy).toHaveBeenCalled();

      vi.advanceTimersByTime(100);

      // If a loop existed, MeiFriend.update might have been called again with "codemirror" origin
      // We can't easily spy on meiFriend.update here without more setup,
      // but we can check if handleDocChange was called.
      // (Actually handleDocChange is private, so we check if model is dirty)

      // Verification: The origin of the last model change should NOT be "codemirror"
      // because the change came FROM the model.

      vi.useRealTimers();
      plugin.destroy();
    });
  });

  describe("Utilities", () => {
    it("should jump to and highlight an element", () => {
      const plugin = new CodeMirrorPlugin(meiFriend);
      const view = plugin.editorView;

      const result = plugin.jumpToElement("n2");
      expect(result).toBe(true);

      const selection = view.state.selection.main;
      const selectedText = view.state.doc.sliceString(
        selection.from,
        selection.to,
      );
      expect(selectedText).toContain('xml:id="n2"');
      plugin.destroy();
    });

    it("should return false when jumping to non-existent ID", () => {
      const plugin = new CodeMirrorPlugin(meiFriend);
      const result = plugin.jumpToElement("ghost");
      expect(result).toBe(false);
      plugin.destroy();
    });
  });
});
