import { describe, expect, it } from "vitest";
import { MeiFriend } from "../src/index.js";

describe("MeiElement", () => {
  describe("Attributes", () => {
    it("should get and set attributes", () => {
      const meiFriend = MeiFriend.fromXmlString("<mei/>");
      const root = meiFriend.getRootElement()!;
      meiFriend.update((tx) => root.setAttribute(tx, "pname", "c"));
      expect(root.getAttribute("pname")).toBe("c");
      expect(root.getAttributes()).toEqual({ pname: "c" });
    });

    it("should remove attributes", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei attr="val"/>');
      const root = meiFriend.getRootElement()!;
      meiFriend.update((tx) => root.removeAttribute(tx, "attr"));
      expect(root.getAttribute("attr")).toBeUndefined();
    });

    it("should handle id attribute in addition to xml:id", () => {
      const meiFriend = MeiFriend.fromXmlString('<mei id="m1"/>');
      const root = meiFriend.getRootElement()!;
      expect(root.id).toBe("m1");
    });

    it("should return undefined for id if neither xml:id nor id is present", () => {
      const meiFriend = MeiFriend.fromXmlString("<mei/>");
      const root = meiFriend.getRootElement()!;
      expect(root.id).toBeUndefined();
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
        '<mei><note xml:id="n1"/></mei>',
      );
      const note = meiFriend.getElementById("n1")!;
      meiFriend.update((tx) => note.remove(tx));
      expect(meiFriend.getElementById("n1")).toBeUndefined();
    });

    it("should remove itself even if it is the root (parent is XmlFragment)", () => {
      const meiFriend = MeiFriend.fromXmlString("<mei/>");
      const root = meiFriend.getRootElement()!;
      meiFriend.update((tx) => root.remove(tx));
      expect(meiFriend.getRootElement()).toBeUndefined();
    });

    it("should handle appendElement", () => {
      const meiFriend = MeiFriend.fromXmlString("<mei/>");
      const root = meiFriend.getRootElement()!;
      meiFriend.update((tx) => {
        root.appendElement(tx, "music");
      });
      expect(root.children.length).toBe(1);
      expect(root.children[0].tagName).toBe("music");
    });

    it("should handle insertBefore correctly", () => {
      const meiFriend = MeiFriend.fromXmlString(
        '<mei><note xml:id="n2"/></mei>',
      );
      const root = meiFriend.getRootElement()!;
      const n2 = meiFriend.getElementById("n2")!;

      meiFriend.update((tx) => {
        const n1 = root.insertBefore(tx, "note", n2);
        n1.setAttribute(tx, "xml:id", "n1");
      });

      const children = root.children;
      expect(children[0].id).toBe("n1");
      expect(children[1].id).toBe("n2");
    });

    it("should throw error if insertBefore reference is not a child", () => {
      const meiFriend = MeiFriend.fromXmlString("<mei><n1/><n2/></mei>");
      const n1 = meiFriend.getElementsByTagName("n1")[0];
      const n2 = meiFriend.getElementsByTagName("n2")[0];

      meiFriend.update((tx) => {
        expect(() => n1.insertBefore(tx, "note", n2)).toThrow(
          "Reference element is not a child of this element.",
        );
      });
    });

    it("should handle ensureChildElement", () => {
      const meiFriend = MeiFriend.fromXmlString("<mei/>");
      const root = meiFriend.getRootElement()!;

      const head1 = meiFriend.update((tx) =>
        root.ensureChildElement(tx, "meiHead"),
      );
      const head2 = meiFriend.update((tx) =>
        root.ensureChildElement(tx, "meiHead"),
      );

      expect(head1.yNode).toBe(head2.yNode);
      expect(root.children.length).toBe(1);
    });

    it("should set and get textContent and clear existing child elements", () => {
      const meiFriend = MeiFriend.fromXmlString("<mei><music/></mei>");
      const root = meiFriend.getRootElement()!;
      expect(root.children.length).toBe(1);

      meiFriend.update((tx) => root.setTextContent(tx, "Hello MEI"));
      expect(root.textContent).toBe("Hello MEI");
      expect(root.children.length).toBe(0);

      meiFriend.update((tx) => root.setTextContent(tx, "New Content"));
      expect(root.textContent).toBe("New Content");
    });
  });
});
