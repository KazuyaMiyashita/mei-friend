import { DOMParser } from "@xmldom/xmldom";
import * as Y from "yjs";

/**
 * MeiFriend represents a single Music Encoding Initiative (MEI) score.
 * It provides utility APIs for querying and updating XML elements and
 * manages the complete history of changes.
 *
 * While offering an interface tailored to the general needs of MEI score
 * handling, it also supports advanced editing operations such as bidirectional
 * synchronization within complex applications and real-time collaborative editing.
 * To enable these features, it is built on top of the Yjs framework.
 *
 * MeiFriend handles only well-formed XML and manages internal state by focusing
 * strictly on structural elements and attributes. Consequently, it intentionally
 * ignores the following:
 * - Insignificant whitespace (e.g., indentation) between elements.
 * - XML Comments (`<!-- ... -->`).
 * - CDATA sections.
 * - XML Declarations (`<?xml ... ?>`).
 * - The order of attributes.
 */
export class MeiFriend {
  // --------------------------------------------------------------------------
  // Public Properties & Lifecycle
  // --------------------------------------------------------------------------

  /** The underlying Yjs document. */
  public readonly doc: Y.Doc;
  /** Manager for undo/redo history. */
  public readonly undoManager: Y.UndoManager;
  /** The root XML fragment (usually containing the <mei> element). */
  private readonly xmlRoot: Y.XmlFragment;
  /** Internal index for fast O(1) element lookup by xml:id. */
  private readonly idMap = new Map<string, Y.XmlElement>();

  constructor(doc?: Y.Doc) {
    this.doc = doc ?? new Y.Doc();
    this.xmlRoot = this.doc.getXmlFragment("mei");
    this.undoManager = new Y.UndoManager(this.xmlRoot);

    this.initializeIdIndex();
  }

  /**
   * Creates a new MeiFriend instance from an MEI XML string.
   * @param xmlString The MEI XML string to parse.
   * @returns A new MeiFriend instance.
   * @throws {Error} If the provided XML string is not well-formed.
   */
  public static fromXmlString(xmlString: string): MeiFriend {
    const instance = new MeiFriend();
    const parser = new DOMParser();
    const dom = parser.parseFromString(xmlString, "application/xml");

    // Check for parsing errors
    const parserError = dom.getElementsByTagName("parsererror");
    if (parserError.length > 0) {
      throw new Error(`XML Parsing Error: ${parserError[0].textContent}`);
    }

    instance.doc.transact(() => {
      // Populate from DOM
      instance.populateFromDom(dom as unknown as Node, instance.xmlRoot);
    });

    // Clear undo history after initial load
    instance.undoManager.clear();

    return instance;
  }

  /**
   * Serializes the current state back to an MEI XML string.
   * The output is formatted with 2-space indentation and a trailing newline.
   * @returns The MEI XML string.
   */
  public toXmlString(): string {
    const serialized = this.serializeYNode(this.xmlRoot, 0);
    return serialized ? `${serialized}\n` : "";
  }

  /**
   * Wraps multiple operations into a single transaction/undo-step.
   * Aligns with Yjs's transact interface.
   * @param fn The function to execute within the transaction.
   * @param origin The origin of the transaction (optional).
   */
  public transact(
    fn: (transaction: Y.Transaction) => void,
    // biome-ignore lint/suspicious/noExplicitAny: origin is any type, via the yjs interface.
    origin?: any,
  ): void {
    this.doc.transact(fn, origin);
  }

  // --------------------------------------------------------------------------
  // Query API
  // --------------------------------------------------------------------------

  /**
   * Returns an element by its xml:id. Fast O(1) lookup.
   * @param xmlId The xml:id of the element to find.
   * @returns The element if found, otherwise undefined.
   */
  public getElementById(xmlId: string): Y.XmlElement | undefined {
    return this.idMap.get(xmlId);
  }

  /**
   * Returns all elements with the given tag name (e.g., "note", "measure").
   * @param tagName The name of the tag to search for.
   * @returns An array of matching elements.
   */
  public getElementsByTagName(tagName: string): Y.XmlElement[] {
    const result: Y.XmlElement[] = [];
    const traverse = (node: Y.XmlFragment | Y.XmlElement) => {
      for (const child of node.toArray()) {
        if (child instanceof Y.XmlElement) {
          if (child.nodeName === tagName) {
            result.push(child);
          }
          traverse(child);
        }
      }
    };
    traverse(this.xmlRoot);
    return result;
  }

  /**
   * Returns the parent element of the specified element.
   * @param xmlId The xml:id of the child element.
   * @returns The parent element if found and is an XmlElement, otherwise undefined.
   */
  public getParentElement(xmlId: string): Y.XmlElement | undefined {
    const el = this.getElementById(xmlId);
    return el?.parent instanceof Y.XmlElement ? el.parent : undefined;
  }

  // --------------------------------------------------------------------------
  // Mutation API
  // --------------------------------------------------------------------------

  /**
   * Sets an attribute on the specified element.
   * @param xmlId The xml:id of the element to modify.
   * @param name The name of the attribute to set.
   * @param value The value of the attribute.
   * @param origin Optional transaction origin.
   */
  public setAttribute(
    xmlId: string,
    name: string,
    value: string,
    // biome-ignore lint/suspicious/noExplicitAny: origin is any type, via the yjs interface.
    origin?: any,
  ): void {
    const el = this.getElementById(xmlId);
    if (el) {
      this.transact(() => el.setAttribute(name, value), origin);
    }
  }

  /**
   * Removes an attribute from the specified element.
   * @param xmlId The xml:id of the element to modify.
   * @param name The name of the attribute to remove.
   * @param origin Optional transaction origin.
   */
  public removeAttribute(
    xmlId: string,
    name: string,
    // biome-ignore lint/suspicious/noExplicitAny: origin is any type, via the yjs interface.
    origin?: any,
  ): void {
    const el = this.getElementById(xmlId);
    if (el) {
      this.transact(() => el.removeAttribute(name), origin);
    }
  }

  /**
   * Inserts a new element or moves an existing one.
   * @param parentXmlId The xml:id of the parent element.
   * @param element The Y.XmlElement to insert.
   * @param index The position to insert at. If omitted, appends to the end.
   * @param origin Optional transaction origin.
   */
  public insertElement(
    parentXmlId: string,
    element: Y.XmlElement,
    index?: number,
    // biome-ignore lint/suspicious/noExplicitAny: origin is any type, via the yjs interface.
    origin?: any,
  ): void {
    const parent = this.getElementById(parentXmlId);
    if (parent) {
      this.transact(() => {
        if (index === undefined) {
          parent.push([element]);
        } else {
          parent.insert(index, [element]);
        }
      }, origin);
    }
  }

  /**
   * Removes an element from the score.
   * @param xmlId The xml:id of the element to remove.
   * @param origin Optional transaction origin.
   */
  public removeElement(
    xmlId: string,
    // biome-ignore lint/suspicious/noExplicitAny: origin is any type, via the yjs interface.
    origin?: any,
  ): void {
    const el = this.getElementById(xmlId);
    if (el) {
      const parent = el.parent;
      if (parent instanceof Y.XmlElement || parent instanceof Y.XmlFragment) {
        // Use indexOf on toArray() to avoid O(N^2) loop
        const index = parent.toArray().indexOf(el);
        if (index !== -1) {
          this.transact(() => parent.delete(index, 1), origin);
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Event API
  // --------------------------------------------------------------------------

  /**
   * Registers a callback for when the score changes.
   */
  public onChange(
    callback: (events: Y.YXmlEvent[], transaction: Y.Transaction) => void,
  ): void {
    this.xmlRoot.observeDeep(
      // biome-ignore lint/suspicious/noExplicitAny: Y.YEvent expects a type extending AbstractType<any>
      callback as (events: Y.YEvent<any>[], transaction: Y.Transaction) => void,
    );
  }

  // --------------------------------------------------------------------------
  // Private Methods
  // --------------------------------------------------------------------------

  /** Sets up observers to maintain the idMap. */
  private initializeIdIndex(): void {
    this.xmlRoot.observeDeep((events) => {
      for (const event of events) {
        if (event instanceof Y.YXmlEvent) {
          // Attribute changes
          if (
            event.attributesChanged.has("xml:id") ||
            event.attributesChanged.has("id")
          ) {
            this.buildIdMap(event.target as Y.XmlElement);
          }

          // Added nodes
          event.changes.added.forEach((item) => {
            if (item.content instanceof Y.ContentType) {
              const content = item.content.type;
              if (content instanceof Y.XmlElement) {
                this.buildIdMap(content);
              }
            }
          });

          // Deleted nodes
          event.changes.deleted.forEach((item) => {
            if (item.content instanceof Y.ContentType) {
              const content = item.content.type;
              if (content instanceof Y.XmlElement) {
                this.removeFromIdMap(content);
              }
            }
          });
        }
      }
    });
  }

  /** Recursively populates idMap from a Yjs XML node. */
  private buildIdMap(node: Y.XmlFragment | Y.XmlElement): void {
    if (node instanceof Y.XmlElement) {
      const id = node.getAttribute("xml:id") || node.getAttribute("id");
      if (id) {
        this.idMap.set(id, node);
      }
    }
    for (const child of node.toArray()) {
      if (child instanceof Y.XmlElement) {
        this.buildIdMap(child);
      }
    }
  }

  /** Recursively removes detached nodes and their children from the idMap. */
  private removeFromIdMap(node: Y.XmlElement): void {
    const id = node.getAttribute("xml:id") || node.getAttribute("id");
    if (id && this.idMap.get(id) === node) {
      this.idMap.delete(id);
    }
    for (const child of node.toArray()) {
      if (child instanceof Y.XmlElement) {
        this.removeFromIdMap(child);
      }
    }
  }

  private populateFromDom(
    domNode: Node,
    yParent: Y.XmlFragment | Y.XmlElement,
  ): void {
    for (let i = 0; i < domNode.childNodes.length; i++) {
      const child = domNode.childNodes[i];
      switch (child.nodeType) {
        case 1: {
          // Element
          const el = child as Element;
          const yElement = new Y.XmlElement(el.nodeName);

          // Set attributes
          const attrs = el.attributes;
          for (let j = 0; j < attrs.length; j++) {
            const attr = attrs[j];
            yElement.setAttribute(attr.name, attr.value);
          }

          yParent.push([yElement]);
          this.populateFromDom(el, yElement);

          // Initial indexing
          const id =
            yElement.getAttribute("xml:id") || yElement.getAttribute("id");
          if (id) {
            this.idMap.set(id, yElement);
          }
          break;
        }
        case 3: {
          // Text
          // Ignore whitespace-only text nodes when populating from DOM
          const textValue = (child as Text).nodeValue;
          if (textValue && textValue.trim() !== "") {
            const yText = new Y.XmlText(textValue);
            yParent.push([yText]);
          }
          break;
        }
      }
    }
  }

  private serializeYNode(
    yNode: Y.XmlFragment | Y.XmlElement | Y.XmlText,
    level: number,
  ): string {
    // In the future, it might be a good idea to allow users to specify the formatter.
    const indent = "  ".repeat(level);

    if (yNode instanceof Y.XmlElement) {
      const name = yNode.nodeName;
      const attrs = yNode.getAttributes();
      let attrStr = "";

      // Yjs does not maintain the order of attributes.
      // To make it deterministic, the xml:id is placed first, and the rest are in alphabetical order.
      // There is room for improvement, such as placing the most important elements first.
      const keys = Object.keys(attrs).sort((a, b) => {
        if (a === "xml:id") return -1;
        if (b === "xml:id") return 1;
        return a.localeCompare(b);
      });

      for (const key of keys) {
        attrStr += ` ${key}="${attrs[key]}"`;
      }

      const children = yNode.toArray();

      if (children.length === 0) {
        return `${indent}<${name}${attrStr}/>`;
      }

      // Check if the element contains only text
      const isTextOnly =
        children.length === 1 && children[0] instanceof Y.XmlText;

      if (isTextOnly) {
        const textContent = this.serializeYNode(children[0] as Y.XmlText, 0);
        return `${indent}<${name}${attrStr}>${textContent}</${name}>`;
      }

      const childrenStrs: string[] = [];
      for (const child of children) {
        childrenStrs.push(
          this.serializeYNode(
            child as Y.XmlFragment | Y.XmlElement | Y.XmlText,
            level + 1,
          ),
        );
      }

      return `${indent}<${name}${attrStr}>\n${childrenStrs.join("\n")}\n${indent}</${name}>`;
    } else if (yNode instanceof Y.XmlText) {
      return yNode.toString();
    } else if (yNode instanceof Y.XmlFragment) {
      const childrenStrs: string[] = [];
      for (const child of yNode.toArray()) {
        childrenStrs.push(
          this.serializeYNode(
            child as Y.XmlFragment | Y.XmlElement | Y.XmlText,
            level, // Fragments don't increase indent
          ),
        );
      }
      return childrenStrs.join("\n");
    }
    return "";
  }
}
