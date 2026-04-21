import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { IdGenerator } from "../../src/utils/IdGenerator.js";
import {
  COMMENT_WRAPPER_TAG,
  escapeXml,
  ROOT_WRAPPER_TAG,
  XmlSerde,
} from "../../src/utils/XmlSerde.js";

function makeSerde() {
  return new XmlSerde(new IdGenerator());
}

describe("escapeXml", () => {
  it("escapes all special XML characters", () => {
    expect(escapeXml("<")).toBe("&lt;");
    expect(escapeXml(">")).toBe("&gt;");
    expect(escapeXml("&")).toBe("&amp;");
    expect(escapeXml('"')).toBe("&quot;");
    expect(escapeXml("'")).toBe("&apos;");
  });

  it("leaves unrelated characters intact", () => {
    expect(escapeXml("hello world")).toBe("hello world");
    expect(escapeXml("abc123")).toBe("abc123");
  });

  it("escapes combined special characters", () => {
    expect(escapeXml('A & B "quoted"')).toBe("A &amp; B &quot;quoted&quot;");
    expect(escapeXml("5 < 10 & 10 > 5")).toBe("5 &lt; 10 &amp; 10 &gt; 5");
  });
});

describe("XmlSerde.serialize", () => {
  it("serializes a self-closing element", () => {
    const el = new Y.XmlElement("note");
    new Y.Doc().getXmlFragment("tmp").push([el]);
    el.setAttribute("xml:id", "n1");

    expect(makeSerde().serialize(el, 0)).toBe('<note xml:id="n1"/>');
  });

  it("serializes attributes in deterministic order with xml:id first", () => {
    const el = new Y.XmlElement("note");
    new Y.Doc().getXmlFragment("tmp").push([el]);
    el.setAttribute("pname", "c");
    el.setAttribute("xml:id", "n1");
    el.setAttribute("dur", "4");

    expect(makeSerde().serialize(el, 0)).toMatch(
      /^<note xml:id="n1" dur="4" pname="c"\/>/,
    );
  });

  it("serializes nested elements with 2-space indentation", () => {
    const parent = new Y.XmlElement("layer");
    const child = new Y.XmlElement("note");
    new Y.Doc().getXmlFragment("tmp").push([parent]);
    parent.setAttribute("xml:id", "l1");
    child.setAttribute("xml:id", "n1");
    parent.push([child]);

    expect(makeSerde().serialize(parent, 0)).toBe(
      '<layer xml:id="l1">\n  <note xml:id="n1"/>\n</layer>',
    );
  });

  it("serializes mixed content without adding newlines", () => {
    const p = new Y.XmlElement("p");
    const lb = new Y.XmlElement("lb");
    new Y.Doc().getXmlFragment("tmp").push([p]);
    p.setAttribute("xml:id", "p1");
    lb.setAttribute("xml:id", "lb1");
    p.push([new Y.XmlText("Text before "), lb, new Y.XmlText(" Text after")]);

    expect(makeSerde().serialize(p, 0)).toBe(
      '<p xml:id="p1">Text before <lb xml:id="lb1"/> Text after</p>',
    );
  });

  it("serializes comment wrappers as XML comments", () => {
    const comment = new Y.XmlElement(COMMENT_WRAPPER_TAG);
    new Y.Doc().getXmlFragment("tmp").push([comment]);
    comment.push([new Y.XmlText(" a comment ")]);

    expect(makeSerde().serialize(comment, 0)).toBe("<!-- a comment -->");
  });

  it("serializes ROOT_WRAPPER_TAG by rendering its children directly", () => {
    const root = new Y.XmlElement(ROOT_WRAPPER_TAG);
    const mei = new Y.XmlElement("mei");
    new Y.Doc().getXmlFragment("tmp").push([root]);
    mei.setAttribute("xml:id", "m1");
    root.push([mei]);

    expect(makeSerde().serialize(root, 0)).toBe('<mei xml:id="m1"/>');
  });

  it("escapes special characters in attribute values and text", () => {
    const el = new Y.XmlElement("note");
    new Y.Doc().getXmlFragment("tmp").push([el]);
    el.setAttribute("xml:id", "n1");
    el.setAttribute("title", 'A & B "quoted"');
    el.push([new Y.XmlText("5 < 10 & 10 > 5")]);

    const result = makeSerde().serialize(el, 0);
    expect(result).toContain('title="A &amp; B &quot;quoted&quot;"');
    expect(result).toContain("5 &lt; 10 &amp; 10 &gt; 5");
  });

  describe("Indentation normalization (sample_8_6.mei)", () => {
    const filePath = resolve(__dirname, "../fixtures/sample_8_6.mei");
    const rawXml = readFileSync(filePath, "utf-8");

    it("sample file uses 3-space indentation", () => {
      expect(rawXml).toMatch(/^ {3}</m);
    });

    it("normalizes to 2-space indentation", () => {
      const serde = makeSerde();
      const dom = serde.parse(rawXml);
      const root = new Y.XmlElement(ROOT_WRAPPER_TAG);
      new Y.Doc().getXmlFragment("tmp").push([root]);
      serde.populateFromDom(dom as unknown as Node, root);

      const output = serde.serialize(root, 0);
      expect(output).not.toMatch(/^ {3}</m);
      expect(output).toMatch(/^ {2}</m);
    });

    it("uses only multiples of 2 spaces for indentation", () => {
      const serde = makeSerde();
      const dom = serde.parse(rawXml);
      const root = new Y.XmlElement(ROOT_WRAPPER_TAG);
      new Y.Doc().getXmlFragment("tmp").push([root]);
      serde.populateFromDom(dom as unknown as Node, root);

      const output = serde.serialize(root, 0);
      for (const line of output.split("\n")) {
        const leading = line.match(/^( *)</);
        if (leading) {
          expect(leading[1].length % 2).toBe(0);
        }
      }
    });
  });
});

describe("XmlSerde.parse", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("throws on malformed XML", () => {
    expect(() => makeSerde().parse("<mei>unclosed")).toThrow(
      /unclosed xml tag/i,
    );
  });

  it("auto-assigns xml:id to elements that lack one", () => {
    const dom = makeSerde().parse("<mei><note/></mei>");
    const mei = dom.documentElement;
    const note = mei.childNodes[0];

    expect(mei.getAttribute("xml:id")).toBeTruthy();
    expect(note.getAttribute("xml:id")).toBeTruthy();
  });

  it("preserves an existing xml:id", () => {
    const dom = makeSerde().parse('<mei xml:id="m1"/>');
    expect(dom.documentElement.getAttribute("xml:id")).toBe("m1");
  });

  it("sets targetId on root when root has no id", () => {
    const dom = makeSerde().parse("<mei/>", "m1");
    expect(dom.documentElement.getAttribute("xml:id")).toBe("m1");
  });

  it("throws when root id does not match targetId", () => {
    expect(() => makeSerde().parse('<mei xml:id="m2"/>', "m1")).toThrow(
      /ID mismatch/,
    );
  });
});

describe("XmlSerde.populateFromDom", () => {
  it("populates elements and attributes into a Y.XmlElement", () => {
    const serde = makeSerde();
    const dom = serde.parse('<mei xml:id="m1"><note xml:id="n1"/></mei>');
    const root = new Y.XmlElement(ROOT_WRAPPER_TAG);
    new Y.Doc().getXmlFragment("tmp").push([root]);
    serde.populateFromDom(dom as unknown as Node, root);

    const mei = root.get(0) as Y.XmlElement;
    expect(mei.nodeName).toBe("mei");
    expect(mei.getAttribute("xml:id")).toBe("m1");

    const note = mei.get(0) as Y.XmlElement;
    expect(note.nodeName).toBe("note");
    expect(note.getAttribute("xml:id")).toBe("n1");
  });

  it("wraps XML comments in COMMENT_WRAPPER_TAG elements", () => {
    const serde = makeSerde();
    const dom = serde.parse('<mei xml:id="m1"><!-- hello --></mei>');
    const root = new Y.XmlElement(ROOT_WRAPPER_TAG);
    new Y.Doc().getXmlFragment("tmp").push([root]);
    serde.populateFromDom(dom as unknown as Node, root);

    const mei = root.get(0) as Y.XmlElement;
    const commentWrapper = mei.get(0) as Y.XmlElement;
    expect(commentWrapper.nodeName).toBe(COMMENT_WRAPPER_TAG);
    expect(commentWrapper.get(0)?.toString()).toBe(" hello ");
  });

  it("preserves text content inside elements", () => {
    const serde = makeSerde();
    const dom = serde.parse('<p xml:id="p1">hello</p>');
    const root = new Y.XmlElement(ROOT_WRAPPER_TAG);
    new Y.Doc().getXmlFragment("tmp").push([root]);
    serde.populateFromDom(dom as unknown as Node, root);

    const p = root.get(0) as Y.XmlElement;
    expect(p.get(0)?.toString()).toBe("hello");
  });

  it("strips structural whitespace from text nodes during parsing", () => {
    const serde = makeSerde();
    const xml = `
<a xml:id="a1">
  Hello
  World
</a>`.trim();
    const dom = serde.parse(xml);
    const root = new Y.XmlElement(ROOT_WRAPPER_TAG);
    new Y.Doc().getXmlFragment("tmp").push([root]);
    serde.populateFromDom(dom as unknown as Node, root);

    const a = root.get(0) as Y.XmlElement;
    expect(a.get(0)?.toString()).toBe("Hello\nWorld");
  });

  it("serializes single-line text content inline", () => {
    const serde = makeSerde();
    const xml = '<a xml:id="a1">Hello</a>';
    const dom = serde.parse(xml);
    const root = new Y.XmlElement(ROOT_WRAPPER_TAG);
    new Y.Doc().getXmlFragment("tmp").push([root]);
    serde.populateFromDom(dom as unknown as Node, root);

    expect(serde.serialize(root, 0)).toBe('<a xml:id="a1">Hello</a>');
  });

  it("serializes multi-line text content as a block", () => {
    const serde = makeSerde();
    const xml = `
<a xml:id="a1">
  Line 1
  Line 2
</a>`.trim();
    const dom = serde.parse(xml);
    const root = new Y.XmlElement(ROOT_WRAPPER_TAG);
    new Y.Doc().getXmlFragment("tmp").push([root]);
    serde.populateFromDom(dom as unknown as Node, root);

    const expected = '<a xml:id="a1">\n  Line 1\n  Line 2\n</a>';
    expect(serde.serialize(root, 0)).toBe(expected);
  });
});
