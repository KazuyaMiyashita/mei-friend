import * as Y from "yjs";
import { MeiApi } from "./api/MeiApi.js";
import { MeiElement } from "./MeiElement.js";
import type {
  DocumentReplaceEvent,
  ElementUpdateEvent,
  MeiUpdateEvent,
} from "./MeiUpdateEvent.js";
import { Mei } from "./mei/Mei.js";
import type { ScoreModel } from "./models/score.js";
import { IdGenerator } from "./utils/IdGenerator.js";
import { ROOT_WRAPPER_TAG, XmlSerde } from "./utils/XmlSerde.js";

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
 *    - On initial load (`fromXmlString`) or element updates (`update`), any elements missing an ID will automatically receive a generated one.
 *
 * 2. **Structural Focus**: MeiFriend handles only well-formed XML and manages internal state
 *    by focusing strictly on structural elements and attributes. XML comments (`<!-- ... -->`)
 *    are preserved. Consequently, it intentionally ignores:
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
  /** Internal ID Generator for auto-assigning IDs */
  public readonly idGenerator: IdGenerator;
  /** Handles XML serialization and deserialization. */
  private readonly serde: XmlSerde;

  constructor(doc?: Y.Doc, idGenerator?: IdGenerator) {
    this.doc = doc ?? new Y.Doc();
    this.idGenerator = idGenerator ?? new IdGenerator();
    this.serde = new XmlSerde(this.idGenerator);
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
   * @param idGenerator Optional custom ID generator.
   * @returns A new MeiFriend instance.
   * @throws {Error} If the provided XML string is not well-formed.
   */
  public static fromXmlString(
    xmlString: string,
    idGenerator?: IdGenerator,
  ): MeiFriend {
    const instance = new MeiFriend(undefined, idGenerator);
    instance.replaceXmlString(xmlString);
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

    const serialized = this.serde.serialize(rootWrapper, 0);
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
   * Replaces the entire document content with the provided MEI XML string.
   * This is equivalent to calling `fromXmlString`, but it updates the existing instance.
   *
   * @param xmlString The new MEI XML string.
   * @param origin The origin of the update (optional).
   * @throws {Error} If the provided XML string is not well-formed.
   */
  public replaceXmlString(
    xmlString: string,
    // biome-ignore lint/suspicious/noExplicitAny: origin is any type, via the yjs interface.
    origin?: any,
  ): void {
    const dom = this.serde.parse(xmlString);

    this.doc.transact(() => {
      let rootWrapper = this.getInternalRootWrapper();
      if (!rootWrapper) {
        rootWrapper = new Y.XmlElement(ROOT_WRAPPER_TAG);
        this.xmlRoot.push([rootWrapper]);
      } else {
        if (rootWrapper.length > 0) {
          rootWrapper.delete(0, rootWrapper.length);
        }
      }

      this.serde.populateFromDom(dom as unknown as Node, rootWrapper);

      this.buildIndex(rootWrapper);
    }, origin);

    this.undoManager.stopCapturing();
  }

  /**
   * Performs a single element replacement operation in a single transaction.
   * This is the primary method for updating the document.
   *
   * **Constraints**:
   * 1. The root element of `xmlString` must have an `xml:id` (or `id`) that exactly matches `targetId`.
   * 2. Every single child element within `xmlString` must also have an `xml:id` (auto-assigned if missing).
   * 3. The tag name of the root element in `xmlString` must match the existing element.
   *
   * @param targetId The xml:id of the existing element to replace. If null or undefined, replaces the entire document.
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

      const dom = this.serde.parse(xmlString, targetId);
      const newEl = dom.documentElement;
      if (!newEl) {
        throw new Error("Parsed document lacks a root element.");
      }

      if (newEl.nodeName !== target.nodeName) {
        throw new Error(
          `Update failed: Tag name mismatch. Expected <${target.nodeName}>, got <${newEl.nodeName}>`,
        );
      }

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

      const length = target.length;
      if (length > 0) target.delete(0, length);
      this.serde.populateFromDom(newEl as unknown as Node, target);

      this.buildIndex(target);
    }, origin);

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
      this.idMap.delete(xmlId);
      this.elementToIdMap.delete(yNode);
      return undefined;
    }
    return yNode ? new MeiElement(yNode, this.idGenerator) : undefined;
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
        result.push(new MeiElement(node, this.idGenerator));
      } else {
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
      let documentReplaceEvent: DocumentReplaceEvent | null = null;
      const elementEvents: ElementUpdateEvent[] = [];

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
          if (targetElement.nodeName === ROOT_WRAPPER_TAG) {
            // replaceXmlString deletes all children of ROOT_WRAPPER_TAG and re-inserts new
            // ones, which produces many Yjs events. Deduplicate into a single document-replace.
            if (!documentReplaceEvent) {
              const rootMei = this.getRootElement();
              if (rootMei) {
                documentReplaceEvent = {
                  type: "document-replace",
                  xmlId: rootMei.id,
                  xmlString: rootMei.toXmlString(),
                  origin: transaction.origin,
                  isLocal: transaction.local,
                };
              }
            }
          } else {
            const xmlId =
              targetElement.getAttribute("xml:id") ||
              targetElement.getAttribute("id");
            if (xmlId) {
              elementEvents.push({
                type: "element-update",
                xmlId,
                xmlString: this.serde.serialize(targetElement, 0),
                origin: transaction.origin,
                isLocal: transaction.local,
              });
            }
          }
        }
      }

      // If a document-replace occurred, suppress all element-update events and emit only the single replace event.
      const meiEvents: MeiUpdateEvent[] = documentReplaceEvent
        ? [documentReplaceEvent]
        : elementEvents;
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
          child instanceof Y.XmlElement && child.nodeName === ROOT_WRAPPER_TAG,
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
      if (node.nodeName !== ROOT_WRAPPER_TAG) {
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
}
