import {
  history,
  historyKeymap,
  indentWithTab,
  isolateHistory,
} from "@codemirror/commands";
import { xml } from "@codemirror/lang-xml";
import { indentUnit, syntaxTree } from "@codemirror/language";
import {
  Annotation,
  type EditorState,
  type Extension,
  Prec,
  type Range,
  StateEffect,
  StateField,
  Transaction,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  keymap,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import type { MeiFriend, MeiUpdateEvent } from "@mei-friend/core";
import { indentationMarkers } from "@replit/codemirror-indentation-markers";
import { DOMParser } from "@xmldom/xmldom";
import {
  type CursorContext,
  captureCursorContext,
  getAncestorElementIds,
  getElementAtRange,
  getElementId,
  hasSyntaxError,
  spliceDirtyIntoNewXml,
  XmlIdIndexField,
} from "./LezerUtils.js";

// ── Annotations & Effects ────────────────────────────────────────────────────

/**
 * Marks the source of a dispatch:
 * - "apply":   editor content was applied to MeiFriend (echo or direct apply)
 * - "refresh": editor was refreshed from the MeiFriend model
 * - "external": a change came in from MeiFriend that was not initiated by this plugin's apply
 */
export const MeiSyncAnnotation = Annotation.define<
  "apply" | "refresh" | "external"
>();

/**
 * Carries an explicit new DirtyInfo value to override position-mapping logic
 * in DirtyStateField, or null to clear dirty state.
 */
export const SetDirtyEffect = StateEffect.define<DirtyInfo | null>();

// ── DirtyStateField ──────────────────────────────────────────────────────────

export interface DirtyInfo {
  /** xml:id of the element being edited, or null when no element is identifiable. */
  xmlId: string | null;
  /** Editor range [from, to) covering the dirty element. */
  from: number;
  to: number;
}

interface DirtyStateValue {
  /** null = editor content matches last applied/refreshed state */
  dirty: DirtyInfo | null;
  /** Full editor text as of the last Apply or Refresh. */
  lastAppliedDoc: string;
}

export const DirtyStateField = StateField.define<DirtyStateValue>({
  create(state) {
    return { dirty: null, lastAppliedDoc: state.doc.toString() };
  },

  update(value, tr) {
    const annotation = tr.annotation(MeiSyncAnnotation);

    // Apply or Refresh clears dirty and records the new baseline.
    if (annotation === "apply" || annotation === "refresh") {
      return { dirty: null, lastAppliedDoc: tr.newDoc.toString() };
    }

    // Always honour explicit SetDirtyEffect first.
    for (const effect of tr.effects) {
      if (effect.is(SetDirtyEffect)) {
        return { dirty: effect.value, lastAppliedDoc: value.lastAppliedDoc };
      }
    }

    if (!tr.docChanged) return value;

    // External update: map existing dirty position through the changeset.
    if (annotation === "external") {
      if (value.dirty) {
        const newFrom = tr.changes.mapPos(value.dirty.from);
        const newTo = tr.changes.mapPos(value.dirty.to, 1);
        return {
          dirty: { ...value.dirty, from: newFrom, to: newTo },
          lastAppliedDoc: value.lastAppliedDoc,
        };
      }
      return value;
    }

    // User edit: expand the dirty range to cover all changed positions.
    let rangeFrom = Number.POSITIVE_INFINITY;
    let rangeTo = Number.NEGATIVE_INFINITY;
    tr.changes.iterChanges((_fromA, _toA, fromB, toB) => {
      if (fromB < rangeFrom) rangeFrom = fromB;
      if (toB > rangeTo) rangeTo = toB;
    });

    if (rangeFrom === Number.POSITIVE_INFINITY) return value;

    // Merge with the previous dirty range (mapped through changes).
    if (value.dirty) {
      const mappedFrom = tr.changes.mapPos(value.dirty.from);
      const mappedTo = tr.changes.mapPos(value.dirty.to, 1);
      if (mappedFrom < rangeFrom) rangeFrom = mappedFrom;
      if (mappedTo > rangeTo) rangeTo = mappedTo;
    }

    const isDirtyNow = tr.newDoc.toString() !== value.lastAppliedDoc;
    if (!isDirtyNow) {
      return { dirty: null, lastAppliedDoc: value.lastAppliedDoc };
    }

    // Find the smallest enclosing element without syntax errors.
    const element = getElementAtRange(tr.state, rangeFrom, rangeTo);
    const dirty: DirtyInfo = element
      ? {
          xmlId: getElementId(tr.state, element.node),
          from: element.from,
          to: element.to,
        }
      : { xmlId: null, from: 0, to: tr.newDoc.length };

    return { dirty, lastAppliedDoc: value.lastAppliedDoc };
  },
});

// ── Decorations & Theme ──────────────────────────────────────────────────────

const errorMark = Decoration.mark({
  class: "cm-mei-syntax-error",
  attributes: { title: "Syntax Error" },
});

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

const customTheme = EditorView.theme({
  ".cm-mei-syntax-error": {
    textDecoration: "underline wavy red",
  },
  ".cm-selectionMatch": {
    backgroundColor: "transparent !important",
  },
});

// ── Types ────────────────────────────────────────────────────────────────────

export interface EditorCursorInfo {
  /** 1-based line number. */
  line: number;
  /** 1-based column number. */
  col: number;
  /** xml:id of the nearest enclosing XML element, if any. */
  xmlId?: string;
}

export interface CodeMirrorPluginOptions {
  /** The origin identifier for updates from this plugin. Defaults to "codemirror". */
  origin?: string;
  /** Callback triggered when the synchronization state changes. */
  onStateChange?: (state: SyncState) => void;
  /** Callback triggered when the cursor position or enclosing element changes. */
  onCursorChange?: (info: EditorCursorInfo) => void;
}

/**
 * Status of the editor relative to the MeiFriend model.
 * - "idle":              editor content matches the model
 * - "dirty":            editor has unsaved changes
 * - "invalid":          editor content has XML/syntax errors; Apply is blocked
 * - "applying_external": model is pushing an update to the editor
 */
export type SyncStatus = "idle" | "dirty" | "invalid" | "applying_external";

export interface SyncState {
  status: SyncStatus;
  error?: string;
}

// ── CodeMirrorPlugin ─────────────────────────────────────────────────────────

export class CodeMirrorPlugin {
  private view: EditorView | null = null;
  private meiFriend: MeiFriend;
  private options: Required<CodeMirrorPluginOptions>;
  private unregisterUpdate: (() => void) | null = null;
  private _syncState: SyncState = { status: "idle" };
  private _lastCursorInfo: EditorCursorInfo | null = null;
  /** True while meiFriend.update/replaceXmlString is in progress, so we recognise the echo. */
  private _applyInProgress = false;

  constructor(meiFriend: MeiFriend, options: CodeMirrorPluginOptions = {}) {
    this.meiFriend = meiFriend;
    this.options = {
      origin: options.origin ?? "codemirror",
      onStateChange: options.onStateChange ?? (() => {}),
      onCursorChange: options.onCursorChange ?? (() => {}),
    };
  }

  public get extensions(): Extension {
    return [
      xml({ autoCloseTags: false }),
      XmlIdIndexField,
      DirtyStateField,
      errorHighlighter,
      customTheme,
      indentUnit.of("  "),
      indentationMarkers(),
      history(),
      keymap.of([indentWithTab, ...historyKeymap]),
      Prec.highest(
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              this.apply();
              return true;
            },
          },
        ]),
      ),
      ViewPlugin.define((view) => {
        this.view = view;
        this.unregisterUpdate = this.meiFriend.onUpdate((events) => {
          this.handleModelUpdate(events);
        });
        return {
          update: (update: ViewUpdate) => {
            if (update.docChanged) {
              const newVal = update.state.field(DirtyStateField);
              const oldVal = update.startState.field(DirtyStateField);
              if (newVal !== oldVal) {
                this.updateSyncStateFromDirty(update.state, newVal);
              }
            }
            if (update.docChanged || update.selectionSet) {
              this.emitCursorChange(update.state);
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

  // ── Public API ─────────────────────────────────────────────────────────────

  public get state(): SyncState {
    return this._syncState;
  }

  public get isDirty(): boolean {
    if (!this.view) return false;
    return this.view.state.field(DirtyStateField).dirty !== null;
  }

  /**
   * Applies the editor content to the MeiFriend model.
   * @returns true if the apply succeeded, false if blocked by errors.
   */
  public apply(): boolean {
    if (!this.view) return false;
    const dirtyValue = this.view.state.field(DirtyStateField);
    if (!dirtyValue.dirty) return false;

    const { dirty } = dirtyValue;
    const view = this.view;

    // Lezer syntax check
    if (dirty.xmlId) {
      const element = getElementAtRange(view.state, dirty.from, dirty.to);
      if (!element || hasSyntaxError(element.node)) {
        this.setSyncState("invalid", "Syntax error in edited element");
        return false;
      }
    } else {
      // No identifiable element — check full document
      if (hasSyntaxError(syntaxTree(view.state).topNode)) {
        this.setSyncState("invalid", "Syntax error in document");
        return false;
      }
    }

    const ctx = captureCursorContext(view.state);
    const dirtyText = view.state.doc.sliceString(dirty.from, dirty.to);

    if (dirty.xmlId) {
      // Validate the element fragment
      const { error } = this.parseXml(dirtyText);
      if (error) {
        this.setSyncState("invalid", `XML error: ${error}`);
        return false;
      }

      const targetElement = this.meiFriend.getElementById(dirty.xmlId);
      if (!targetElement) {
        return this.applyFullDocument(view, ctx);
      }

      this._applyInProgress = true;
      try {
        this.meiFriend.update(dirty.xmlId, dirtyText, this.options.origin);
      } finally {
        this._applyInProgress = false;
      }
    } else {
      return this.applyFullDocument(view, ctx);
    }

    if (ctx && this.view) {
      this.restoreCursorContext(this.view, ctx);
    }
    this.setSyncState("idle");
    return true;
  }

  /** Full-document replace path used when no element ID is available. */
  private applyFullDocument(
    view: EditorView,
    ctx: CursorContext | null,
  ): boolean {
    const fullXml = view.state.doc.toString();
    const { error } = this.parseXml(fullXml);
    if (error) {
      this.setSyncState("invalid", `XML error: ${error}`);
      return false;
    }

    this._applyInProgress = true;
    try {
      this.meiFriend.replaceXmlString(fullXml, this.options.origin);
    } finally {
      this._applyInProgress = false;
    }

    if (ctx && this.view) {
      this.restoreCursorContext(this.view, ctx);
    }
    this.setSyncState("idle");
    return true;
  }

  /**
   * Overwrites the editor with the current MeiFriend model state.
   * Cursor position is restored to the equivalent location in the new content.
   */
  public refresh(): void {
    if (!this.view) return;
    const view = this.view;
    const ctx = captureCursorContext(view.state);
    const newXml = this.meiFriend.toXmlString();

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: newXml },
      annotations: [MeiSyncAnnotation.of("refresh")],
    });

    if (ctx && this.view) {
      this.restoreCursorContext(this.view, ctx);
    }
    this.setSyncState("idle");
  }

  /**
   * Selects and scrolls to the element with the given xml:id.
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

  public get editorView(): EditorView {
    if (!this.view) {
      throw new Error(
        "EditorView not initialized. Make sure to include plugin.extensions in your CodeMirror configuration.",
      );
    }
    return this.view;
  }

  public destroy(): void {
    this.unregisterUpdate?.();
    this.unregisterUpdate = null;
    this.view = null;
  }

  // ── Model → Editor sync ────────────────────────────────────────────────────

  private handleModelUpdate(events: MeiUpdateEvent[]): void {
    if (!this.view) return;
    const view = this.view;
    const state = view.state;
    const dirtyValue = state.field(DirtyStateField);

    // ── Case A: Echo from our own apply ─────────────────────────────────────
    if (this._applyInProgress) {
      const hasDocReplace = events.some((e) => e.type === "document-replace");
      if (hasDocReplace) {
        const newXml = this.meiFriend.toXmlString();
        view.dispatch({
          changes: { from: 0, to: state.doc.length, insert: newXml },
          annotations: [MeiSyncAnnotation.of("apply")],
        });
      } else {
        const changes = this.computeElementChanges(events, state);
        // Always dispatch with "apply" annotation to clear dirty, even if no text changed.
        view.dispatch({
          changes,
          annotations: [MeiSyncAnnotation.of("apply")],
        });
      }
      return;
    }

    // ── Case B: External document replace ───────────────────────────────────
    if (events.some((e) => e.type === "document-replace")) {
      const newXml = this.meiFriend.toXmlString();

      if (dirtyValue.dirty) {
        const { dirty } = dirtyValue;
        const conflicted = this.isExternalConflict(state, dirty, events);

        if (conflicted || !dirty.xmlId) {
          this.applyConflictingUpdate(view, newXml, dirty.xmlId);
        } else {
          this.applyPreservingDirty(view, state, newXml, dirty);
        }
      } else {
        view.dispatch({
          changes: { from: 0, to: state.doc.length, insert: newXml },
          annotations: [
            MeiSyncAnnotation.of("external"),
            Transaction.addToHistory.of(false),
          ],
        });
        this.setSyncState("idle");
      }
      return;
    }

    // ── Case C: External element-level updates ───────────────────────────────
    if (dirtyValue.dirty) {
      const { dirty } = dirtyValue;
      const conflicted = this.isExternalConflict(state, dirty, events);

      if (conflicted) {
        // Full refresh to correctly replace conflicted content even if the editor is broken
        const newXml = this.meiFriend.toXmlString();
        this.applyConflictingUpdate(view, newXml, dirty.xmlId);
      } else {
        // Apply only changes to elements outside the dirty range
        const changes = this.computeElementChangesExcluding(
          events,
          state,
          dirty,
        );
        if (changes.length > 0) {
          view.dispatch({
            changes,
            annotations: [
              MeiSyncAnnotation.of("external"),
              Transaction.addToHistory.of(false),
            ],
          });
        }
        // Keep dirty status; DirtyStateField maps positions automatically
      }
    } else {
      const changes = this.computeElementChanges(events, state);
      if (changes.length > 0) {
        view.dispatch({
          changes,
          annotations: [
            MeiSyncAnnotation.of("external"),
            Transaction.addToHistory.of(false),
          ],
        });
      }
      this.setSyncState("idle");
    }
  }

  // ── Helpers for handleModelUpdate ─────────────────────────────────────────

  /** Full refresh that discards dirty edits, with cursor moved to the dirty element. */
  private applyConflictingUpdate(
    view: EditorView,
    newXml: string,
    dirtyXmlId: string | null,
  ): void {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: newXml },
      effects: [SetDirtyEffect.of(null)],
      annotations: [
        MeiSyncAnnotation.of("external"),
        Transaction.addToHistory.of(false),
      ],
    });
    this.moveCursorToElement(view, dirtyXmlId);
    this.setSyncState("idle");
    this.createUndoBoundary(view);
  }

  /** Updates all elements except the dirty one, preserving the dirty text. */
  private applyPreservingDirty(
    view: EditorView,
    state: EditorState,
    newXml: string,
    dirty: DirtyInfo,
  ): void {
    if (!dirty.xmlId) return;
    const dirtyText = state.doc.sliceString(dirty.from, dirty.to);
    const spliceResult = spliceDirtyIntoNewXml(newXml, dirty.xmlId, dirtyText);

    if (spliceResult) {
      const { result, from, to } = spliceResult;
      view.dispatch({
        changes: { from: 0, to: state.doc.length, insert: result },
        effects: [SetDirtyEffect.of({ xmlId: dirty.xmlId, from, to })],
        annotations: [
          MeiSyncAnnotation.of("external"),
          Transaction.addToHistory.of(false),
        ],
      });
      // Dirty status is preserved; keep current sync state
    } else {
      // Dirty element was removed from the model - treat as conflict
      this.applyConflictingUpdate(view, newXml, dirty.xmlId);
    }
  }

  /** Returns true if any of the external events affect the dirty element or its ancestors. */
  private isExternalConflict(
    state: EditorState,
    dirty: DirtyInfo,
    events: MeiUpdateEvent[],
  ): boolean {
    // If we can't identify the dirty element (broken XML / root-level edit),
    // treat any external update as a conflict so the external change always wins.
    if (!dirty.xmlId) return events.length > 0;

    const idMap = state.field(XmlIdIndexField);

    for (const event of events) {
      const { xmlId } = event;
      if (!xmlId) continue;

      // Direct match with dirty element
      if (xmlId === dirty.xmlId) return true;

      // Ancestor: event element's range contains the dirty range
      const pos = idMap.get(xmlId);
      if (pos && pos.from <= dirty.from && pos.to >= dirty.to) return true;
    }

    // Also check Lezer-based ancestors for events whose IDs may not be in the idMap
    const ancestorIds = new Set(getAncestorElementIds(state, dirty.from));
    for (const event of events) {
      if (event.xmlId && ancestorIds.has(event.xmlId)) return true;
    }

    return false;
  }

  /**
   * Builds CodeMirror change specs for element-update events.
   * Changes are sorted descending by position to avoid offset drift.
   */
  private computeElementChanges(
    events: MeiUpdateEvent[],
    state: EditorState,
  ): { from: number; to: number; insert: string }[] {
    const idMap = state.field(XmlIdIndexField);
    const changes: { from: number; to: number; insert: string }[] = [];

    type ElementChange = {
      event: MeiUpdateEvent;
      pos: { from: number; to: number };
    };
    const sorted: ElementChange[] = events
      .filter((e) => e.type === "element-update")
      .flatMap((event) => {
        const pos = event.xmlId ? idMap.get(event.xmlId) : undefined;
        return pos ? [{ event, pos }] : [];
      })
      .sort((a, b) => b.pos.from - a.pos.from);

    for (const { event, pos } of sorted) {
      const baseIndent = this.getBaseIndent(state, pos.from);
      const newText = CodeMirrorPlugin.reindentXml(event.xmlString, baseIndent);
      const oldText = state.doc.sliceString(pos.from, pos.to);
      if (oldText === newText) continue;

      // Prefix/suffix diff to minimise edits and preserve cursor position
      let prefix = 0;
      while (
        prefix < oldText.length &&
        prefix < newText.length &&
        oldText[prefix] === newText[prefix]
      )
        prefix++;

      let suffix = 0;
      while (
        suffix < oldText.length - prefix &&
        suffix < newText.length - prefix &&
        oldText[oldText.length - 1 - suffix] ===
          newText[newText.length - 1 - suffix]
      )
        suffix++;

      changes.push({
        from: pos.from + prefix,
        to: pos.to - suffix,
        insert: newText.slice(prefix, newText.length - suffix),
      });
    }

    return changes;
  }

  /** Like computeElementChanges but skips any event whose range overlaps the dirty range. */
  private computeElementChangesExcluding(
    events: MeiUpdateEvent[],
    state: EditorState,
    dirty: DirtyInfo,
  ): { from: number; to: number; insert: string }[] {
    const idMap = state.field(XmlIdIndexField);
    const filtered = events.filter((e) => {
      if (e.type !== "element-update" || !e.xmlId) return false;
      const pos = idMap.get(e.xmlId);
      if (!pos) return true;
      // Skip events whose range overlaps with the dirty element (includes descendants)
      return !(pos.from < dirty.to && pos.to > dirty.from);
    });
    return this.computeElementChanges(filtered, state);
  }

  // ── Cursor helpers ────────────────────────────────────────────────────────

  private getXmlIdAtCursor(state: EditorState): string | undefined {
    const pos = state.selection.main.head;
    const tree = syntaxTree(state);
    let node: SyntaxNode | null = tree.resolve(pos, 0);
    while (node) {
      if (node.name === "Element") {
        const id = getElementId(state, node);
        if (id) return id;
      }
      node = node.parent;
    }
    return undefined;
  }

  private emitCursorChange(state: EditorState): void {
    const pos = state.selection.main.head;
    const line = state.doc.lineAt(pos);
    const info: EditorCursorInfo = {
      line: line.number,
      col: pos - line.from + 1,
      xmlId: this.getXmlIdAtCursor(state),
    };
    if (
      this._lastCursorInfo?.line === info.line &&
      this._lastCursorInfo?.col === info.col &&
      this._lastCursorInfo?.xmlId === info.xmlId
    )
      return;
    this._lastCursorInfo = info;
    this.options.onCursorChange(info);
  }

  private restoreCursorContext(view: EditorView, ctx: CursorContext): void {
    const state = view.state;
    const idMap = state.field(XmlIdIndexField);
    let elementRange = idMap.get(ctx.xmlId);

    if (!elementRange) return;

    if (ctx.kind === "new-element" && ctx.childIndex !== undefined) {
      // Find the n-th child element of the parent
      const tree = syntaxTree(state);
      const parentNode = tree.resolve(elementRange.from, 1);
      let elem: SyntaxNode | null = parentNode;
      while (elem && elem.name !== "Element") elem = elem.parent;
      if (elem) {
        let count = 0;
        let child = elem.firstChild;
        while (child) {
          if (child.name === "Element") {
            if (count === ctx.childIndex) {
              elementRange = { from: child.from, to: child.to };
              console.log(
                "Restored New Element Range:",
                elementRange,
                "count=",
                count,
              );
              break;
            }
            count++;
          }
          child = child.nextSibling;
        }
      }
    }

    if (!elementRange) return;
    const tree = syntaxTree(state);
    const node = tree.resolve(elementRange.from, 1);
    let elem: SyntaxNode | null = node;
    while (elem && elem.name !== "Element") elem = elem.parent;
    if (!elem) return;

    let targetPos: number | undefined;

    const traverse = (n: SyntaxNode): boolean => {
      const nodeName = n.name;
      if (nodeName === "Attribute" && ctx.kind === "attribute-value") {
        const nameNode = n.getChild("AttributeName");
        if (
          nameNode &&
          state.doc.sliceString(nameNode.from, nameNode.to) === ctx.attrName
        ) {
          const valueNode = n.getChild("AttributeValue");
          if (valueNode) {
            targetPos = Math.min(
              valueNode.from + 1 + (ctx.offset ?? 0),
              valueNode.to - 1,
            );
            return true;
          }
        }
      }
      if (nodeName === "AttributeName" && ctx.kind === "attribute-name") {
        if (state.doc.sliceString(n.from, n.to) === ctx.attrName) {
          targetPos = n.from + (ctx.offset ?? 0);
          return true;
        }
      }
      if (nodeName === "TagName" && ctx.kind === "tag-name") {
        targetPos = n.from + (ctx.offset ?? 0);
        return true;
      }
      if (nodeName === "Text" && ctx.kind === "text-content") {
        targetPos = n.from + (ctx.offset ?? 0);
        return true;
      }

      let child = n.firstChild;
      while (child) {
        if (traverse(child)) return true;
        child = child.nextSibling;
      }
      return false;
    };

    if (ctx.kind === "element-body" || ctx.kind === "new-element") {
      targetPos = this.findOpenTagEnd(state, elementRange.from);
    } else {
      traverse(elem);
    }

    if (targetPos !== undefined) {
      view.dispatch({
        selection: { anchor: targetPos },
        scrollIntoView: true,
        annotations: [Transaction.addToHistory.of(false)],
      });
    }
  }

  /** Returns the position just before `>` (OpenTag) or `/>` (SelfClosingTag). */
  private findOpenTagEnd(state: EditorState, elementFrom: number): number {
    const tree = syntaxTree(state);
    const node = tree.resolve(elementFrom, 1);

    let elemNode: SyntaxNode | null = node;
    while (elemNode && elemNode.name !== "Element") {
      elemNode = elemNode.parent;
    }
    if (!elemNode) return elementFrom;

    const firstChild = elemNode.firstChild;
    if (!firstChild) return elementFrom;

    if (firstChild.name === "SelfClosingTag") return firstChild.to - 2; // before />
    if (firstChild.name === "OpenTag") return firstChild.to - 1; // before >
    return elementFrom;
  }

  private moveCursorToElement(view: EditorView, xmlId: string | null): void {
    if (!xmlId) return;
    const idMap = view.state.field(XmlIdIndexField);
    const pos = idMap.get(xmlId);
    if (pos) {
      view.dispatch({
        selection: { anchor: pos.from },
        scrollIntoView: true,
        annotations: [Transaction.addToHistory.of(false)],
      });
    }
  }

  /** Creates an undo history boundary to prevent undoing past a conflict point. */
  private createUndoBoundary(view: EditorView): void {
    view.dispatch({
      annotations: [isolateHistory.of("full")],
    });
  }

  // ── Status management ─────────────────────────────────────────────────────

  private updateSyncStateFromDirty(
    state: EditorState,
    dirtyValue: DirtyStateValue,
  ): void {
    if (!dirtyValue.dirty) {
      this.setSyncState("idle");
      return;
    }
    const { dirty } = dirtyValue;

    let hasErr: boolean;
    if (dirty.xmlId) {
      // Check the specific dirty element
      const elem = getElementAtRange(state, dirty.from, dirty.to);
      hasErr = !elem || hasSyntaxError(elem.node);
    } else {
      // No identified element (e.g. broken XML or root-level edit) — check the full tree
      hasErr = hasSyntaxError(syntaxTree(state).topNode);
    }

    if (hasErr) {
      this.setSyncState("invalid", "Syntax error in edited element");
    } else {
      this.setSyncState("dirty");
    }
  }

  private setSyncState(status: SyncStatus, error?: string): void {
    if (this._syncState.status !== status || this._syncState.error !== error) {
      this._syncState = { status, error };
      this.options.onStateChange(this._syncState);
    }
  }

  // ── XML utilities ─────────────────────────────────────────────────────────

  private parseXml(xmlStr: string): {
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
    const dom = parser.parseFromString(xmlStr, "application/xml");
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

  /** Returns the whitespace prefix of the line containing pos. */
  private getBaseIndent(state: EditorState, pos: number): string {
    const line = state.doc.lineAt(pos);
    return state.doc.sliceString(line.from, pos);
  }

  static reindentXml(xmlString: string, baseIndent: string): string {
    if (!baseIndent) return xmlString;
    const lines = xmlString.split("\n");
    return lines
      .map((line, i) => (i === 0 ? line : baseIndent + line))
      .join("\n");
  }
}

// Re-export DirtyStateValue type for tests
export type { DirtyStateValue };
