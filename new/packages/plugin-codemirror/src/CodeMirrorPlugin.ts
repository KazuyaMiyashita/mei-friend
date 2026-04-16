import { xml } from "@codemirror/lang-xml";
import { Transaction } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import { MeiFriend, type MeiUpdateEvent } from "@mei-friend/core";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { basicSetup, EditorView } from "codemirror";
import {
  getElementAtRange,
  hasSyntaxError,
  XmlIdIndexField,
} from "./LezerUtils.js";

/**
 * Options for CodeMirrorPlugin.
 */
export interface CodeMirrorPluginOptions {
  /** The element to attach the CodeMirror editor to. */
  parent?: HTMLElement;
  /** Whether to sync changes automatically. Defaults to true. */
  autoSync?: boolean;
  /** Debounce interval for syncing from CodeMirror to MeiFriend (ms). Defaults to 300. */
  syncDelay?: number;
}

/**
 * Current state of the synchronization between CodeMirror and MeiFriend.
 */
export type SyncState = "idle" | "pending" | "invalid" | "applying_external";

/**
 * CodeMirrorPlugin provides a bridge between MeiFriend's Yjs-based model
 * and the CodeMirror text editor.
 */
export class CodeMirrorPlugin {
  private view: EditorView;
  private meiFriend: MeiFriend;
  private options: Required<CodeMirrorPluginOptions>;
  private syncTimeout: ReturnType<typeof setTimeout> | null = null;
  private unregisterUpdate: () => void;
  private syncState: SyncState = "idle";

  constructor(meiFriend: MeiFriend, options: CodeMirrorPluginOptions = {}) {
    this.meiFriend = meiFriend;
    this.options = {
      parent: options.parent ?? document.createElement("div"),
      autoSync: options.autoSync ?? true,
      syncDelay: options.syncDelay ?? 300,
    };

    this.view = new EditorView({
      doc: this.meiFriend.toXmlString(),
      extensions: [
        basicSetup,
        xml(),
        XmlIdIndexField,
        EditorView.updateListener.of((update) => {
          if (
            update.docChanged &&
            this.options.autoSync &&
            this.syncState !== "applying_external"
          ) {
            this.scheduleSync(update);
          }
        }),
      ],
      parent: this.options.parent,
    });

    this.unregisterUpdate = this.meiFriend.onUpdate((events) => {
      this.handleModelUpdate(events);
    });
  }

  public get state(): SyncState {
    return this.syncState;
  }

  private handleModelUpdate(events: MeiUpdateEvent[]): void {
    // Avoid feedback loops
    if (events.some((e) => e.origin === "codemirror")) return;

    // Policy 1: Always apply external changes even if we are in an invalid/pending state.
    const prevState = this.syncState;
    this.syncState = "applying_external";

    try {
      const idMap = this.view.state.field(XmlIdIndexField);
      const changes: { from: number; to: number; insert: string }[] = [];

      // Sort events by position in the document (descending) to avoid offset shifts
      const sortedEvents = events
        .map((event) => {
          const id = event.target.id;
          const pos = id ? idMap.get(id) : null;
          return { event, pos };
        })
        .filter(
          (
            item,
          ): item is {
            event: MeiUpdateEvent;
            pos: { from: number; to: number };
          } => item.pos !== null,
        )
        .sort((a, b) => b.pos.from - a.pos.from);

      for (const { event, pos } of sortedEvents) {
        // Granular Update:
        // Instead of replacing the whole parent, we only replace the target element.
        // This preserves surrounding comments and indentation.

        // Re-serialize the element from MeiFriend
        const newText = this.meiFriend.serializeElement(event.target.yNode, 0);

        // Try to match indentation of the original line
        const line = this.view.state.doc.lineAt(pos.from);
        const indentMatch = line.text.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : "";
        const indentedText = newText
          .split("\n")
          .map((l, i) => (i === 0 ? l : indent + l))
          .join("\n");

        changes.push({
          from: pos.from,
          to: pos.to,
          insert: indentedText,
        });
      }

      if (changes.length > 0) {
        this.view.dispatch({
          changes,
          annotations: [Transaction.userEvent.of("model-sync")],
        });
      }
    } finally {
      // Return to Idle if we were not pending/invalid, otherwise keep the previous state
      // unless the external change completely overrode the dirty region.
      this.syncState =
        prevState === "pending" || prevState === "invalid" ? prevState : "idle";
    }
  }

  private scheduleSync(update: {
    changes: {
      iterChanges: (
        fn: (fromA: number, toA: number, fromB: number, toB: number) => void,
      ) => void;
    };
  }): void {
    this.syncState = "pending";
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    this.syncTimeout = setTimeout(() => {
      try {
        this.handleDocChange(update);
      } catch (e) {
        console.error("Error in handleDocChange:", e);
        this.syncState = "invalid";
      }
    }, this.options.syncDelay);
  }

  private handleDocChange(update: {
    changes: {
      iterChanges: (
        fn: (fromA: number, toA: number, fromB: number, toB: number) => void,
      ) => void;
    };
  }): void {
    const cmChanges: { fromB: number; toB: number }[] = [];
    update.changes.iterChanges((_fromA, _toA, fromB, toB) => {
      cmChanges.push({ fromB, toB });
    });

    if (cmChanges.length === 0) {
      this.syncState = "idle";
      return;
    }

    // For simplicity, find the range that covers all changes in this turn
    const from = Math.min(...cmChanges.map((c) => c.fromB));
    const to = Math.max(...cmChanges.map((c) => c.toB));

    const dirty = getElementAtRange(this.view.state, from, to);
    if (!dirty) {
      this.syncState = "idle"; // Consider it synced or irrelevant
      return;
    }

    // Check for syntax errors via Lezer
    if (hasSyntaxError(dirty.node)) {
      this.syncState = "invalid";
      return;
    }

    // Try to parse the dirty element text
    let hasParserError = false;
    const parser = new DOMParser({
      onError: (level, _msg) => {
        if (level === "error" || level === "fatalError") {
          hasParserError = true;
        }
      },
    });
    const dom = parser.parseFromString(dirty.text, "application/xml");
    const parserErrorElements = dom.getElementsByTagName("parsererror");
    if (hasParserError || parserErrorElements.length > 0) {
      this.syncState = "invalid";
      return;
    }

    const newElement = dom.documentElement;
    if (!newElement) {
      this.syncState = "invalid";
      return;
    }

    // ------------------------------------------------------------------------
    // ID Auto-Generation & Insertion
    // ------------------------------------------------------------------------
    // biome-ignore lint/suspicious/noExplicitAny: xmldom Element lacks some browser DOM properties but is structurally compatible for our needs.
    const ensureIdsInDom = (el: any): boolean => {
      let changed = false;
      if (!el.getAttribute("xml:id") && !el.getAttribute("id")) {
        el.setAttribute(
          "xml:id",
          MeiFriend.generateId(el.tagName.toLowerCase()),
        );
        changed = true;
      }
      for (let i = 0; i < el.children.length; i++) {
        if (ensureIdsInDom(el.children[i])) changed = true;
      }
      return changed;
    };

    if (ensureIdsInDom(newElement)) {
      // If IDs were missing, we update the CodeMirror text FIRST.
      // This will trigger another docChange, but we want to sync the state with IDs.
      const updatedText = new XMLSerializer().serializeToString(
        // biome-ignore lint/suspicious/noExplicitAny: xmldom Node lacks some browser DOM properties but is structurally compatible for our needs.
        newElement as any,
      );
      // We use a simplified serialization for auto-id insertion.
      // In a real app, we'd use a more sophisticated way to inject just the attribute.
      this.view.dispatch({
        changes: { from: dirty.from, to: dirty.to, insert: updatedText },
        annotations: [Transaction.userEvent.of("id-injection")],
      });
      // The subsequent docChange will trigger another handleDocChange which will then sync to Yjs.
      return;
    }

    const id =
      newElement.getAttribute("xml:id") || newElement.getAttribute("id");
    if (!id) {
      this.syncState = "invalid";
      return;
    }

    const targetMeiElement = this.meiFriend.getElementById(id);
    if (!targetMeiElement) {
      // New element at the top level of the dirty range.
      // We should sync from its parent.
      let curr = dirty.node.parent;
      while (curr) {
        if (curr.name === "Element") {
          const parentId = this.getElementIdFromNode(curr);
          const parentMei = parentId
            ? this.meiFriend.getElementById(parentId)
            : null;
          if (parentMei) {
            const parentText = this.view.state.doc.sliceString(
              curr.from,
              curr.to,
            );
            parentMei.replaceWith(parentText);
            this.syncState = "idle";
            return;
          }
        }
        curr = curr.parent;
      }
      this.syncState = "invalid";
      return;
    }

    // Use destructive reconstruction for simple and robust synchronization
    targetMeiElement.replaceWith(dirty.text);
    this.syncState = "idle";
  }

  private getElementIdFromNode(node: SyntaxNode): string | null {
    const state = this.view.state;
    // Lezer XML parser structure:
    // Element -> (OpenTag | SelfClosingTag) -> Attribute -> AttributeName, AttributeValue
    const tag = node.firstChild;
    if (!tag || (tag.name !== "OpenTag" && tag.name !== "SelfClosingTag"))
      return null;

    let curr = tag.firstChild;
    while (curr) {
      if (curr.name === "Attribute") {
        const nameNode = curr.getChild("AttributeName");
        if (nameNode) {
          const name = state.doc.sliceString(nameNode.from, nameNode.to);
          if (name === "xml:id" || name === "id") {
            const valueNode = curr.getChild("AttributeValue");
            if (valueNode) {
              let value = state.doc.sliceString(valueNode.from, valueNode.to);
              if (
                (value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))
              ) {
                value = value.slice(1, -1);
              }
              return value;
            }
          }
        }
      }
      curr = curr.nextSibling;
    }
    return null;
  }

  /**
   * Cleans up resources used by the plugin.
   */
  public destroy(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    this.unregisterUpdate();
    this.view.destroy();
  }

  /**
   * Selects and scrolls to the element with the given xml:id.
   * @param xmlId The xml:id of the element to jump to.
   * @returns True if the element was found and jumped to.
   */
  public jumpToElement(xmlId: string): boolean {
    const idMap = this.view.state.field(XmlIdIndexField);
    const pos = idMap.get(xmlId);
    if (pos) {
      this.view.dispatch({
        selection: { anchor: pos.from, head: pos.to },
        scrollIntoView: true,
      });
      return true;
    }
    return false;
  }

  /**
   * Returns the underlying CodeMirror EditorView instance.
   */
  public get editorView(): EditorView {
    return this.view;
  }
}
