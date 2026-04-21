/**
 * @vitest-environment jsdom
 */

import { MeiFriend } from "@mei-friend/core";
import { basicSetup, EditorView } from "codemirror";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CodeMirrorPlugin } from "../src/CodeMirrorPlugin.js";

const testXml = `
<mei xmlns="http://www.music-encoding.org/ns/mei" xml:id="m1">
  <music xml:id="mu1">
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

describe("Indentation and Cursor Tracking", () => {
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

  it("should not drift indentation when editing text nodes", () => {
    const plugin = new CodeMirrorPlugin(meiFriend);
    const initialXml = `
<mei xml:id="m1" xmlns="http://www.music-encoding.org/ns/mei">
  <a xml:id="a1">Hello</a>
</mei>`.trim();
    meiFriend.replaceXmlString(initialXml);

    const view = new EditorView({
      doc: meiFriend.toXmlString(),
      extensions: [basicSetup, plugin.extensions],
    });

    const docText = view.state.doc.toString();
    const helloPos = docText.indexOf("Hello") + 5;

    // Edit: Hello -> Hello.
    view.dispatch({
      changes: { from: helloPos, to: helloPos, insert: "." },
    });

    plugin.apply();

    const afterApply = view.state.doc.toString();
    // Should be inline, no extra newlines or spaces added by re-indentation
    expect(afterApply).toContain('<a xml:id="a1">Hello.</a>');
    expect(afterApply).not.toMatch(/<a xml:id="a1">\s+Hello\.\s+<\/a>/);

    view.destroy();
    plugin.destroy();
  });

  it("should format multi-line text nodes as blocks", () => {
    const plugin = new CodeMirrorPlugin(meiFriend);
    const initialXml = `
<mei xml:id="m1" xmlns="http://www.music-encoding.org/ns/mei">
  <a xml:id="a1">Line 1\nLine 2</a>
</mei>`.trim();
    meiFriend.replaceXmlString(initialXml);

    const view = new EditorView({
      doc: meiFriend.toXmlString(),
      extensions: [basicSetup, plugin.extensions],
    });

    const afterApply = view.state.doc.toString();
    expect(afterApply).toMatch(
      /<a xml:id="a1">\n\s+Line 1\n\s+Line 2\n\s+<\/a>/,
    );

    view.destroy();
    plugin.destroy();
  });

  it("should restore cursor in tag name after apply", () => {
    const plugin = new CodeMirrorPlugin(meiFriend);
    const view = new EditorView({
      doc: meiFriend.toXmlString(),
      extensions: [basicSetup, plugin.extensions],
    });

    const docText = view.state.doc.toString();
    const tagPos = docText.indexOf("<note") + 3; // inside "<no|te"
    view.dispatch({ selection: { anchor: tagPos } });

    // Make a dirty change elsewhere to allow apply
    const n1Pos = docText.indexOf('pname="c"') + 7;
    view.dispatch({ changes: { from: n1Pos, to: n1Pos + 1, insert: "d" } });

    plugin.apply();

    const newDocText = view.state.doc.toString();
    const newTagPos = newDocText.indexOf("<note") + 3;
    expect(view.state.selection.main.anchor).toBe(newTagPos);

    view.destroy();
    plugin.destroy();
  });

  it("should restore cursor in attribute name after apply", () => {
    const plugin = new CodeMirrorPlugin(meiFriend);
    const view = new EditorView({
      doc: meiFriend.toXmlString(),
      extensions: [basicSetup, plugin.extensions],
    });

    const docText = view.state.doc.toString();
    const attrNamePos = docText.indexOf('pname="c"') + 2; // inside "pn|ame"
    view.dispatch({ selection: { anchor: attrNamePos } });

    // Change pname="c" to pname="d"
    const valPos = docText.indexOf('pname="c"') + 7;
    view.dispatch({ changes: { from: valPos, to: valPos + 1, insert: "d" } });

    plugin.apply();

    const newDocText = view.state.doc.toString();
    const newAttrNamePos = newDocText.indexOf('pname="d"') + 2;
    expect(view.state.selection.main.anchor).toBe(newAttrNamePos);

    view.destroy();
    plugin.destroy();
  });

  it("should restore cursor in text content after apply", () => {
    const plugin = new CodeMirrorPlugin(meiFriend);
    meiFriend.replaceXmlString(
      '<mei xml:id="m1"><a xml:id="a1">Hello</a></mei>',
    );

    const view = new EditorView({
      doc: meiFriend.toXmlString(),
      extensions: [basicSetup, plugin.extensions],
    });

    const docText = view.state.doc.toString();
    const helloPos = docText.indexOf("Hello") + 2; // "He|llo"
    view.dispatch({ selection: { anchor: helloPos } });

    view.dispatch({
      changes: { from: helloPos + 3, to: helloPos + 3, insert: "!" },
    });

    plugin.apply();

    const newDocText = view.state.doc.toString();
    const newHelloPos = newDocText.indexOf("Hello!") + 2;
    expect(view.state.selection.main.anchor).toBe(newHelloPos);

    view.destroy();
    plugin.destroy();
  });

  it("should track cursor in an element with an ID", async () => {
    const plugin = new CodeMirrorPlugin(meiFriend);
    const view = new EditorView({
      doc: meiFriend.toXmlString(),
      extensions: [basicSetup, plugin.extensions],
    });

    const docText = view.state.doc.toString();
    const layerEnd = docText.indexOf("</layer>");

    // Insert a new note WITH ID
    const newNote = '<note xml:id="new1" pname="abcde"/>';
    view.dispatch({
      changes: {
        from: layerEnd,
        to: layerEnd,
        insert: `${newNote}\n          `,
      },
    });

    // Place cursor in the new note's pname value: pname="ab|cde"
    const currentDoc = view.state.doc.toString();
    const noteStart = currentDoc.indexOf('<note xml:id="new1" pname="abcde"/>');
    const targetPos = currentDoc.indexOf("abcde", noteStart) + 2;
    view.dispatch({ selection: { anchor: targetPos } });

    plugin.apply();

    // The cursor should still be in its pname value at offset 2 (before 'c').
    const finalDoc = view.state.doc.toString();
    expect(finalDoc).toMatch(/<note xml:id="new1" pname="abcde"\/>/);

    const finalPos = view.state.selection.main.anchor;
    expect(finalDoc[finalPos]).toBe("c");

    view.destroy();
    plugin.destroy();
  });

  it("should track cursor in a new element without ID (non-zero child index)", async () => {
    const plugin = new CodeMirrorPlugin(meiFriend);
    // Add multiple notes to l1 initially
    meiFriend.update(
      "l1",
      '<layer xml:id="l1"><note xml:id="n1"/><note xml:id="n2"/></layer>',
    );

    const view = new EditorView({
      doc: meiFriend.toXmlString(),
      extensions: [basicSetup, plugin.extensions],
    });

    const docText = view.state.doc.toString();
    const n2Start = docText.indexOf('<note xml:id="n2"/>');

    // Insert a new note BEFORE n2
    const newNote = '<note pname="abcde"/>';
    view.dispatch({
      changes: { from: n2Start, to: n2Start, insert: `${newNote}\n          ` },
    });

    const currentDoc = view.state.doc.toString();
    const targetNoteStart = currentDoc.indexOf('<note pname="abcde"/>');
    const targetPos = currentDoc.indexOf("abcde", targetNoteStart) + 2;
    view.dispatch({ selection: { anchor: targetPos } });

    plugin.apply();

    // The new note should have an ID now.
    const finalDoc = view.state.doc.toString();
    expect(finalDoc).toMatch(/<note xml:id=".*" pname="abcde"\/>/);

    // The cursor should still be in its pname value at offset 2 (before 'c').
    const finalPos = view.state.selection.main.anchor;
    expect(finalDoc[finalPos]).toBe("c");

    view.destroy();
    plugin.destroy();
  });
});
