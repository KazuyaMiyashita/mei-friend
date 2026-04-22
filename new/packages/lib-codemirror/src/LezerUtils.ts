import { xml } from "@codemirror/lang-xml";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { EditorState, StateField } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";

export interface DirtyElement {
  node: SyntaxNode;
  text: string;
  from: number;
  to: number;
}

export type XmlIdMap = Map<string, { from: number; to: number }>;

/** Cursor context used for restoring cursor position after Apply/Refresh. */
export interface CursorContext {
  /** The target element's ID, or its parent's ID if it's a new element. */
  xmlId: string;
  kind:
    | "attribute-value"
    | "attribute-name"
    | "text-content"
    | "tag-name"
    | "element-body"
    | "new-element";
  attrName?: string;
  /** The relative byte offset within the specific part being edited. */
  offset?: number;
  /** If kind === "new-element", which child index this is under the parent. */
  childIndex?: number;
}

/**
 * A StateField that maintains a map of xml:id to their [from, to] positions in the document.
 */
export const XmlIdIndexField = StateField.define<XmlIdMap>({
  create(state) {
    return buildIndex(state);
  },
  update(value, tr) {
    if (tr.docChanged) {
      return buildIndex(tr.state);
    }
    return value;
  },
});

function buildIndex(state: EditorState): XmlIdMap {
  const map: XmlIdMap = new Map();
  // ensureSyntaxTree forces a complete synchronous parse. Without this,
  // syntaxTree() returns only the lazily-parsed fragment available so far,
  // which is empty on initial load and makes xml:id lookups fail until an
  // edit triggers further parsing.
  const tree =
    ensureSyntaxTree(state, state.doc.length, 5000) ?? syntaxTree(state);
  // TODO: This rebuilds the full index on every document change, which
  // includes a synchronous full-document parse via ensureSyntaxTree.
  // For large MEI files this may become a performance bottleneck.
  // Consider an incremental approach that only re-scans the changed range
  // and patches the existing map rather than rebuilding from scratch.

  tree.iterate({
    enter: (node) => {
      if (node.name === "Element") {
        const id = getElementId(state, node.node);
        if (id) {
          map.set(id, { from: node.from, to: node.to });
        }
      }
    },
  });

  return map;
}

export function getElementId(
  state: EditorState,
  node: SyntaxNode,
): string | null {
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
 * Finds the smallest XML Element node that encapsulates the given range.
 */
export function getElementAtRange(
  state: EditorState,
  from: number,
  to: number,
): DirtyElement | null {
  const tree = syntaxTree(state);

  // We start at the beginning of the range.
  const cursor = tree.cursorAt(from, 1);

  // Ascend to find an "Element" node that fully contains the [from, to] range.
  while (cursor.node) {
    if (cursor.name === "Element" && cursor.from <= from && cursor.to >= to) {
      if (!hasSyntaxError(cursor.node)) {
        return {
          node: cursor.node,
          text: state.doc.sliceString(cursor.from, cursor.to),
          from: cursor.from,
          to: cursor.to,
        };
      }
    }
    if (!cursor.parent()) break;
  }

  return null;
}

/**
 * Checks if the given node or any of its descendants contain a syntax error.
 */
export function hasSyntaxError(node: SyntaxNode): boolean {
  let hasError = false;
  node.cursor().iterate((n) => {
    if (
      n.name === "Error" ||
      n.name === "⚠" ||
      n.type.isError ||
      n.name === "MismatchedCloseTag"
    ) {
      hasError = true;
      return false; // Stop iteration
    }
    return true;
  });
  return hasError;
}

/**
 * Captures the cursor context (which element and attribute the cursor is in)
 * for later restoration after Apply or Refresh.
 */
export function captureCursorContext(state: EditorState): CursorContext | null {
  const pos = state.selection.main.head;
  const tree = syntaxTree(state);
  let node: SyntaxNode | null = tree.resolve(pos, 0);

  while (node) {
    if (node.name === "AttributeValue") {
      const attrNode = node.parent;
      if (attrNode?.name === "Attribute") {
        const nameNode = attrNode.getChild("AttributeName");
        const attrName = nameNode
          ? state.doc.sliceString(nameNode.from, nameNode.to)
          : undefined;

        const elemNode = findEnclosingElement(attrNode);
        const ctx = getElementOrParentContext(
          state,
          elemNode,
          "attribute-value",
        );
        if (ctx) {
          ctx.attrName = attrName;
          ctx.offset = Math.max(0, pos - node.from - 1); // exclude quote
          return ctx;
        }
      }
    }

    if (node.name === "AttributeName") {
      const attrNode = node.parent;
      const attrName = state.doc.sliceString(node.from, node.to);
      const elemNode = findEnclosingElement(attrNode);
      const ctx = getElementOrParentContext(state, elemNode, "attribute-name");
      if (ctx) {
        ctx.attrName = attrName;
        ctx.offset = pos - node.from;
        return ctx;
      }
    }

    if (node.name === "TagName") {
      const elemNode = findEnclosingElement(node);
      const ctx = getElementOrParentContext(state, elemNode, "tag-name");
      if (ctx) {
        ctx.offset = pos - node.from;
        return ctx;
      }
    }

    if (node.name === "Text") {
      const elemNode = findEnclosingElement(node);
      const ctx = getElementOrParentContext(state, elemNode, "text-content");
      if (ctx) {
        ctx.offset = pos - node.from;
        return ctx;
      }
    }

    if (node.name === "Element") {
      return getElementOrParentContext(state, node, "element-body");
    }

    node = node.parent;
  }

  return null;
}

function findEnclosingElement(node: SyntaxNode | null): SyntaxNode | null {
  let curr = node;
  while (curr && curr.name !== "Element") {
    curr = curr.parent;
  }
  return curr;
}

function getElementOrParentContext(
  state: EditorState,
  node: SyntaxNode | null,
  kind: CursorContext["kind"],
): CursorContext | null {
  if (!node) return null;
  const id = getElementId(state, node);
  if (id) {
    return { xmlId: id, kind };
  }

  // No ID - find closest ancestor with an ID
  let curr: SyntaxNode | null = node;

  while (curr) {
    const parent: SyntaxNode | null = curr.parent;
    if (parent && parent.name === "Element") {
      const parentId = getElementId(state, parent);
      if (parentId) {
        // Calculate childIndex: how many Element siblings precede curr
        let idx = 0;
        let sibling = parent.firstChild;
        while (sibling && sibling.from < curr.from) {
          if (sibling.name === "Element") {
            // console.log("  Sibling:", sibling.name, "from:", sibling.from, "to:", sibling.to);
            idx++;
          }
          sibling = sibling.nextSibling;
        }
        return { xmlId: parentId, kind, childIndex: idx };
      }
    }
    curr = parent;
  }

  return null;
}

/**
 * Finds the AttributeValue node range for the given attribute name within an element.
 * Returns the range including surrounding quotes.
 */
export function findAttributeNode(
  state: EditorState,
  elementFrom: number,
  attrName: string,
): { from: number; to: number } | null {
  const tree = syntaxTree(state);
  const elemNode = tree.resolve(elementFrom, 1);

  // Find the element node
  let elem: SyntaxNode | null = elemNode;
  while (elem && elem.name !== "Element") {
    elem = elem.parent;
  }
  if (!elem) return null;

  const tagNode = elem.firstChild;
  if (
    !tagNode ||
    (tagNode.name !== "OpenTag" && tagNode.name !== "SelfClosingTag")
  ) {
    return null;
  }

  let curr: SyntaxNode | null = tagNode.firstChild;
  while (curr) {
    if (curr.name === "Attribute") {
      const nameNode = curr.getChild("AttributeName");
      if (
        nameNode &&
        state.doc.sliceString(nameNode.from, nameNode.to) === attrName
      ) {
        const valueNode = curr.getChild("AttributeValue");
        if (valueNode) {
          return { from: valueNode.from, to: valueNode.to };
        }
      }
    }
    curr = curr.nextSibling;
  }
  return null;
}

/**
 * Returns the xml:id values of all ancestor Element nodes at the given position.
 */
export function getAncestorElementIds(
  state: EditorState,
  from: number,
): string[] {
  const ids: string[] = [];
  let node: SyntaxNode | null = syntaxTree(state).resolve(from, 0).parent;
  while (node) {
    if (node.name === "Element") {
      const id = getElementId(state, node);
      if (id) ids.push(id);
    }
    node = node.parent;
  }
  return ids;
}

/**
 * Splices the dirty element's current text into a fresh MeiFriend-serialized document.
 * Used when an external document-replace arrives but the dirty element is unchanged.
 * Returns the combined document and the new [from, to] range of the dirty element,
 * or null if the dirty element was not found in newXml.
 */
export function spliceDirtyIntoNewXml(
  newXml: string,
  dirtyElementId: string,
  dirtyText: string,
): { result: string; from: number; to: number } | null {
  const tempState = EditorState.create({
    doc: newXml,
    extensions: [xml()],
  });

  // Force complete synchronous parse to ensure we find all elements
  const tree =
    ensureSyntaxTree(tempState, tempState.doc.length, 5000) ??
    syntaxTree(tempState);

  let targetRange: { from: number; to: number } | null = null;

  tree.iterate({
    enter: (node) => {
      if (targetRange) return false; // Already found
      if (node.name === "Element") {
        const id = getElementId(tempState, node.node);
        if (id === dirtyElementId) {
          targetRange = { from: node.from, to: node.to };
          return false;
        }
      }
    },
  });

  if (!targetRange) return null;

  const { from, to } = targetRange;
  const result = newXml.slice(0, from) + dirtyText + newXml.slice(to);
  const newTo = from + dirtyText.length;

  return { result, from, to: newTo };
}
