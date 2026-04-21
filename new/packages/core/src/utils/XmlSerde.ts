import { DOMParser } from "@xmldom/xmldom";
import * as Y from "yjs";
import type { IdGenerator } from "./IdGenerator.js";

export const ROOT_WRAPPER_TAG = "__root__" as const;
export const COMMENT_WRAPPER_TAG = "__comment__" as const;

export function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&"']/g, (m) => {
    switch (m) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      case "'":
        return "&apos;";
      default:
        return m;
    }
  });
}

function serializeYNode(
  yNode: Y.XmlFragment | Y.XmlElement | Y.XmlText,
  level = 0,
): string {
  const indent = "  ".repeat(level);

  if (yNode instanceof Y.XmlElement) {
    const name = yNode.nodeName;

    if (name === ROOT_WRAPPER_TAG) {
      const childrenStrs: string[] = [];
      for (const child of yNode.toArray()) {
        const serializedChild = serializeYNode(
          child as Y.XmlFragment | Y.XmlElement | Y.XmlText,
          level,
        );
        if (serializedChild) childrenStrs.push(serializedChild);
      }
      return childrenStrs.join("");
    }

    if (name === COMMENT_WRAPPER_TAG) {
      const commentText = yNode.get(0)?.toString() || "";
      return `${indent}<!--${commentText}-->`;
    }

    const attrs = yNode.getAttributes();
    let attrStr = "";

    const keys = Object.keys(attrs)
      .filter((key) => attrs[key] !== undefined)
      .sort((a, b) => {
        if (a === "xml:id") return -1;
        if (b === "xml:id") return 1;
        return a.localeCompare(b);
      });

    for (const key of keys) {
      attrStr += ` ${key}="${escapeXml(attrs[key])}"`;
    }

    const children = yNode.toArray();

    if (children.length === 0) {
      return `${indent}<${name}${attrStr}/>`;
    }

    const hasTextContent = children.some((child) => child instanceof Y.XmlText);

    if (hasTextContent) {
      const childrenStrs: string[] = [];
      for (const child of children) {
        childrenStrs.push(
          serializeYNode(child as Y.XmlFragment | Y.XmlElement | Y.XmlText, 0),
        );
      }
      return `${indent}<${name}${attrStr}>${childrenStrs.join("")}</${name}>`;
    }

    const childrenStrs: string[] = [];
    for (const child of children) {
      childrenStrs.push(
        serializeYNode(
          child as Y.XmlFragment | Y.XmlElement | Y.XmlText,
          level + 1,
        ),
      );
    }

    return `${indent}<${name}${attrStr}>\n${childrenStrs.join("\n")}\n${indent}</${name}>`;
  }

  if (yNode instanceof Y.XmlText) {
    return escapeXml(yNode.toString());
  }

  if (yNode instanceof Y.XmlFragment) {
    const childrenStrs: string[] = [];
    for (const child of yNode.toArray()) {
      const serializedChild = serializeYNode(
        child as Y.XmlFragment | Y.XmlElement | Y.XmlText,
        level,
      );
      if (serializedChild) childrenStrs.push(serializedChild);
    }
    return childrenStrs.join("\n");
  }

  return "";
}

export class XmlSerde {
  constructor(private readonly idGenerator: IdGenerator) {}

  serialize(
    yNode: Y.XmlFragment | Y.XmlElement | Y.XmlText,
    level = 0,
  ): string {
    return serializeYNode(yNode, level);
  }

  // biome-ignore lint/suspicious/noExplicitAny: xmldom Document compatibility
  parse(xmlString: string, targetId?: string | null): any {
    const parser = new DOMParser();
    const dom = parser.parseFromString(xmlString, "application/xml");

    const parserError = dom.getElementsByTagName("parsererror");
    if (parserError.length > 0) {
      throw new Error(`XML Parsing Error: ${parserError[0].textContent}`);
    }

    const newEl = dom.documentElement;
    if (!newEl) {
      throw new Error("Invalid XML provided for update.");
    }

    // biome-ignore lint/suspicious/noExplicitAny: xmldom Element compatibility
    const ensureIds = (el: any, isRoot: boolean) => {
      let id = el.getAttribute("xml:id") || el.getAttribute("id");
      if (isRoot && targetId) {
        if (id && id !== targetId) {
          throw new Error(
            `Update failed: ID mismatch. Target is "${targetId}", provided XML has "${id}"`,
          );
        }
        if (!id) {
          el.setAttribute("xml:id", targetId);
          id = targetId;
        }
      } else if (!id) {
        id = this.idGenerator.generate(el.nodeName.toLowerCase());
        el.setAttribute("xml:id", id);
      }

      const children = el.childNodes;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        // Node.ELEMENT_NODE
        if (child.nodeType === 1) {
          // biome-ignore lint/suspicious/noExplicitAny: xmldom Element compatibility
          ensureIds(child as any, false);
        }
      }
    };
    ensureIds(newEl, true);

    return dom;
  }

  populateFromDom(domNode: Node, yParent: Y.XmlFragment | Y.XmlElement): void {
    for (let i = 0; i < domNode.childNodes.length; i++) {
      const child = domNode.childNodes[i];
      switch (child.nodeType) {
        // Node.ELEMENT_NODE
        case 1: {
          const el = child as Element;
          const yElement = new Y.XmlElement(el.nodeName);
          const attrs = el.attributes;
          for (let j = 0; j < attrs.length; j++) {
            const attr = attrs[j];
            yElement.setAttribute(attr.name, attr.value);
          }
          yParent.push([yElement]);
          this.populateFromDom(el, yElement);
          break;
        }
        // Node.TEXT_NODE
        case 3: {
          const textValue = (child as Text).nodeValue;
          if (textValue && textValue.trim() === "") break;
          if (textValue) {
            const yText = new Y.XmlText(textValue);
            yParent.push([yText]);
          }
          break;
        }
        // Node.COMMENT_NODE
        case 8: {
          const commentValue = (child as Comment).nodeValue;
          if (commentValue) {
            const yElement = new Y.XmlElement(COMMENT_WRAPPER_TAG);
            const yText = new Y.XmlText(commentValue);
            yParent.push([yElement]);
            yElement.push([yText]);
          }
          break;
        }
      }
    }
  }
}
