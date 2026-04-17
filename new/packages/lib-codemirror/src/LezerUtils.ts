import { syntaxTree } from "@codemirror/language";
import { type EditorState, StateField } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";

export interface DirtyElement {
  node: SyntaxNode;
  text: string;
  from: number;
  to: number;
}

export type XmlIdMap = Map<string, { from: number; to: number }>;

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

function getElementId(state: EditorState, node: SyntaxNode): string | null {
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
            // AttributeValue usually includes the quotes
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
