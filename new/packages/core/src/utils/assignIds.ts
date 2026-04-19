import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { generateId } from "./id.js";

/**
 * Assigns unique xml:id to all elements in the XML string that don't have one.
 *
 * @param xmlString The XML string to process.
 * @param rootId Optional. If provided, forces the root element to have this ID.
 * @returns The XML string with IDs assigned.
 */
export function assignIds(xmlString: string, rootId?: string): string {
  const parser = new DOMParser();
  const dom = parser.parseFromString(xmlString, "application/xml");

  // biome-ignore lint/suspicious/noExplicitAny: xmldom Element compatibility
  const ensureIds = (el: any) => {
    if (!el.getAttribute("xml:id") && !el.getAttribute("id")) {
      el.setAttribute("xml:id", generateId(el.tagName.toLowerCase()));
    }
    const children = el.childNodes;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.nodeType === 1) {
        // Element
        // biome-ignore lint/suspicious/noExplicitAny: xmldom Element compatibility
        ensureIds(child as any);
      }
    }
  };

  if (dom.documentElement) {
    if (rootId) {
      dom.documentElement.setAttribute("xml:id", rootId);
    }
    ensureIds(dom.documentElement);
  }

  const serializer = new XMLSerializer();
  return serializer.serializeToString(dom);
}
