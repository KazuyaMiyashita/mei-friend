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
  xmlId: string;
  kind: "attribute-value" | "element-body";
  attrName?: string;
  /** Byte offset within the attribute value text, excluding quotes. */
  offsetInValue?: number;
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
  const tree = syntaxTree(state);

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

        // Walk up to find the Element
        let elemNode: SyntaxNode | null = attrNode.parent;
        while (elemNode && elemNode.name !== "Element") {
          elemNode = elemNode.parent;
        }
        const xmlId = elemNode ? getElementId(state, elemNode) : null;
        if (!xmlId) return null;

        // Offset within attribute value (excluding opening quote)
        const offsetInValue = Math.max(0, pos - node.from - 1);
        return { xmlId, kind: "attribute-value", attrName, offsetInValue };
      }
    }

    if (node.name === "Element") {
      const xmlId = getElementId(state, node);
      if (xmlId) {
        return { xmlId, kind: "element-body" };
      }
    }

    node = node.parent;
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
