import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

/**
 * Generates unique IDs for MEI elements.
 */
export class IdGenerator {
  private counter = 0;

  constructor(private readonly seed: number | null = null) {}

  /**
   * Generates a unique ID with the given prefix.
   */
  public generate(prefix: string): string {
    if (this.seed !== null) {
      this.counter++;
      return `${prefix}-${this.seed}-${this.counter}`;
    }
    return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Assigns unique xml:id to all elements in the XML string that don't have one.
   *
   * @param xmlString The XML string to process.
   * @param rootId Optional. If provided, forces the root element to have this ID.
   * @returns The XML string with IDs assigned.
   */
  public assignIds(xmlString: string, rootId?: string): string {
    const parser = new DOMParser();
    const dom = parser.parseFromString(xmlString, "application/xml");

    // biome-ignore lint/suspicious/noExplicitAny: xmldom Element compatibility
    const ensureIds = (el: any) => {
      if (!el.getAttribute("xml:id") && !el.getAttribute("id")) {
        el.setAttribute("xml:id", this.generate(el.tagName.toLowerCase()));
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
}
