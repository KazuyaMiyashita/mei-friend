import { DOMParser } from "@xmldom/xmldom";
import * as Y from "yjs";
import { MeiApi } from "./api/MeiApi.js";
import { MeiElement } from "./MeiElement.js";
import type { MeiUpdateEvent } from "./MeiUpdateEvent.js";
import { Mei } from "./mei/Mei.js";
import type { ScoreModel } from "./models/score.js";
import { generateId } from "./utils/id.js";
import { serializeYNode } from "./utils/serialize.js";

/**
 * MeiFriend represents a single Music Encoding Initiative (MEI) score.
 * It provides utility APIs for querying and updating XML elements and
 * manages the complete history of changes.
 *
 * **Constraints & Behaviors**
 *
 * 1. **xml:id Enforcement**: To ensure reliable two-way synchronization between the model
 *    and external editors or renderers, this class enforces that **every** XML element
 *    must have a unique `xml:id`.
 *    - On initial load (`fromXmlString`), any elements missing an ID will automatically receive a generated one.
 *    - During updates, any attempt to remove or overwrite an element's `xml:id` will be silently rejected.
 *
 * 2. **Structural Focus**: MeiFriend handles only well-formed XML and manages internal state
 *    by focusing strictly on structural elements and attributes. Consequently, it intentionally ignores:
 *    - Insignificant whitespace (e.g., indentation) between elements.
 *    - XML Comments (`<!-- ... -->`).
 *    - CDATA sections.
 *    - XML Declarations (`<?xml ... ?>`).
 *    - The initial order of attributes.
 *
 * This class encapsulates Yjs for real-time collaboration and undo/redo support.
 */
export class MeiFriend {
  /** The underlying Yjs document. */
  private readonly doc: Y.Doc;
  /** Manager for undo/redo history. */
  private readonly undoManager: Y.UndoManager;
  /** The root XML fragment (containing the internal wrapper). */
  private readonly xmlRoot: Y.XmlFragment;
  /** Internal index for fast O(1) element lookup by xml:id. */
  private readonly idMap = new Map<string, Y.XmlElement>();
  /** Internal index for fast O(1) element lookup by tag name. */
  private readonly tagMap = new Map<string, Set<Y.XmlElement>>();
  /** Reverse index to track which ID belongs to which element, for efficient updates. */
  private readonly elementToIdMap = new Map<Y.XmlElement, string>();
  /** Cached ScoreModel; invalidated on every document update. */
  private _scoreModelCache: ScoreModel | null = null;

  /** The tag name for the internal root wrapper element. */
  private static readonly ROOT_WRAPPER_TAG = "__root__";

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

    // Ensure all elements have IDs
    // biome-ignore lint/suspicious/noExplicitAny: xmldom Element lacks some browser DOM properties but is structurally compatible for our needs.
    const ensureIds = (el: any) => {
      if (!el.getAttribute("xml:id") && !el.getAttribute("id")) {
        el.setAttribute("xml:id", generateId(el.tagName.toLowerCase()));
      }
      for (let i = 0; i < el.children.length; i++) {
        ensureIds(el.children[i]);
      }
    };
    if (dom.documentElement) {
      ensureIds(dom.documentElement);
    }

    // Populate from DOM
    instance.doc.transact(() => {
      // Create root wrapper if it doesn't exist
      let rootWrapper = instance.xmlRoot
        .toArray()
        .find(
          (child): child is Y.XmlElement =>
            child instanceof Y.XmlElement &&
            child.nodeName === MeiFriend.ROOT_WRAPPER_TAG,
        );

      if (!rootWrapper) {
        rootWrapper = new Y.XmlElement(MeiFriend.ROOT_WRAPPER_TAG);
        instance.xmlRoot.push([rootWrapper]);
      } else {
        // Clear existing content if it was somehow already there
        if (rootWrapper.length > 0) rootWrapper.delete(0, rootWrapper.length);
      }

      if (dom.documentElement) {
        instance.populateFromDom(dom as unknown as Node, rootWrapper);
      }
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
    const rootWrapper = this.getInternalRootWrapper();
    if (!rootWrapper) return "";

    const serialized = serializeYNode(rootWrapper, 0);
    if (!serialized) return "";

    const declaration = includeDeclaration
      ? '<?xml version="1.0" encoding="UTF-8"?>\n'
      : "";
    return `${declaration}${serialized}\n`;
  }

  /**
   * High-level API for interacting with the MEI document content.
   */
  public get api(): MeiApi {
    return new MeiApi(this);
  }

  /**
   * Returns a cached ScoreModel built from the current document state.
   * The cache is invalidated on every document update.
   */
  public getScoreModel(): ScoreModel {
    if (!this._scoreModelCache) {
      this._scoreModelCache = this.api.toScoreModel();
    }
    return this._scoreModelCache;
  }

  /**
   * Performs a single element replacement operation in a single transaction.
   * This is the primary method for updating the document.
   *
   * **Constraints**:
   * 1. The root element of `xmlString` must have an `xml:id` (or `id`) that exactly matches `targetId`.
   * 2. Every single child element within `xmlString` must also have an `xml:id`.
   * 3. The tag name of the root element in `xmlString` must match the existing element.
   *
   * If any of these constraints are violated, this method will throw an Error and
   * no changes will be applied.
   *
   * For automatically assigning IDs to a raw XML string before calling this method,
   * use the `assignIds()` utility.
   *
   * @param targetId The xml:id of the existing element to replace.
   * @param xmlString The new MEI XML string for this element.
   * @param origin The origin of the update (optional).
   * @throws {Error} If validation fails or target is not found.
   */
  public update(
    targetId: string,
    xmlString: string,
    // biome-ignore lint/suspicious/noExplicitAny: origin is any type, via the yjs interface.
    origin?: any,
  ): void {
    this.doc.transact(() => {
      const target = this.idMap.get(targetId);
      if (!target?.doc) {
        throw new Error(`Element with ID "${targetId}" not found for update.`);
      }

      const parser = new DOMParser();
      const dom = parser.parseFromString(xmlString, "application/xml");
      const newEl = dom.documentElement;
      if (!newEl) {
        throw new Error("Invalid XML provided for update.");
      }

      // Check if tag name matches
      if (newEl.nodeName !== target.nodeName) {
        throw new Error(
          `Update failed: Tag name mismatch. Expected <${target.nodeName}>, got <${newEl.nodeName}>`,
        );
      }

      // 1. Strict ID validation
      // biome-ignore lint/suspicious/noExplicitAny: xmldom Element lacks some browser DOM properties but is structurally compatible for our needs.
      const validateIds = (el: any, isRoot: boolean) => {
        const id = el.getAttribute("xml:id") || el.getAttribute("id");
        if (!id) {
          throw new Error(
            `Update failed: Missing xml:id on <${el.nodeName}>. All elements must have an ID.`,
          );
        }
        if (isRoot && id !== targetId) {
          throw new Error(
            `Update failed: ID mismatch. Target is "${targetId}", provided XML has "${id}"`,
          );
        }

        const children = el.childNodes;
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (child.nodeType === 1) {
            // biome-ignore lint/suspicious/noExplicitAny: xmldom Element compatibility
            validateIds(child as any, false);
          }
        }
      };
      validateIds(newEl, true);

      // 2. Sync attributes
      const currentAttrs = target.getAttributes();
      for (const key in currentAttrs) {
        if (key !== "xml:id" && key !== "id") {
          target.removeAttribute(key);
        }
      }
      const newAttrs = newEl.attributes;
      for (let i = 0; i < newAttrs.length; i++) {
        const attr = newAttrs[i];
        if (attr.name !== "xml:id" && attr.name !== "id") {
          target.setAttribute(attr.name, attr.value);
        }
      }

      // 3. Destructive replace children
      const length = target.length;
      if (length > 0) target.delete(0, length);
      this.populateFromDom(newEl as unknown as Node, target);

      // Immediately index the new structure
      this.buildIndex(target);
    }, origin);

    // Ensure this update is its own undo step
    this.undoManager.stopCapturing();
  }

  /**
   * Manually finishes the current undo step.
   * Any subsequent changes will be part of a new undo step.
   */
  public commitUndoStep(): void {
    this.undoManager.stopCapturing();
  }

  // --------------------------------------------------------------------------
  // Basic Query API
  // --------------------------------------------------------------------------

  /**
   * Returns the root <mei> element wrapped in a Mei wrapper.
   */
  public getRootElement(): Mei | undefined {
    const rootWrapper = this.getInternalRootWrapper();
    if (!rootWrapper) return undefined;

    const meiNode = rootWrapper
      .toArray()
      .find(
        (child): child is Y.XmlElement =>
          child instanceof Y.XmlElement && child.nodeName === "mei",
      );

    return meiNode ? new Mei(meiNode) : undefined;
  }

  /**
   * Returns an element by its xml:id. Fast O(1) lookup.
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
    return yNode ? new MeiElement(yNode) : undefined;
  }

  /**
   * Returns all elements with the given tag name (e.g., "note", "measure").
   * @param tagName The name of the tag to search for.
   * @returns An array of matching elements.
   */
  public getElementsByTagName(tagName: string): MeiElement[] {
    const nodes = this.tagMap.get(tagName);
    if (!nodes) return [];

    const result: MeiElement[] = [];
    for (const node of nodes) {
      if (node.doc) {
        result.push(new MeiElement(node));
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
   * Registers a callback for when the document is updated.
   * @returns A function to unregister the callback.
   */
  public onUpdate(callback: (events: MeiUpdateEvent[]) => void): () => void {
    // biome-ignore lint/suspicious/noExplicitAny: yEvents can contain various types of events.
    const observer = (yEvents: Y.YEvent<any>[], transaction: Y.Transaction) => {
      const meiEvents: MeiUpdateEvent[] = [];

      for (const e of yEvents) {
        const yEvent = e as Y.YXmlEvent;
        const target = yEvent.target;

        let targetElement: Y.XmlElement | null = null;
        if (target instanceof Y.XmlElement) {
          targetElement = target;
        } else if (target instanceof Y.XmlText) {
          const parent = target.parent;
          if (parent instanceof Y.XmlElement) {
            targetElement = parent;
          }
        }

        if (targetElement?.doc) {
          if (targetElement.nodeName === MeiFriend.ROOT_WRAPPER_TAG) {
            // If the root wrapper itself changed, we report the root <mei> element.
            const rootMei = this.getRootElement();
            if (rootMei) {
              meiEvents.push({
                xmlId: rootMei.id,
                xmlString: rootMei.toXmlString(),
                origin: transaction.origin,
                isLocal: transaction.local,
              });
            }
          } else {
            const xmlId =
              targetElement.getAttribute("xml:id") ||
              targetElement.getAttribute("id");
            if (xmlId) {
              meiEvents.push({
                xmlId,
                xmlString: serializeYNode(targetElement, 0),
                origin: transaction.origin,
                isLocal: transaction.local,
              });
            }
          }
        }
      }

      if (meiEvents.length > 0) {
        callback(meiEvents);
      }
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
   * Destroys the document and associated undo manager.
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

  public get canUndo(): boolean {
    return this.undoManager.undoStack.length > 0;
  }

  public get canRedo(): boolean {
    return this.undoManager.redoStack.length > 0;
  }

  public clearHistory(): void {
    this.undoManager.clear();
  }

  // --------------------------------------------------------------------------
  // Private Methods
  // --------------------------------------------------------------------------

  private getInternalRootWrapper(): Y.XmlElement | undefined {
    return this.xmlRoot
      .toArray()
      .find(
        (child): child is Y.XmlElement =>
          child instanceof Y.XmlElement &&
          child.nodeName === MeiFriend.ROOT_WRAPPER_TAG,
      );
  }

  /** Sets up observers to maintain the idMap and tagMap. */
  private initializeIndex(): void {
    this.buildIndex(this.xmlRoot);

    this.xmlRoot.observeDeep((events) => {
      this._scoreModelCache = null;
      for (const event of events) {
        if (event instanceof Y.YXmlEvent) {
          if (
            event.attributesChanged.has("xml:id") ||
            event.attributesChanged.has("id")
          ) {
            this.updateElementId(event.target as Y.XmlElement);
          }

          event.changes.added.forEach((item) => {
            if (item.content instanceof Y.ContentType) {
              const content = item.content.type;
              if (content instanceof Y.XmlElement) {
                this.buildIndex(content);
              }
            }
          });

          event.changes.deleted.forEach((item) => {
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

  private buildIndex(node: Y.XmlFragment | Y.XmlElement): void {
    if (node instanceof Y.XmlElement) {
      if (node.nodeName !== MeiFriend.ROOT_WRAPPER_TAG) {
        const id = node.getAttribute("xml:id") || node.getAttribute("id");
        if (id) {
          this.idMap.set(id, node);
          this.elementToIdMap.set(node, id);
        }
        let set = this.tagMap.get(node.nodeName);
        if (!set) {
          set = new Set();
          this.tagMap.set(node.nodeName, set);
        }
        set.add(node);
      }
    }
    for (const child of node.toArray()) {
      if (child instanceof Y.XmlElement) {
        this.buildIndex(child);
      }
    }
  }

  private removeFromIndex(node: Y.XmlElement): void {
    const traverse = (n: Y.XmlElement) => {
      const id = this.elementToIdMap.get(n);
      if (id) {
        this.idMap.delete(id);
        this.elementToIdMap.delete(n);
      }
      const set = this.tagMap.get(n.nodeName);
      if (set) {
        set.delete(n);
        if (set.size === 0) {
          this.tagMap.delete(n.nodeName);
        }
      }
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
          const el = child as Element;
          const yElement = new Y.XmlElement(el.nodeName);
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
}
