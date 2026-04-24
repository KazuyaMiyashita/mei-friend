import * as Y from "yjs";
import { ROOT_WRAPPER_TAG } from "./utils/XmlSerde.js";

/**
 * MeiElement wraps a Y.XmlElement and provides a clean API for DOM operations
 * within a MeiFriend document.
 *
 * This class is a read-only view of a Y.XmlElement. For all document modifications,
 * use `MeiFriend.updateElement()`, `MeiFriend.updateXmlString()`, or `MeiFriend.produceElement()`.
 *
 * **Constraint**: Every MeiElement retrieved from MeiFriend will have an `xml:id`.
 */
export class MeiElement {
  private readonly _id: string;

  constructor(public readonly yNode: Y.XmlElement) {
    const resolvedId = yNode.getAttribute("xml:id") ?? yNode.getAttribute("id");
    if (!resolvedId) {
      throw new Error(
        `MeiElement: <${yNode.nodeName}> has no xml:id. All elements must have a unique xml:id.`,
      );
    }
    this._id = resolvedId;
  }

  /**
   * The xml:id or id of the element. Guaranteed non-empty by the constructor.
   */
  get id(): string {
    return this._id;
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
      .map((child) => new MeiElement(child));
  }

  /**
   * Returns the parent element, or undefined if it is the root.
   */
  get parentElement(): MeiElement | undefined {
    const parent = this.yNode.parent;
    if (parent instanceof Y.XmlElement) {
      if (parent.nodeName === ROOT_WRAPPER_TAG) return undefined;
      return new MeiElement(parent);
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
            return new MeiElement(sibling);
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
            return new MeiElement(sibling);
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
            result.push(new MeiElement(child));
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
    return yChild ? new MeiElement(yChild) : undefined;
  }

  /**
   * Returns the first direct child matched by `Clazz.create()`, or `undefined`.
   */
  findChild<T extends MeiElement>(Clazz: {
    create: (el: MeiElement) => T | undefined;
  }): T | undefined {
    for (const child of this.children) {
      const instance = Clazz.create(child);
      if (instance) return instance;
    }
    return undefined;
  }

  /**
   * Returns all direct children matched by `Clazz.create()`.
   */
  findChildren<T extends MeiElement>(Clazz: {
    create: (el: MeiElement) => T | undefined;
  }): ReadonlyArray<T> {
    const results: T[] = [];
    for (const child of this.children) {
      const instance = Clazz.create(child);
      if (instance) {
        results.push(instance);
      }
    }
    return results;
  }

  /**
   * Finds the first descendant element that matches the given class.
   * @param Clazz A class with a static create method.
   * @returns An instance of T, or undefined if not found.
   */
  findDescendant<T extends MeiElement>(Clazz: {
    create: (el: MeiElement) => T | undefined;
  }): T | undefined {
    let found: T | undefined;

    const traverse = (node: Y.XmlElement): boolean => {
      const length = node.length;
      for (let i = 0; i < length; i++) {
        const child = node.get(i);
        if (child instanceof Y.XmlElement) {
          const instance = Clazz.create(new MeiElement(child));
          if (instance) {
            found = instance;
            return true;
          }
          if (traverse(child)) return true;
        }
      }
      return false;
    };

    traverse(this.yNode);
    return found;
  }

  /**
   * Finds all descendant elements that match the given class.
   * @param Clazz A class with a static create method.
   * @returns An array of instances of T.
   */
  findDescendants<T extends MeiElement>(Clazz: {
    create: (el: MeiElement) => T | undefined;
  }): T[] {
    const result: T[] = [];

    const traverse = (node: Y.XmlElement) => {
      const length = node.length;
      for (let i = 0; i < length; i++) {
        const child = node.get(i);
        if (child instanceof Y.XmlElement) {
          const instance = Clazz.create(new MeiElement(child));
          if (instance) result.push(instance);
          traverse(child);
        }
      }
    };

    traverse(this.yNode);
    return result;
  }
}
