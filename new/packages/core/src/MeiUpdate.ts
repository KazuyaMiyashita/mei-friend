import type { MeiElement } from "./MeiElement.js";

/**
 * Represents a discrete update to the MEI document structure.
 */
export type MeiUpdate =
  | {
      type: "setAttribute";
      /** The xml:id of the target element. */
      targetId: string;
      /** The name of the attribute to set or update. */
      name: string;
      /** The new value for the attribute. */
      value: string;
    }
  | {
      type: "removeAttribute";
      /** The xml:id of the target element. */
      targetId: string;
      /** The name of the attribute to remove. */
      name: string;
    }
  | {
      type: "setTextContent";
      /** The xml:id of the target element. */
      targetId: string;
      /** The new text content. Note: This will replace all existing child elements and text nodes of the target. */
      text: string;
    }
  | {
      type: "updateElement";
      /** The xml:id of the target element. */
      targetId: string;
      /**
       * Key-value pairs of attributes to update.
       * Set a value to `null` to explicitly remove that attribute.
       */
      attributes?: Record<string, string | null>;
      /** Optional new text content. If provided, it replaces all existing child elements and text nodes. */
      text?: string;
    }
  | {
      type: "addElement";
      /** The xml:id of the parent element where this new element will be inserted. */
      parentId: string;
      /** The XML tag name for the new element (e.g., "note", "measure"). */
      tagName: string;
      /** The unique xml:id for the new element. This is strictly required for document tracking. */
      id: string;
      /** Optional initial attributes for the new element. */
      attributes?: Record<string, string>;
      /** Optional initial text content for the new element. */
      text?: string;
      /**
       * The zero-based index at which to insert the new element among its siblings.
       * If omitted, the element is appended to the end of the parent's children.
       */
      index?: number;
    }
  | {
      type: "removeElement";
      /** The xml:id of the element to completely remove from the document. */
      targetId: string;
    }
  | {
      type: "replaceElement";
      /** The xml:id of the existing element to replace. */
      targetId: string;
      /**
       * The new MEI XML string for this element.
       * This must be a well-formed XML string representing a single element (which can contain children).
       */
      xml: string;
    };

/**
 * Represents an update event in the MEI document.
 * This abstracts away the underlying Yjs event structure and provides
 * details necessary for efficient UI updates and synchronization.
 */
export interface MeiUpdateEvent {
  /**
   * The element that was modified.
   * If a text node was changed, this points to its parent element.
   */
  target: MeiElement;
  /**
   * A map of attribute names to their old and new values.
   */
  attributesChanged: Map<
    string,
    { oldValue: string | null; newValue: string | null }
  >;
  /** Elements that were added as direct children of the target. */
  addedElements: MeiElement[];
  /** Elements that were removed from the target. */
  removedElements: MeiElement[];
  /** Indicates whether the text content of the target (or any of its descendants) was changed. */
  textChanged: boolean;
  /**
   * The origin identifier of the update, as provided to `update(action, origin)`.
   * Useful for distinguishing local application changes from external/plugin changes.
   */
  // biome-ignore lint/suspicious/noExplicitAny: origin can be any type provided by the user.
  origin: any;
  /** True if the update originated locally in this client, false if it came from a remote peer via collaboration. */
  isLocal: boolean;
}

// --------------------------------------------------------------------------
// Utility Functions (Action Creators)
// --------------------------------------------------------------------------

/**
 * Creates an update to set or change an attribute on an element.
 * @param targetId The xml:id of the target element.
 * @param name The name of the attribute.
 * @param value The new value for the attribute.
 */
export const setAttribute = (
  targetId: string,
  name: string,
  value: string,
): MeiUpdate => ({
  type: "setAttribute",
  targetId,
  name,
  value,
});

/**
 * Creates an update to remove an attribute from an element.
 * @param targetId The xml:id of the target element.
 * @param name The name of the attribute to remove.
 */
export const removeAttribute = (targetId: string, name: string): MeiUpdate => ({
  type: "removeAttribute",
  targetId,
  name,
});

/**
 * Creates an update to completely replace an element's content with plain text.
 * WARNING: This removes all child elements within the target.
 * @param targetId The xml:id of the target element.
 * @param text The new text content.
 */
export const setTextContent = (targetId: string, text: string): MeiUpdate => ({
  type: "setTextContent",
  targetId,
  text,
});

/**
 * Creates an update to modify multiple attributes and/or text content simultaneously.
 * @param targetId The xml:id of the target element.
 * @param attributes Key-value pairs of attributes to update. Set to `null` to remove an attribute.
 * @param text Optional new text content to replace existing children/text.
 */
export const updateElement = (
  targetId: string,
  attributes?: Record<string, string | null>,
  text?: string,
): MeiUpdate => ({
  type: "updateElement",
  targetId,
  attributes,
  text,
});

/**
 * Creates an update to append or insert a new child element.
 * @param parentId The xml:id of the parent element.
 * @param tagName The XML tag name for the new element.
 * @param id The strictly required unique xml:id for the new element.
 * @param attributes Optional initial attributes for the new element.
 * @param text Optional initial text content.
 * @param index Optional zero-based index at which to insert the element.
 */
export const addElement = (
  parentId: string,
  tagName: string,
  id: string,
  attributes?: Record<string, string>,
  text?: string,
  index?: number,
): MeiUpdate => ({
  type: "addElement",
  parentId,
  tagName,
  id,
  attributes,
  text,
  index,
});

/**
 * Creates an update to remove an element and all its children.
 * @param targetId The xml:id of the element to remove.
 */
export const removeElement = (targetId: string): MeiUpdate => ({
  type: "removeElement",
  targetId,
});

/**
 * Creates an update to replace an entire element using an XML string.
 * Attributes and children will be synchronized to match the provided XML.
 * @param targetId The xml:id of the existing element to replace.
 * @param xml The well-formed MEI XML string replacing the element.
 */
export const replaceElement = (targetId: string, xml: string): MeiUpdate => ({
  type: "replaceElement",
  targetId,
  xml,
});
