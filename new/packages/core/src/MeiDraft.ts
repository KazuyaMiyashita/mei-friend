import * as Y from "yjs";

/**
 * Mutable wrapper around a Y.XmlElement that lives inside a `produceElement` recipe.
 * All operations are scoped to the same temporary Y.Doc, so every element created
 * here can be freely inserted without cross-doc errors.
 *
 * **ID policy**: xml:id is optional on draft elements. Any element without an xml:id
 * will have one auto-assigned when `MeiFriend.produceElement` returns, before the
 * result is wrapped in `MeiElement`.
 *
 * Obtain a MeiDraft only via `MeiFriend.produceElement`.
 */
export class MeiDraft {
  constructor(readonly yNode: Y.XmlElement) {}

  /**
   * The xml:id of the element, or `undefined` if not yet assigned.
   * The top-level draft always has an id (it is a clone of an existing MeiElement).
   * Newly inserted children may not have one until `produceElement` returns.
   */
  get id(): string | undefined {
    return (
      this.yNode.getAttribute("xml:id") ??
      this.yNode.getAttribute("id") ??
      undefined
    );
  }

  /** The tag name of the element (e.g., "note", "meiHead"). */
  get tagName(): string {
    return this.yNode.nodeName;
  }

  /** Returns all direct child elements as MeiDraft instances. */
  get children(): MeiDraft[] {
    return this.yNode
      .toArray()
      .filter((c): c is Y.XmlElement => c instanceof Y.XmlElement)
      .map((c) => new MeiDraft(c));
  }

  getAttribute(name: string): string | undefined {
    return this.yNode.getAttribute(name) ?? undefined;
  }

  setAttribute(name: string, value: string): this {
    this.yNode.setAttribute(name, value);
    return this;
  }

  removeAttribute(name: string): this {
    this.yNode.removeAttribute(name);
    return this;
  }

  /**
   * Returns a MeiDraft for the first direct child with the given tag name.
   * If no such child exists, creates one and inserts it at `insertIndex` (default: 0).
   * The new element has no xml:id yet; one will be assigned by `produceElement`.
   */
  getOrInsertChild(tagName: string, insertIndex = 0): MeiDraft {
    const existing = this.yNode
      .toArray()
      .find(
        (c): c is Y.XmlElement =>
          c instanceof Y.XmlElement && c.nodeName === tagName,
      );
    if (existing) return new MeiDraft(existing);
    const el = new Y.XmlElement(tagName);
    this.yNode.insert(insertIndex, [el]);
    return new MeiDraft(el);
  }

  /**
   * Replaces all content with a single text node containing `text`.
   */
  setTextContent(text: string): this {
    this.yNode.delete(0, this.yNode.length);
    this.yNode.insert(0, [new Y.XmlText(text)]);
    return this;
  }

  /** Returns all direct children as a flat array (Y.XmlElement | Y.XmlText). */
  toArray(): (Y.XmlElement | Y.XmlText)[] {
    return this.yNode
      .toArray()
      .filter(
        (c): c is Y.XmlElement | Y.XmlText =>
          c instanceof Y.XmlElement || c instanceof Y.XmlText,
      );
  }

  /** Inserts `content` at `index`. */
  insert(index: number, content: (Y.XmlElement | Y.XmlText)[]): void {
    this.yNode.insert(index, content);
  }

  /** Deletes `length` children starting at `index`. */
  delete(index: number, length: number): void {
    this.yNode.delete(index, length);
  }

  /**
   * Removes all direct child elements whose tag name matches `tagName`.
   * Iterates in reverse so deletions don't shift unvisited indices.
   */
  removeChildrenByTag(tagName: string): this {
    const arr = this.yNode.toArray();
    for (let i = arr.length - 1; i >= 0; i--) {
      const c = arr[i];
      if (c instanceof Y.XmlElement && c.nodeName === tagName) {
        this.yNode.delete(i, 1);
      }
    }
    return this;
  }
}
