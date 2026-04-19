import * as Y from "yjs";
import { serializeYNode } from "./utils/serialize.js";

/**
 * MeiElement wraps a Y.XmlElement and provides a clean API for DOM operations
 * within a MeiFriend document.
 *
 * This class is a Read-only view of a Y.XmlElement. For all document modifications,
 * use `MeiFriend.update(xmlId, xmlString)`.
 *
 * **Constraint**: Every MeiElement must have a valid `xml:id`. If the underlying
 * Y.XmlElement is missing an ID, the constructor will throw an Error.
 */
export class MeiElement {
  /**
   * The xml:id or id of the element. Guaranteed to be present.
   */
  public readonly id: string;

  constructor(public readonly yNode: Y.XmlElement) {
    const id = yNode.getAttribute("xml:id") || yNode.getAttribute("id");
    if (!id) {
      throw new Error(
        `MeiElement validation failed: Every element must have an xml:id. Tag: <${yNode.nodeName}>`,
      );
    }
    this.id = id;
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
      if (parent.nodeName === "__root__") return undefined;
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

  // --------------------------------------------------------------------------
  // Immutable Mutation API
  // --------------------------------------------------------------------------

  /**
   * Creates a clone of this element, applies the given recipe to the clone,
   * and returns a new MeiElement wrapping the modified clone.
   *
   * The returned element is detached from the document and can be used to
   * update the original via `MeiFriend.update(id, newElement.toXmlString())`.
   *
   * **Note**: If the recipe removes the `xml:id` or the resulting element structure
   * is invalid according to MeiElement constraints, this method will throw an Error.
   *
   * @param recipe A function that modifies the cloned Y.XmlElement.
   */
  public produce(recipe: (draft: Y.XmlElement) => void): MeiElement {
    const clone = this.yNode.clone();
    // In Yjs, a cloned node must be attached to a Y.Doc before its attributes
    // or children can be accessed. We use a temporary document for this purpose.
    const tempDoc = new Y.Doc();
    tempDoc.getXmlFragment("tmp").push([clone]);

    recipe(clone);
    return new MeiElement(clone);
  }

  // --------------------------------------------------------------------------
  // Serialize
  // --------------------------------------------------------------------------

  /**
   * Returns the XML string representation of this element.
   */
  toXmlString(): string {
    return serializeYNode(this.yNode, 0);
  }
}
