import { describe, expect, it } from "vitest";
import { MeiFriend } from "../src/index.js";

describe("MeiElement", () => {
  describe("Attributes", () => {
    it("should get and set attributes via update", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m1"/>');
      const root = meiFriend.getRootElement()!;
      meiFriend.updateXmlString("m1", '<mei xml:id="m1" pname="c"/>');
      expect(root.getAttribute("pname")).toBe("c");
      expect(root.getAttributes()).toEqual({ "xml:id": "m1", pname: "c" });
    });

    it("should remove attributes via update", () => {
      const meiFriend = MeiFriend.fromXmlString(
        '<mei xml:id="m1" attr="val"/>',
      );
      const root = meiFriend.getRootElement()!;
      meiFriend.updateXmlString("m1", '<mei xml:id="m1"/>');
      expect(root.getAttribute("attr")).toBeUndefined();
    });

    it("should fail if ID is changed in update", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m1"/>');
      expect(() =>
        meiFriend.updateXmlString("m1", '<mei xml:id="m2"/>'),
      ).toThrowError(/ID mismatch/);
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

  describe("Mutations (via MeiFriend.update)", () => {
    it("should handle adding elements by updating parent", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m1"/>');
      meiFriend.updateXmlString(
        "m1",
        '<mei xml:id="m1"><music xml:id="mu1"/></mei>',
      );
      const root = meiFriend.getRootElement()!;
      expect(root.children.length).toBe(1);
      expect(root.children[0].tagName).toBe("music");
    });

    it("should handle removing elements by updating parent", () => {
      const meiFriend = MeiFriend.fromXmlString(
        '<mei xml:id="m1"><music xml:id="mu1"/></mei>',
      );
      meiFriend.updateXmlString("m1", '<mei xml:id="m1"/>');
      const root = meiFriend.getRootElement()!;
      expect(root.children.length).toBe(0);
    });

    it("should update textContent and clear existing child elements", () => {
      const meiFriend = MeiFriend.fromXmlString(
        '<mei xml:id="m1"><music xml:id="mu1"/></mei>',
      );
      const root = meiFriend.getRootElement()!;
      expect(root.children.length).toBe(1);

      meiFriend.updateXmlString("m1", '<mei xml:id="m1">Hello MEI</mei>');
      expect(root.textContent).toBe("Hello MEI");
      expect(root.children.length).toBe(0);
    });

    it("should return recursive textContent from nested elements", () => {
      const meiFriend = MeiFriend.fromXmlString(
        '<mei xml:id="m1"><title xml:id="t1">A <abbr xml:id="a1">feat.</abbr> B</title></mei>',
      );
      const title = meiFriend.getElementsByTagName("title")[0];
      expect(title.textContent).toBe("A feat. B");
    });
  });

  describe("produceElement", () => {
    it("should clone and modify element using recipe", () => {
      const meiFriend = MeiFriend.fromXmlString(
        '<mei xml:id="m1" label="old"/>',
      );
      const root = meiFriend.getRootElement()!;
      const modified = meiFriend.produceElement(root, (draft) => {
        draft.setAttribute("label", "new");
      });

      expect(modified.id).toBe("m1");
      expect(modified.getAttribute("label")).toBe("new");
      // Original remains unchanged
      expect(root.getAttribute("label")).toBe("old");
    });

    it("should generate a new ID if recipe removes ID", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei xml:id="m1"/>');
      const root = meiFriend.getRootElement()!;
      const newRoot = meiFriend.produceElement(root, (draft) => {
        draft.removeAttribute("xml:id");
      });
      expect(newRoot.id).toBeDefined();
      expect(newRoot.id).not.toBe(root.id);
    });
  });
});
