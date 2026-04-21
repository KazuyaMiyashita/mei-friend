import { indentWithTab } from "@codemirror/commands";
import { xml } from "@codemirror/lang-xml";
import { ensureSyntaxTree, indentUnit, syntaxTree } from "@codemirror/language";
import { type Extension, type Range, Transaction } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  keymap,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { MeiFriend, type MeiUpdateEvent } from "@mei-friend/core";
import { indentationMarkers } from "@replit/codemirror-indentation-markers";
import { DOMParser } from "@xmldom/xmldom";
import {
  getElementAtRange,
  hasSyntaxError,
  XmlIdIndexField,
} from "./LezerUtils.js";

/**
 * Options for CodeMirrorPlugin.
 */
export interface CodeMirrorPluginOptions {
  /** Whether to sync changes automatically. Defaults to true. */
  autoSync?: boolean;
  /** Debounce interval for syncing from CodeMirror to MeiFriend (ms). Defaults to 300. */
  syncDelay?: number;
  /** The origin identifier for updates from this plugin. Defaults to "codemirror". */
  origin?: string;
  /** Callback triggered when the synchronization state changes. */
  onStateChange?: (state: SyncState) => void;
}

/**
 * Current status of the synchronization between CodeMirror and MeiFriend.
 */
export type SyncStatus = "idle" | "pending" | "invalid" | "applying_external";

/**
 * Current state of the synchronization, including optional error information.
 */
export interface SyncState {
  status: SyncStatus;
  error?: string;
}

/**
 * Decoration for syntax errors.
 */
const errorMark = Decoration.mark({
  class: "cm-mei-syntax-error",
  attributes: { title: "Syntax Error" },
});

/**
 * CodeMirror extension to highlight syntax error nodes.
 */
const errorHighlighter = EditorView.decorations.of((view) => {
  const decorations: Range<Decoration>[] = [];
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        if (
          node.name === "Error" ||
          node.name === "⚠" ||
          node.type.isError ||
          node.name === "MismatchedCloseTag"
        ) {
          if (node.from < node.to) {
            decorations.push(errorMark.range(node.from, node.to));
          }
        }
      },
    });
  }
  return Decoration.set(decorations);
});

/**
 * Default CSS for error highlighting and custom tweaks.
 */
const customTheme = EditorView.theme({
  // Syntax error - just wavy underline, no background color
  ".cm-mei-syntax-error": {
    textDecoration: "underline wavy red",
  },
  // Disable highlightSelectionMatches background
  ".cm-selectionMatch": {
    backgroundColor: "transparent !important",
  },
});

/**
 * CodeMirrorPlugin provides a bridge between MeiFriend's Yjs-based model
 * and the CodeMirror text editor.
 */
export class CodeMirrorPlugin {
  private view: EditorView | null = null;
  private meiFriend: MeiFriend;
  private options: Required<CodeMirrorPluginOptions>;
  private syncTimeout: ReturnType<typeof setTimeout> | null = null;
  private unregisterUpdate: (() => void) | null = null;
  private _syncState: SyncState = { status: "idle" };

  constructor(meiFriend: MeiFriend, options: CodeMirrorPluginOptions = {}) {
    this.meiFriend = meiFriend;
    this.options = {
      autoSync: options.autoSync ?? true,
      syncDelay: options.syncDelay ?? 300,
      origin: options.origin ?? "codemirror",
      onStateChange: options.onStateChange ?? (() => {}),
    };
  }

  /**
   * Returns CodeMirror extensions to enable MEI editing and synchronization.
   */
  public get extensions(): Extension {
    return [
      xml({ autoCloseTags: false }),
      XmlIdIndexField,
      errorHighlighter,
      customTheme,
      indentUnit.of("  "),
      indentationMarkers(),
      keymap.of([indentWithTab]),
      ViewPlugin.define((view) => {
        this.view = view;
        this.unregisterUpdate = this.meiFriend.onUpdate((events) => {
          this.handleModelUpdate(events);
        });
        return {
          update: (update: ViewUpdate) => {
            if (
              update.docChanged &&
              this.options.autoSync &&
              this.syncStatus !== "applying_external"
            ) {
              this.scheduleSync(update);
            }
          },
          destroy: () => {
            this.unregisterUpdate?.();
            this.unregisterUpdate = null;
            this.view = null;
          },
        };
      }),
    ];
  }

  public get state(): SyncState {
    return this._syncState;
  }

  private get syncStatus(): SyncStatus {
    return this._syncState.status;
  }

  private set syncStatus(status: SyncStatus) {
    this.setSyncState(status);
  }

  private setSyncState(status: SyncStatus, error?: string) {
    if (this._syncState.status !== status || this._syncState.error !== error) {
      this._syncState = { status, error };
      this.options.onStateChange(this._syncState);
    }
  }

  /**
   * Parses an XML string and returns the DOM and any error messages.
   */
  private parseXml(xml: string): {
    dom: ReturnType<DOMParser["parseFromString"]>;
    error?: string;
  } {
    let parserErrorMsg = "";
    const parser = new DOMParser({
      onError: (level, msg) => {
        if (level === "error" || level === "fatalError") {
          if (!parserErrorMsg) parserErrorMsg = msg;
        }
      },
    });

    const dom = parser.parseFromString(xml, "application/xml");
    const parserErrorElements = dom.getElementsByTagName("parsererror");
    if (parserErrorMsg || parserErrorElements.length > 0) {
      const errorText =
        parserErrorMsg ||
        (parserErrorElements.length > 0
          ? parserErrorElements[0].textContent
          : "Unknown XML error");
      return { dom, error: errorText || "Unknown XML error" };
    }
    return { dom };
  }

  /**
   * Checks for syntax errors in the full document and updates the sync state.
   */
  private checkFullSyntaxError(): void {
    if (!this.view) return;
    const hasError = hasSyntaxError(
      (
        ensureSyntaxTree(this.view.state, this.view.state.doc.length, 100) ||
        syntaxTree(this.view.state)
      ).topNode,
    );
    if (hasError) {
      this.setSyncState("invalid", "Lezer syntax error");
    } else {
      this.syncStatus = "idle";
    }
  }

  private handleModelUpdate(events: MeiUpdateEvent[]): void {
    if (!this.view) return;

    // We used to skip events from this.options.origin here to avoid feedback loops.
    // However, since MeiFriend.update now auto-assigns IDs, we WANT to receive
    // those updates back so that the IDs appear in the editor.
    // The feedback loop is stopped by handleDocChange checking if the normalized XML matches.

    // Policy 1: Always apply external changes even if we are in an invalid/pending state.
    const prevStatus = this.syncStatus;
    this.syncStatus = "applying_external";

    try {
      // Full document refresh when:
      // 1. The document is currently invalid (Lezer tree positions are unreliable).
      // 2. A document-replace event was received (new IDs assigned by MeiFriend must be reflected).
      const hasDocumentReplace = events.some(
        (e) => e.type === "document-replace",
      );
      if (prevStatus === "invalid" || hasDocumentReplace) {
        const xml = this.meiFriend.toXmlString();
        this.view.dispatch({
          changes: { from: 0, to: this.view.state.doc.length, insert: xml },
          annotations: [Transaction.userEvent.of("model-sync")],
        });
        return;
      }

      const idMap = this.view.state.field(XmlIdIndexField);
      const changes: { from: number; to: number; insert: string }[] = [];

      // Sort events by position in the document (descending) to avoid offset shifts
      const sortedEvents = events
        .map((event) => {
          const id = event.xmlId;
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
        const baseIndent = this.getBaseIndent(pos.from);
        const newText = this.reindentXml(event.xmlString, baseIndent);
        const oldText = this.view.state.doc.sliceString(pos.from, pos.to);

        if (oldText === newText) continue;

        // Simple prefix/suffix diff to preserve cursor position for small changes (like ID injection)
        let commonPrefix = 0;
        while (
          commonPrefix < oldText.length &&
          commonPrefix < newText.length &&
          oldText[commonPrefix] === newText[commonPrefix]
        ) {
          commonPrefix++;
        }

        let commonSuffix = 0;
        while (
          commonSuffix < oldText.length - commonPrefix &&
          commonSuffix < newText.length - commonPrefix &&
          oldText[oldText.length - 1 - commonSuffix] ===
            newText[newText.length - 1 - commonSuffix]
        ) {
          commonSuffix++;
        }

        changes.push({
          from: pos.from + commonPrefix,
          to: pos.to - commonSuffix,
          insert: newText.slice(commonPrefix, newText.length - commonSuffix),
        });
      }

      if (changes.length > 0) {
        this.view.dispatch({
          changes,
          annotations: [Transaction.userEvent.of("model-sync")],
        });
      }
    } finally {
      // Return to Idle if we were not pending, and there are no syntax errors.
      // If we were pending, keep pending until the timeout fires.
      if (prevStatus === "pending") {
        this.syncStatus = "pending";
      } else {
        this.checkFullSyntaxError();
      }
    }
  }

  private scheduleSync(update: {
    changes: {
      iterChanges: (
        fn: (fromA: number, toA: number, fromB: number, toB: number) => void,
      ) => void;
    };
  }): void {
    this.syncStatus = "pending";
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    this.syncTimeout = setTimeout(() => {
      try {
        this.handleDocChange(update);
      } catch (e) {
        console.error("Error in handleDocChange:", e);
        this.setSyncState(
          "invalid",
          e instanceof Error ? e.message : String(e),
        );
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
    if (!this.view) return;

    // Strict validation of the full document
    const fullXml = this.view.state.doc.toString();
    const { error: fullXmlError } = this.parseXml(fullXml);
    if (fullXmlError) {
      this.setSyncState("invalid", `Full XML error: ${fullXmlError}`);
      return;
    }

    const cmChanges: { fromB: number; toB: number }[] = [];
    update.changes.iterChanges((_fromA, _toA, fromB, toB) => {
      cmChanges.push({ fromB, toB });
    });

    if (cmChanges.length === 0) {
      this.checkFullSyntaxError();
      return;
    }

    // For simplicity, find the range that covers all changes in this turn
    const from = Math.min(...cmChanges.map((c) => c.fromB));
    const to = Math.max(...cmChanges.map((c) => c.toB));

    const dirty = getElementAtRange(this.view.state, from, to);
    if (!dirty) {
      this.checkFullSyntaxError();
      return;
    }

    // Check for syntax errors via Lezer
    if (hasSyntaxError(dirty.node)) {
      this.setSyncState("invalid", "Lezer syntax error in changed element");
      return;
    }

    // We can't easily use the full 'dom' here because it's a different document structure
    // than what was previously parsed from a fragment.
    // However, since we've already confirmed the full document is valid,
    // we can proceed with confidence using dirty.text for fragment-based updates
    // as long as we re-verify the fragment itself if needed, or just trust it.
    // To be safe and meet the "strict" requirement, we parse the fragment too.
    const { dom: fragmentDom, error: fragmentError } = this.parseXml(
      dirty.text,
    );
    if (fragmentError) {
      this.setSyncState("invalid", `XML fragment error: ${fragmentError}`);
      return;
    }
    const newElement = fragmentDom.documentElement;

    if (!newElement) {
      this.setSyncState("invalid", "No root element in XML fragment");
      return;
    }

    const id =
      newElement.getAttribute("xml:id") || newElement.getAttribute("id");

    const targetMeiElement = id ? this.meiFriend.getElementById(id) : null;

    if (id && targetMeiElement) {
      // Check if normalized XML matches before replacing
      try {
        const tempMei = MeiFriend.fromXmlString(dirty.text);
        const tempStr = tempMei.toXmlString(false).trim();
        const currentStr = targetMeiElement.toXmlString().trim();
        if (tempStr === currentStr) {
          this.syncStatus = "idle";
          return;
        }
      } catch (_e) {
        // Ignore and proceed with replacement if temp parsing fails
      }

      this.meiFriend.update(id, dirty.text, this.options.origin);
      this.checkFullSyntaxError();
      return;
    }

    // If the changed element has no ID or is not in the model,
    // we must find a parent that IS in the model and sync from it.
    let curr = dirty.node.parent;
    while (curr) {
      if (curr.name === "Element") {
        const parentId = this.getElementIdFromNode(curr);
        const parentMei = parentId
          ? this.meiFriend.getElementById(parentId)
          : null;
        if (parentId && parentMei) {
          const parentText = this.view?.state.doc.sliceString(
            curr.from,
            curr.to,
          );

          if (parentText) {
            // Check if normalized XML matches before replacing
            try {
              const tempMei = MeiFriend.fromXmlString(parentText);
              const tempStr = tempMei.toXmlString(false).trim();
              const currentStr = parentMei.toXmlString().trim();
              if (tempStr === currentStr) {
                this.syncStatus = "idle";
                return;
              }
            } catch (_e) {
              // Ignore and proceed with replacement if temp parsing fails
            }

            this.meiFriend.update(parentId, parentText, this.options.origin);
          }
          this.checkFullSyntaxError();
          return;
        }
      }
      curr = curr.parent;
    }

    // No parent with ID found — this is a root-level (full document) replacement.
    // Fall back to replaceXmlString instead of marking as invalid.
    this.meiFriend.replaceXmlString(dirty.text, this.options.origin);
    this.checkFullSyntaxError();
  }

  /**
   * Returns the whitespace prefix of the line containing `pos`.
   * This is the indent that precedes the element's opening `<` in the document.
   */
  private getBaseIndent(pos: number): string {
    if (!this.view) return "";
    const line = this.view.state.doc.lineAt(pos);
    return this.view.state.doc.sliceString(line.from, pos);
  }

  /**
   * Re-indents an XML string (serialized at level 0) so that its children
   * use `baseIndent` as their base indentation.
   * The first line is left unchanged because it is inserted directly after
   * the existing indent in the document.
   */
  static reindentXml(xmlString: string, baseIndent: string): string {
    if (!baseIndent) return xmlString;
    const lines = xmlString.split("\n");
    return lines
      .map((line, i) => (i === 0 ? line : baseIndent + line))
      .join("\n");
  }

  private reindentXml(xmlString: string, baseIndent: string): string {
    return CodeMirrorPlugin.reindentXml(xmlString, baseIndent);
  }

  private getElementIdFromNode(node: SyntaxNode): string | null {
    if (!this.view) return null;
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
    this.unregisterUpdate?.();
    this.unregisterUpdate = null;
    // We don't destroy the view here because we don't own it anymore.
    this.view = null;
  }

  /**
   * Selects and scrolls to the element with the given xml:id.
   * @param xmlId The xml:id of the element to jump to.
   * @returns True if the element was found and jumped to.
   */
  public jumpToElement(xmlId: string): boolean {
    if (!this.view) return false;
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
    if (!this.view) {
      throw new Error(
        "EditorView not initialized. Make sure to include plugin.extensions in your CodeMirror configuration.",
      );
    }
    return this.view;
  }

  /**
   * Refreshes the editor content with the current state of the MeiFriend model.
   * This overrides any local unsynced changes.
   */
  public refresh(): void {
    if (!this.view) return;
    const _prevState = this.state;
    this.syncStatus = "applying_external";
    try {
      const xml = this.meiFriend.toXmlString();
      this.view.dispatch({
        changes: { from: 0, to: this.view.state.doc.length, insert: xml },
      });
    } finally {
      this.syncStatus = "idle";
    }
  }
}
