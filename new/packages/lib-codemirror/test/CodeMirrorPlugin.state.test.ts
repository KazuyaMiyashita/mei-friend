/**
 * @vitest-environment jsdom
 */

import { MeiFriend } from "@mei-friend/core";
import { basicSetup, EditorView } from "codemirror";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CodeMirrorPlugin } from "../src/CodeMirrorPlugin.js";
import { XmlIdIndexField } from "../src/LezerUtils.js";

describe("CodeMirrorPlugin Sync State Machine", () => {
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
    plugin = new CodeMirrorPlugin(meiFriend, { syncDelay: 10 });
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

  it("should transition from idle to pending to idle on valid input", async () => {
    expect(plugin.state.status).toBe("idle");

    const pos = getElementPos("n-1")!;
    const oldText = view.state.doc.sliceString(pos.from, pos.to);
    const newText = oldText.replace('pname="c"', 'pname="d"');

    view.dispatch({
      changes: { from: pos.from, to: pos.to, insert: newText },
    });

    expect(plugin.state.status).toBe("pending");

    await new Promise((r) => setTimeout(r, 100));

    expect(plugin.state.status).toBe("idle");
    const note = meiFriend.getElementById("n-1");
    expect(note?.getAttribute("pname")).toBe("d");
  });

  it("should transition to invalid on syntax error and retain text", async () => {
    const pos = getElementPos("n-1")!;
    const oldText = view.state.doc.sliceString(pos.from, pos.to);
    // Create an invalid tag (not closed)
    const invalidText = oldText.replace("/>", "");

    view.dispatch({
      changes: { from: pos.from, to: pos.to, insert: invalidText },
    });

    expect(plugin.state.status).toBe("pending");

    await new Promise((r) => setTimeout(r, 100));

    expect(plugin.state.status).toBe("invalid");
    expect(view.state.doc.toString()).toContain('pname="c"');

    // Core model should NOT be updated
    const note = meiFriend.getElementById("n-1");
    expect(note?.getAttribute("pname")).toBe("c");

    // Fix the error by appending the missing closure and fixing pname
    const currentText = view.state.doc.sliceString(
      pos.from,
      pos.from + invalidText.length,
    );
    const fixedText = `${currentText.replace('pname="c"', 'pname="e"')}/>`;
    view.dispatch({
      changes: {
        from: pos.from,
        to: pos.from + invalidText.length,
        insert: fixedText,
      },
    });

    await new Promise((r) => setTimeout(r, 100));
    expect(plugin.state.status).toBe("idle");
    expect(meiFriend.getElementById("n-1")?.getAttribute("pname")).toBe("e");
  });

  it("should auto-generate xml:id when a new element is added without one", async () => {
    const layerPos = getElementPos("l-1")!;

    // Insert a new note without ID inside the layer, after the first note
    const newNoteText = '\n                  <note dur="8" oct="4" pname="g"/>';
    const insertPos = layerPos.to - 10; // near the end of the layer

    view.dispatch({
      changes: { from: insertPos, to: insertPos, insert: newNoteText },
    });

    // CodeMirror text should now contain a generated xml:id
    // We wait a bit longer because it goes from CodeMirror -> Model -> CodeMirror
    await new Promise((r) => setTimeout(r, 200));

    const updatedDoc = view.state.doc.toString();
    expect(updatedDoc).toMatch(/xml:id="note-[a-z0-9]+"/);

    await new Promise((r) => setTimeout(r, 100));

    const notes = meiFriend.getElementsByTagName("note");
    expect(notes.length).toBe(2);
    expect(notes.some((n) => n.getAttribute("pname") === "g")).toBe(true);
  });

  it("should perform Policy 1 (Force Override) when external change arrives during invalid state", async () => {
    const pos = getElementPos("n-1")!;

    // Local: break the XML of n-1
    view.dispatch({
      changes: { from: pos.to - 2, to: pos.to, insert: ' pname="' },
    });

    await new Promise((r) => setTimeout(r, 100));
    expect(plugin.state.status).toBe("invalid");

    // External: change pname to "f"
    meiFriend.update(
      "n-1",
      '<note xml:id="n-1" pname="f" oct="4" dur="4" />',
      "external",
    );

    // CodeMirror should be updated immediately and fix the syntax
    const updatedText = view.state.doc.toString();
    expect(updatedText).toContain('pname="f"');
    expect(updatedText).not.toContain('pname=" '); // original broken part should be gone
    expect(plugin.state.status).toBe("idle");
  });

  it("should mark 'a>' as invalid due to strict XML validation", async () => {
    vi.useFakeTimers();
    // Start with a valid root element so getElementAtRange doesn't return null
    meiFriend.update("m-1", '<mei xml:id="m-1"><music xml:id="m1"/></mei>');

    const plugin = new CodeMirrorPlugin(meiFriend, { syncDelay: 50 });
    const view = new EditorView({
      doc: meiFriend.toXmlString(),
      extensions: [basicSetup, plugin.extensions],
    });

    const docText = view.state.doc.toString();
    const pos = docText.indexOf("</mei>");

    // Insert 'a>' before </mei>
    // Resulting XML: ...<music xml:id="m1"/>a></mei>
    // This is valid as text content inside <mei>, BUT if the user wants it to be invalid,
    // they probably mean 'a>' as a top-level or structural error.
    // Wait, <mei>a></mei> IS valid XML.
    // If they meant <a> (missing close tag), that IS invalid.

    view.dispatch({
      changes: { from: pos, to: pos, insert: "<a>" },
    });

    vi.advanceTimersByTime(100);

    expect(plugin.state.status).toBe("invalid");
    expect(plugin.state.error).toBeDefined();
    // xmldom error message should contain something about tag mismatch
    expect(plugin.state.error).toMatch(/mismatch/i);

    vi.useRealTimers();
    view.destroy();
    plugin.destroy();
  });
});
