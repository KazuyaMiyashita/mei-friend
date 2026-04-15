import { DOMParser } from "@xmldom/xmldom";
import * as Y from "yjs";
import { MeiElement } from "./MeiElement.js";

/**
 * A token representing an active transaction.
 * This is used to ensure that all operations are performed
 * within an `update()` block and to group multiple low-level changes
 * into a single undo/redo step.
 */
export type MeiTransaction = { readonly _brand: unique symbol };

/**
 * Represents a change event in the MEI document.
 * This abstracts away the underlying Yjs event structure and provides
 * details necessary for efficient UI updates and synchronization.
 */
export interface MeiChangeEvent {
  /**
   * The element that was modified.
   * If a text node changed, this is its parent element.
   */
  target: MeiElement;
  /**
   * Attributes that were changed, mapped to their old and new values.
   */
  attributesChanged: Map<
    string,
    { oldValue: string | null; newValue: string | null }
  >;
  /** Elements that were added as direct children of the target. */
  addedElements: MeiElement[];
  /** Elements that were removed from the target. */
  removedElements: MeiElement[];
  /** Whether the text content of the target or its descendants changed. */
  textChanged: boolean;
  /** The origin of the change, as provided to update(). */
  // biome-ignore lint/suspicious/noExplicitAny: origin can be any type provided by the user.
  origin: any;
  /** Whether the change originated locally. */
  isLocal: boolean;
}

/**
 * MeiFriend represents a single Music Encoding Initiative (MEI) score.
 * It provides utility APIs for querying and updating XML elements and
 * manages the complete history of changes.
 *
 * MeiFriend handles only well-formed XML and manages internal state by focusing
 * strictly on structural elements and attributes. Consequently, it intentionally
 * ignores the following:
 * - Insignificant whitespace (e.g., indentation) between elements.
 * - XML Comments (`<!-- ... -->`).
 * - CDATA sections.
 * - XML Declarations (`<?xml ... ?>`).
 * - The order of attributes.
 *
 * This class encapsulates Yjs for real-time collaboration and undo/redo support.
 * Direct access to the underlying Yjs document is restricted to the `yDoc` getter
 * for synchronization purposes.
 */
export class MeiFriend {
  /** The underlying Yjs document. */
  private readonly doc: Y.Doc;
  /** Manager for undo/redo history. */
  private readonly undoManager: Y.UndoManager;
  /** The root XML fragment (usually containing the <mei> element). */
  private readonly xmlRoot: Y.XmlFragment;
  /** Internal index for fast O(1) element lookup by xml:id. */
  private readonly idMap = new Map<string, Y.XmlElement>();
  /** Internal index for fast O(1) element lookup by tag name. */
  private readonly tagMap = new Map<string, Set<Y.XmlElement>>();
  /** Reverse index to track which ID belongs to which element, for efficient updates. */
  private readonly elementToIdMap = new Map<Y.XmlElement, string>();

  constructor(doc?: Y.Doc) {
    this.doc = doc ?? new Y.Doc();
    this.xmlRoot = this.doc.getXmlFragment("mei");
    this.undoManager = new Y.UndoManager(this.xmlRoot);

    this.initializeIndex();
  }

  /**
   * The underlying Yjs document.
   * This should only be used to connect synchronization providers
   * (e.g., y-webrtc, y-indexeddb). For all editing operations, use `update()`.
   */
  public get yDoc(): Y.Doc {
    return this.doc;
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

    instance.update(() => {
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
   * @param includeDeclaration If true, prepends the XML declaration.
   * @returns The MEI XML string.
   */
  public toXmlString(includeDeclaration = true): string {
    const serialized = this.serializeYNode(this.xmlRoot, 0);
    if (!serialized) return "";

    const declaration = includeDeclaration
      ? '<?xml version="1.0" encoding="UTF-8"?>\n'
      : "";
    return `${declaration}${serialized}\n`;
  }

  /**
   * Performs multiple editing operations in a single transaction.
   * Changes are grouped for undo/redo and synchronization.
   *
   * @example
   * ```typescript
   * const root = meiFriend.getElementById("m-1")!;
   *
   * meiFriend.update((tx) => {
   *   const note = root.appendElement(tx, "note");
   *   note.setAttribute(tx, "xml:id", "n-1");
   *
   *   // Notice: This will be undefined because the MeiFriend's internal index is updated AFTER the transaction.
   *   const sameNote = meiFriend.getElementById("n-1");
   * });
   *
   * // OK: Now it's searchable.
   * const sameNote = meiFriend.getElementById("n-1");
   * ```
   *
   * @param fn The function to execute. It receives a `MeiTransaction` token.
   * @param origin The origin of the change (optional).
   * @returns The result of the provided function.
   */
  public update<T>(
    fn: (tx: MeiTransaction) => T,
    // biome-ignore lint/suspicious/noExplicitAny: origin is any type, via the yjs interface.
    origin?: any,
  ): T {
    let result: T;
    this.doc.transact(() => {
      const tx = {} as unknown as MeiTransaction;
      result = fn(tx);
    }, origin);
    // biome-ignore lint/style/noNonNullAssertion: result is guaranteed to be set in the synchronous transaction block.
    return result!;
  }

  // --------------------------------------------------------------------------
  // Basic Query API
  // --------------------------------------------------------------------------

  /**
   * Returns the root <mei> element wrapped in a MeiElement.
   */
  public getRootElement(): MeiElement | undefined {
    const meiNode = this.xmlRoot
      .toArray()
      .find(
        (child): child is Y.XmlElement =>
          child instanceof Y.XmlElement && child.nodeName === "mei",
      );
    return meiNode ? new MeiElement(meiNode, this) : undefined;
  }

  /**
   * Returns an element by its xml:id. Fast O(1) lookup.
   * Note: This reflects the state AFTER the last completed `update()`.
   * @param xmlId The xml:id of the element to find.
   * @returns The element if found, otherwise undefined.
   */
  public getElementById(xmlId: string): MeiElement | undefined {
    const yNode = this.idMap.get(xmlId);
    if (yNode && !yNode.doc) {
      // Lazy cleanup: the node was detached but still in our index.
      this.idMap.delete(xmlId);
      this.elementToIdMap.delete(yNode);
      return undefined;
    }
    return yNode ? new MeiElement(yNode, this) : undefined;
  }

  /**
   * Returns all elements with the given tag name (e.g., "note", "measure").
   * This uses an internal index and is extremely fast O(1) (excluding wrapper creation).
   * @param tagName The name of the tag to search for.
   * @returns An array of matching elements.
   */
  public getElementsByTagName(tagName: string): MeiElement[] {
    const nodes = this.tagMap.get(tagName);
    if (!nodes) return [];

    const result: MeiElement[] = [];
    for (const node of nodes) {
      if (node.doc) {
        result.push(new MeiElement(node, this));
      } else {
        // Lazy cleanup
        nodes.delete(node);
        this.elementToIdMap.delete(node);
      }
    }

    if (nodes.size === 0) {
      this.tagMap.delete(tagName);
    }

    return result;
  }

  // --------------------------------------------------------------------------
  // Event API
  // --------------------------------------------------------------------------

  /**
   * Registers a callback for when the document changes.
   * This abstracts away Yjs events to keep the core API clean.
   * @returns A function to unregister the callback.
   */
  public onChange(callback: (events: MeiChangeEvent[]) => void): () => void {
    // biome-ignore lint/suspicious/noExplicitAny: yEvents can contain various types of events.
    const observer = (yEvents: Y.YEvent<any>[], transaction: Y.Transaction) => {
      const meiEvents: MeiChangeEvent[] = yEvents.map((e) => {
        const yEvent = e as Y.YXmlEvent;
        const target = yEvent.target;

        let meiTarget: MeiElement;
        let textChanged = false;

        // Determine the target MeiElement.
        // If the target is a text node, we treat the parent element as the event target.
        if (target instanceof Y.XmlElement) {
          meiTarget = new MeiElement(target, this);
        } else if (target instanceof Y.XmlText) {
          const parent = target.parent;
          if (parent instanceof Y.XmlElement) {
            meiTarget = new MeiElement(parent, this);
            textChanged = true;
          } else {
            // Fallback for isolated text nodes
            meiTarget = new MeiElement(target as unknown as Y.XmlElement, this);
            textChanged = true;
          }
        } else {
          // Fallback for fragments or other types
          meiTarget = new MeiElement(target as unknown as Y.XmlElement, this);
        }

        const attributesChanged = new Map<
          string,
          { oldValue: string | null; newValue: string | null }
        >();
        if (target instanceof Y.XmlElement) {
          yEvent.attributesChanged.forEach((change, key) => {
            attributesChanged.set(key, {
              // biome-ignore lint/suspicious/noExplicitAny: Yjs attribute change object has oldValue.
              oldValue: (change as any).oldValue ?? null,
              newValue: target.getAttribute(key) ?? null,
            });
          });
        }

        const addedElements: MeiElement[] = [];
        const removedElements: MeiElement[] = [];

        yEvent.changes.added.forEach((item) => {
          if (item.content instanceof Y.ContentType) {
            const type = item.content.type;
            if (type instanceof Y.XmlElement) {
              addedElements.push(new MeiElement(type, this));
            } else if (type instanceof Y.XmlText) {
              textChanged = true;
            }
          } else if (item.content instanceof Y.ContentString) {
            textChanged = true;
          }
        });

        yEvent.changes.deleted.forEach((item) => {
          if (item.content instanceof Y.ContentType) {
            const type = item.content.type;
            if (type instanceof Y.XmlElement) {
              removedElements.push(new MeiElement(type, this));
            } else if (type instanceof Y.XmlText) {
              textChanged = true;
            }
          } else if (item.content instanceof Y.ContentString) {
            textChanged = true;
          }
        });

        return {
          target: meiTarget,
          attributesChanged,
          addedElements,
          removedElements,
          textChanged:
            textChanged ||
            yEvent.changes.added.size > 0 ||
            yEvent.changes.deleted.size > 0,
          origin: transaction.origin,
          isLocal: transaction.local,
        };
      });
      callback(meiEvents);
    };

    this.xmlRoot.observeDeep(observer);
    return () => {
      this.xmlRoot.unobserveDeep(observer);
    };
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  /**
   * Destroys the document and associated undo manager, releasing all resources.
   * This should be called when the document is no longer needed to prevent memory leaks.
   */
  public destroy(): void {
    this.undoManager.destroy();
    this.doc.destroy();
  }

  // --------------------------------------------------------------------------
  // Undo / Redo
  // --------------------------------------------------------------------------

  public undo(): void {
    this.undoManager.undo();
  }

  public redo(): void {
    this.undoManager.redo();
  }

  /**
   * Returns true if there are operations that can be undone.
   */
  public get canUndo(): boolean {
    return this.undoManager.undoStack.length > 0;
  }

  /**
   * Returns true if there are operations that can be redone.
   */
  public get canRedo(): boolean {
    return this.undoManager.redoStack.length > 0;
  }

  /**
   * Clears the undo/redo history.
   */
  public clearHistory(): void {
    this.undoManager.clear();
  }

  // --------------------------------------------------------------------------
  // Private Methods
  // --------------------------------------------------------------------------

  private escapeXml(unsafe: string): string {
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

  /** Sets up observers to maintain the idMap and tagMap. */
  private initializeIndex(): void {
    // Initial indexing
    this.buildIndex(this.xmlRoot);

    this.xmlRoot.observeDeep((events) => {
      for (const event of events) {
        if (event instanceof Y.YXmlEvent) {
          // Attribute changes (only affects ID map)
          if (
            event.attributesChanged.has("xml:id") ||
            event.attributesChanged.has("id")
          ) {
            this.updateElementId(event.target as Y.XmlElement);
          }

          // Added nodes
          event.changes.added.forEach((item) => {
            if (item.content instanceof Y.ContentType) {
              const content = item.content.type;
              if (content instanceof Y.XmlElement) {
                this.buildIndex(content);
              }
            }
          });

          // Deleted nodes
          event.changes.deleted.forEach((item) => {
            // In Yjs observeDeep, deleted items are passed.
            // We need to unindex them and their nested children.
            if (item.content instanceof Y.ContentType) {
              const content = item.content.type;
              if (content instanceof Y.XmlElement) {
                this.removeFromIndex(content);
              }
            }
          });
        }
      }
    });
  }

  /** Updates the indexing for a single element when its ID attribute changes. */
  private updateElementId(node: Y.XmlElement): void {
    const oldId = this.elementToIdMap.get(node);
    if (oldId) {
      this.idMap.delete(oldId);
      this.elementToIdMap.delete(node);
    }

    const newId = node.getAttribute("xml:id") || node.getAttribute("id");
    if (newId) {
      this.idMap.set(newId, node);
      this.elementToIdMap.set(node, newId);
    }
  }

  /** Recursively populates idMap and tagMap from a Yjs XML node. */
  private buildIndex(node: Y.XmlFragment | Y.XmlElement): void {
    if (node instanceof Y.XmlElement) {
      // ID index
      const id = node.getAttribute("xml:id") || node.getAttribute("id");
      if (id) {
        this.idMap.set(id, node);
        this.elementToIdMap.set(node, id);
      }
      // Tag index
      let set = this.tagMap.get(node.nodeName);
      if (!set) {
        set = new Set();
        this.tagMap.set(node.nodeName, set);
      }
      set.add(node);
    }
    for (const child of node.toArray()) {
      if (child instanceof Y.XmlElement) {
        this.buildIndex(child);
      }
    }
  }

  /** Recursively removes detached nodes and their children from the indexes. */
  private removeFromIndex(node: Y.XmlElement): void {
    const traverse = (n: Y.XmlElement) => {
      // Remove ID
      const id = this.elementToIdMap.get(n);
      if (id) {
        this.idMap.delete(id);
        this.elementToIdMap.delete(n);
      }
      // Remove Tag
      const set = this.tagMap.get(n.nodeName);
      if (set) {
        set.delete(n);
        if (set.size === 0) {
          this.tagMap.delete(n.nodeName);
        }
      }

      // Recursively traverse children.
      // Even if detached, we can still iterate over the children.
      const len = n.length;
      for (let i = 0; i < len; i++) {
        const child = n.get(i);
        if (child instanceof Y.XmlElement) {
          traverse(child);
        }
      }
    };
    traverse(node);
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
      const keys = Object.keys(attrs)
        .filter((key) => attrs[key] !== undefined)
        .sort((a, b) => {
          if (a === "xml:id") return -1;
          if (b === "xml:id") return 1;
          return a.localeCompare(b);
        });

      for (const key of keys) {
        attrStr += ` ${key}="${this.escapeXml(attrs[key])}"`;
      }

      const children = yNode.toArray();

      if (children.length === 0) {
        return `${indent}<${name}${attrStr}/>`;
      }

      // Check if the element contains only text
      const isTextOnly =
        children.length === 1 && children[0] instanceof Y.XmlText;

      if (isTextOnly) {
        const textContent = (children[0] as Y.XmlText).toString();
        return `${indent}<${name}${attrStr}>${this.escapeXml(
          textContent,
        )}</${name}>`;
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

      return `${indent}<${name}${attrStr}>\n${childrenStrs.join(
        "\n",
      )}\n${indent}</${name}>`;
    } else if (yNode instanceof Y.XmlText) {
      return this.escapeXml(yNode.toString());
    } else if (yNode instanceof Y.XmlFragment) {
      const childrenStrs: string[] = [];
      for (const child of yNode.toArray()) {
        const serializedChild = this.serializeYNode(
          child as Y.XmlFragment | Y.XmlElement | Y.XmlText,
          level,
        );
        if (serializedChild) childrenStrs.push(serializedChild);
      }
      return childrenStrs.join("\n");
    }
    return "";
  }
}
