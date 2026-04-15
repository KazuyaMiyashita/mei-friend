import * as Y from "yjs";
import type { MeiFriend, MeiTransaction } from "./MeiFriend.js";

/**
 * MeiElement wraps a Y.XmlElement and provides a clean API for DOM operations
 * within a MeiFriend document.
 * All modifying operations require a `MeiTransaction` token, ensuring they
 * are performed within a `meiFriend.update()` block.
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
   * Sets the value of the specified attribute.
   * Requires a transaction token (tx).
   */
  setAttribute(_tx: MeiTransaction, name: string, value: string): void {
    // tx is required by type, ensuring this is called within update()
    this.yNode.setAttribute(name, value);
  }

  /**
   * Removes the specified attribute.
   */
  removeAttribute(_tx: MeiTransaction, name: string): void {
    this.yNode.removeAttribute(name);
  }

  /**
   * Returns all descendant elements with the given tag name.
   */
  getElementsByTagName(tagName: string): MeiElement[] {
    return this.doc.getElementsByTagNameInternal(this.yNode, tagName);
  }

  /**
   * Returns the concatenated text content of the element.
   */
  get textContent(): string {
    return this.yNode
      .toArray()
      .filter((child): child is Y.XmlText => child instanceof Y.XmlText)
      .map((text) => text.toString())
      .join("");
  }

  /**
   * Sets the text content of the element, replacing all existing children.
   */
  setTextContent(_tx: MeiTransaction, text: string): void {
    const length = this.yNode.toArray().length;
    if (length > 0) {
      this.yNode.delete(0, length);
    }
    this.yNode.insert(0, [new Y.XmlText(text)]);
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
   * Returns a direct child element by tag name, creating it if it doesn't exist.
   */
  ensureChildElement(_tx: MeiTransaction, tagName: string): MeiElement {
    const existing = this.getChildElement(tagName);
    if (existing) return existing;

    const yNew = new Y.XmlElement(tagName);
    this.yNode.push([yNew]);
    return new MeiElement(yNew, this.doc);
  }

  /**
   * Appends a new child element with the given tag name.
   */
  appendElement(_tx: MeiTransaction, tagName: string): MeiElement {
    const yNew = new Y.XmlElement(tagName);
    this.yNode.push([yNew]);
    return new MeiElement(yNew, this.doc);
  }

  /**
   * Inserts a new element before a reference element.
   */
  insertBefore(
    _tx: MeiTransaction,
    tagName: string,
    referenceElement: MeiElement,
  ): MeiElement {
    const index = this.yNode.toArray().indexOf(referenceElement.yNode);
    if (index === -1) {
      throw new Error("Reference element is not a child of this element.");
    }
    const yNew = new Y.XmlElement(tagName);
    this.yNode.insert(index, [yNew]);
    return new MeiElement(yNew, this.doc);
  }

  /**
   * Removes this element from its parent.
   */
  remove(_tx: MeiTransaction): void {
    const parent = this.yNode.parent;
    if (parent instanceof Y.XmlElement || parent instanceof Y.XmlFragment) {
      const index = parent.toArray().indexOf(this.yNode);
      if (index !== -1) {
        parent.delete(index, 1);
      }
    }
  }
}
