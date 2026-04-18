import * as Y from "yjs";
import type { MeiFriend } from "./MeiFriend.js";
import { addElement, replaceElement } from "./MeiUpdate.js";
import { generateId } from "./utils/id.js";

/**
 * MeiElement wraps a Y.XmlElement and provides a clean API for DOM operations
 * within a MeiFriend document.
 */
export class MeiElement {
  constructor(
    public readonly yNode: Y.XmlElement,
    public readonly doc: MeiFriend,
  ) {}

  /**
   * The xml:id or id of the element.
   */
  get id(): string | undefined {
    return this.getAttribute("xml:id") || this.getAttribute("id");
  }

  /**
   * The tag name of the element (e.g., "note", "meiHead").
   */
  get tagName(): string {
    return this.yNode.nodeName;
  }

  /**
   * Returns all direct child elements.
   */
  get children(): MeiElement[] {
    return this.yNode
      .toArray()
      .filter((child): child is Y.XmlElement => child instanceof Y.XmlElement)
      .map((child) => new MeiElement(child, this.doc));
  }

  /**
   * Returns the parent element, or undefined if it is the root.
   */
  get parentElement(): MeiElement | undefined {
    const parent = this.yNode.parent;
    if (parent instanceof Y.XmlElement) {
      return new MeiElement(parent, this.doc);
    }
    return undefined;
  }

  /**
   * Returns the next sibling element.
   */
  get nextElementSibling(): MeiElement | undefined {
    const parent = this.yNode.parent;
    if (parent instanceof Y.XmlElement || parent instanceof Y.XmlFragment) {
      const siblings = parent.toArray();
      const index = siblings.indexOf(this.yNode);
      if (index !== -1) {
        for (let i = index + 1; i < siblings.length; i++) {
          const sibling = siblings[i];
          if (sibling instanceof Y.XmlElement) {
            return new MeiElement(sibling, this.doc);
          }
        }
      }
    }
    return undefined;
  }

  /**
   * Returns the previous sibling element.
   */
  get previousElementSibling(): MeiElement | undefined {
    const parent = this.yNode.parent;
    if (parent instanceof Y.XmlElement || parent instanceof Y.XmlFragment) {
      const siblings = parent.toArray();
      const index = siblings.indexOf(this.yNode);
      if (index !== -1) {
        for (let i = index - 1; i >= 0; i--) {
          const sibling = siblings[i];
          if (sibling instanceof Y.XmlElement) {
            return new MeiElement(sibling, this.doc);
          }
        }
      }
    }
    return undefined;
  }

  /**
   * Returns the value of the specified attribute.
   */
  getAttribute(name: string): string | undefined {
    return this.yNode.getAttribute(name);
  }

  /**
   * Returns all attributes as a record.
   * Only attributes with defined string values are included.
   */
  getAttributes(): Record<string, string> {
    const attrs = this.yNode.getAttributes();
    const result: Record<string, string> = {};
    for (const key in attrs) {
      const value = attrs[key];
      if (value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Returns all descendant elements with the given tag name.
   */
  getElementsByTagName(tagName: string): MeiElement[] {
    const result: MeiElement[] = [];
    const traverse = (node: Y.XmlElement) => {
      const length = node.length;
      for (let i = 0; i < length; i++) {
        const child = node.get(i);
        if (child instanceof Y.XmlElement) {
          if (child.nodeName === tagName) {
            result.push(new MeiElement(child, this.doc));
          }
          traverse(child);
        }
      }
    };
    traverse(this.yNode);
    return result;
  }

  /**
   * Returns the concatenated text content of the element.
   * Traverses all descendant nodes recursively.
   */
  get textContent(): string {
    const texts: string[] = [];
    const traverse = (node: Y.XmlElement) => {
      const length = node.length;
      for (let i = 0; i < length; i++) {
        const child = node.get(i);
        if (child instanceof Y.XmlText) {
          texts.push(child.toString());
        } else if (child instanceof Y.XmlElement) {
          traverse(child);
        }
      }
    };
    traverse(this.yNode);
    return texts.join("");
  }

  /**
   * Returns a direct child element by tag name.
   */
  getChildElement(tagName: string): MeiElement | undefined {
    const yChild = this.yNode
      .toArray()
      .find(
        (child): child is Y.XmlElement =>
          child instanceof Y.XmlElement && child.nodeName === tagName,
      );
    return yChild ? new MeiElement(yChild, this.doc) : undefined;
  }

  /**
   * Access mutation operations for this element.
   */
  get mutation(): Mutation {
    return new Mutation(this);
  }
}

/**
 * Mutation handles destructive operations on a MeiElement.
 */
export class Mutation {
  constructor(private readonly element: MeiElement) {}

  /**
   * Gets an existing child element by tag name, or creates it if it doesn't exist.
   * Requires the parent element to have an id.
   * @param tagName The tag name of the child.
   * @returns The existing or newly created child element.
   */
  getOrCreateChild(tagName: string): MeiElement {
    const existing = this.element.getChildElement(tagName);
    if (existing) {
      return existing;
    }

    const parentId = this.element.id;
    if (!parentId) {
      throw new Error(
        `Cannot create child <${tagName}> on an element without an id.`,
      );
    }

    const newId = generateId(tagName.toLowerCase());
    this.element.doc.update(addElement(parentId, tagName, newId));

    // Retrieve via DOM traversal instead of getElementById because idMap index
    // might not be updated yet if this is called within a batch transaction.
    const newElement = this.element.getChildElement(tagName);
    if (!newElement) {
      throw new Error(
        `Failed to create or retrieve new child <${tagName}> with id ${newId}.`,
      );
    }
    return newElement;
  }

  /**
   * Replaces this element's attributes and children with the content of the provided MEI XML string.
   * This is a destructive operation that maintains the Yjs identity of this element but
   * recreates all its descendants.
   * @param xml The new MEI XML string.
   * @param origin The origin of the update (optional).
   */
  replaceWith(
    xml: string,
    // biome-ignore lint/suspicious/noExplicitAny: origin is any type, via the yjs interface.
    origin?: any,
  ): void {
    const myId = this.element.id;
    if (!myId) {
      console.warn("Cannot replace elements without IDs.");
      return;
    }
    this.element.doc.update(replaceElement(myId, xml), origin);
  }
}
