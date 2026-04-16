import { xml } from "@codemirror/lang-xml";
import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import {
  getElementAtRange,
  hasSyntaxError,
  XmlIdIndexField,
} from "../src/LezerUtils.js";

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

describe("LezerUtils", () => {
  const state = EditorState.create({
    doc: testXml,
    extensions: [xml(), XmlIdIndexField],
  });

  it("should find an element at a given offset", () => {
    const offset = testXml.indexOf('xml:id="n1"');
    const dirty = getElementAtRange(state, offset, offset);

    expect(dirty).not.toBeNull();
    expect(dirty?.text).toContain('xml:id="n1"');
    expect(dirty?.node.name).toBe("Element");
  });

  it("should build an index of xml:id to positions", () => {
    const idMap = state.field(XmlIdIndexField);

    expect(idMap.has("b1")).toBe(true);
    expect(idMap.has("s1")).toBe(true);
    expect(idMap.has("l1")).toBe(true);
    expect(idMap.has("n1")).toBe(true);
    expect(idMap.has("n2")).toBe(true);

    const n1Pos = idMap.get("n1")!;
    const n1Text = testXml.slice(n1Pos.from, n1Pos.to);
    expect(n1Text).toContain('xml:id="n1"');
    expect(n1Text).toContain('pname="c"');
  });

  it("should update the index when the document changes", () => {
    const tr = state.update({
      changes: {
        from: testXml.indexOf("n1"),
        to: testXml.indexOf("n1") + 2,
        insert: "new-id",
      },
    });
    const newState = tr.state;
    const idMap = newState.field(XmlIdIndexField);

    expect(idMap.has("n1")).toBe(false);
    expect(idMap.has("new-id")).toBe(true);

    // Positions of other elements should be shifted
    const n2Pos = idMap.get("n2")!;
    const n2Text = newState.doc.sliceString(n2Pos.from, n2Pos.to);
    expect(n2Text).toContain('xml:id="n2"');
  });

  it("should find the same element for different offsets within it", () => {
    const offset1 = testXml.indexOf('pname="c"');
    const offset2 = testXml.indexOf('dur="4"');

    const dirty1 = getElementAtRange(state, offset1, offset1);
    const dirty2 = getElementAtRange(state, offset2, offset2);

    expect(dirty1?.from).toBe(dirty2?.from);
    expect(dirty1?.to).toBe(dirty2?.to);
  });

  it("should detect syntax errors in broken XML", () => {
    // A case that likely triggers an Error node in the XML parser
    const brokenXml = '<mei><note pname="c" </mei>';
    const brokenState = EditorState.create({
      doc: brokenXml,
      extensions: [xml()],
    });

    // Check if any error exists in the document at all
    const tree = syntaxTree(brokenState);
    let errorFound = false;
    tree.cursor().iterate((n) => {
      if (n.name === "Error") {
        errorFound = true;
        return false;
      }
      return true;
    });

    const dirty = getElementAtRange(brokenState, 10, 10);
    expect(dirty).not.toBeNull();
    const hasErr = hasSyntaxError(dirty!.node);
    expect(hasErr).toBe(errorFound);
  });

  it("should return null when offset is outside any element (if possible)", () => {
    // In XML, almost everything is inside the root element.
    // We'll test with empty document.
    const emptyState = EditorState.create({ doc: "", extensions: [xml()] });
    const dirty = getElementAtRange(emptyState, 0, 0);
    expect(dirty).toBeNull();
  });

  it("should identify a large range spanning multiple elements", () => {
    const from = testXml.indexOf('<note xml:id="n1"');
    const to = testXml.indexOf('dur="4"/>', from + 50) + 9;

    const dirty = getElementAtRange(state, from, to);

    expect(dirty).not.toBeNull();
    expect(dirty?.text).toContain("<layer");
  });
});
