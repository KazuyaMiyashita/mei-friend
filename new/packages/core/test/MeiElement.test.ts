import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  addElement,
  MeiFriend,
  removeAttribute,
  removeElement,
  setAttribute,
  setTextContent,
} from "../src/index.js";

describe("MeiElement", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  describe("Attributes", () => {
    it("should get and set attributes", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m1"/>');
      const root = meiFriend.getRootElement()!;
      meiFriend.update(setAttribute("m1", "pname", "c"));
      expect(root.getAttribute("pname")).toBe("c");
      expect(root.getAttributes()).toEqual({ "xml:id": "m1", pname: "c" });
    });

    it("should remove attributes", () => {
      const meiFriend = MeiFriend.fromXmlString(
        '<mei xml:id="m1" attr="val"/>',
      );
      const root = meiFriend.getRootElement()!;
      meiFriend.update(removeAttribute("m1", "attr"));
      expect(root.getAttribute("attr")).toBeUndefined();
    });

    it("should reject removal of xml:id or id attributes", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m1" id="m2" />');
      const root = meiFriend.getRootElement()!;

      // Attempt via removeAttribute
      meiFriend.update(removeAttribute("m1", "xml:id"));
      meiFriend.update(removeAttribute("m1", "id"));
      expect(root.getAttribute("xml:id")).toBe("m1");
      expect(root.getAttribute("id")).toBe("m2");

      // Attempt via updateElement (setting to null)
      meiFriend.update({
        type: "updateElement",
        targetId: "m1",
        attributes: { "xml:id": null, id: null },
      });
      expect(root.getAttribute("xml:id")).toBe("m1");
      expect(root.getAttribute("id")).toBe("m2");
    });

    it("should handle id attribute in addition to xml:id", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei id="m1"/>');
      const root = meiFriend.getRootElement()!;
      expect(root.id).toBe("m1");
    });

    it("should return a generated id if neither xml:id nor id is present", () => {
      const meiFriend = MeiFriend.fromXmlString("<mei/>");
      const root = meiFriend.getRootElement()!;
      expect(root.id).toBeDefined();
      expect(root.id).toMatch(/^mei-/);
    });
  });

  describe("Traversal", () => {
    it("should navigate via parentElement and children", () => {
      const meiFriend = MeiFriend.fromXmlString(
        "<mei><music><body/></music></mei>",
      );
      const music = meiFriend.getElementsByTagName("music")[0];
      const body = meiFriend.getElementsByTagName("body")[0];
      const mei = meiFriend.getRootElement()!;

      expect(body.parentElement?.yNode).toBe(music.yNode);
      expect(music.parentElement?.yNode).toBe(mei.yNode);
      expect(mei.children.length).toBe(1);
      expect(mei.children[0].tagName).toBe("music");
    });

    it("should return undefined for parentElement of root", () => {
      const meiFriend = MeiFriend.fromXmlString("<mei/>");
      const root = meiFriend.getRootElement()!;
      expect(root.parentElement).toBeUndefined();
    });

    it("should navigate via sibling accessors, skipping non-element nodes", () => {
      const meiFriend = MeiFriend.fromXmlString("<mei><n1/>Text<n2/></mei>");
      const n1 = meiFriend.getElementsByTagName("n1")[0];
      const n2 = meiFriend.getElementsByTagName("n2")[0];

      expect(n1.nextElementSibling?.tagName).toBe("n2");
      expect(n2.previousElementSibling?.tagName).toBe("n1");
    });

    it("should find descendant elements by tag name", () => {
      const meiFriend = MeiFriend.fromXmlString(
        "<mei><music><body><note/><note/></body></music></mei>",
      );
      const music = meiFriend.getElementsByTagName("music")[0];
      expect(music.getElementsByTagName("note").length).toBe(2);
      expect(music.getElementsByTagName("rest").length).toBe(0);
    });

    it("should get a direct child element by tag name", () => {
      const meiFriend = MeiFriend.fromXmlString(
        "<mei><music><body/></music></mei>",
      );
      const mei = meiFriend.getRootElement()!;
      expect(mei.getChildElement("music")?.tagName).toBe("music");
      expect(mei.getChildElement("body")).toBeUndefined();
    });
  });

  describe("Mutations", () => {
    it("should remove itself from parent", () => {
      const meiFriend = MeiFriend.fromXmlString(
        '<mei xml:id="m1"><note xml:id="n1"/></mei>',
      );
      meiFriend.update(removeElement("n1"));
      expect(meiFriend.getElementById("n1")).toBeUndefined();
    });

    it("should remove itself even if it is the root (parent is XmlFragment)", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m1"/>');
      meiFriend.update(removeElement("m1"));
      expect(meiFriend.getRootElement()).toBeUndefined();
    });

    it("should handle addElement", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m1"/>');
      const root = meiFriend.getRootElement()!;
      meiFriend.update(addElement("m1", "music", "mu1"));
      expect(root.children.length).toBe(1);
      expect(root.children[0].tagName).toBe("music");
    });

    it("should handle addElement with index", () => {
      const meiFriend = MeiFriend.fromXmlString(
        '<mei xml:id="m1"><note xml:id="n2"/></mei>',
      );
      const root = meiFriend.getRootElement()!;

      meiFriend.update(addElement("m1", "note", "n1", undefined, undefined, 0));

      const children = root.children;
      expect(children[0].id).toBe("n1");
      expect(children[1].id).toBe("n2");
    });

    it("should set and get textContent and clear existing child elements", () => {
      const meiFriend = MeiFriend.fromXmlString(
        '<mei xml:id="m1"><music/></mei>',
      );
      const root = meiFriend.getRootElement()!;
      expect(root.children.length).toBe(1);

      meiFriend.update(setTextContent("m1", "Hello MEI"));
      expect(root.textContent).toBe("Hello MEI");
      expect(root.children.length).toBe(0);

      meiFriend.update(setTextContent("m1", "New Content"));
      expect(root.textContent).toBe("New Content");
    });

    it("should return recursive textContent from nested elements", () => {
      const meiFriend = MeiFriend.fromXmlString(
        '<mei xml:id="m1"><title>A <abbr>feat.</abbr> B</title></mei>',
      );
      const title = meiFriend.getElementsByTagName("title")[0];
      expect(title.textContent).toBe("A feat. B");
    });

    it("should preserve the original xml:id during replaceElement", () => {
      const meiFriend = MeiFriend.fromXmlString(
        '<mei xml:id="m1"><note xml:id="n1" pname="c"/></mei>',
      );

      // Attempt to replace with an element lacking an ID and with a different ID
      meiFriend.update({
        type: "replaceElement",
        targetId: "n1",
        xml: '<note pname="d"/>',
      });

      const note = meiFriend.getElementById("n1");
      expect(note).toBeDefined();
      expect(note!.getAttribute("xml:id")).toBe("n1");
      expect(note!.getAttribute("pname")).toBe("d"); // Other attributes should update

      // Attempt to replace with an element specifying a different ID
      meiFriend.update({
        type: "replaceElement",
        targetId: "n1",
        xml: '<note xml:id="n-malicious" dur="4"/>',
      });

      const sameNote = meiFriend.getElementById("n1");
      expect(sameNote).toBeDefined();
      expect(sameNote!.getAttribute("xml:id")).toBe("n1");
      expect(sameNote!.getAttribute("dur")).toBe("4");
      expect(meiFriend.getElementById("n-malicious")).toBeUndefined();
    });
  });
});
