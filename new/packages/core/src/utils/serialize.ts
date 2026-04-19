import * as Y from "yjs";

/**
 * Escapes a string for use in XML.
 */
export function escapeXml(unsafe: string): string {
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

/**
 * Serializes a Yjs XML node back to an MEI XML string.
 * @param yNode The Y.XmlFragment, Y.XmlElement, or Y.XmlText to serialize.
 * @param level The current indentation level.
 * @returns The serialized XML string.
 */
export function serializeYNode(
  yNode: Y.XmlFragment | Y.XmlElement | Y.XmlText,
  level = 0,
): string {
  const indent = "  ".repeat(level);

  if (yNode instanceof Y.XmlElement) {
    const name = yNode.nodeName;

    // Skip internal root wrappers
    if (name === "__root__") {
      const childrenStrs: string[] = [];
      for (const child of yNode.toArray()) {
        const serializedChild = serializeYNode(
          child as Y.XmlFragment | Y.XmlElement | Y.XmlText,
          level,
        );
        if (serializedChild) childrenStrs.push(serializedChild);
      }
      return childrenStrs.join("\n");
    }

    const attrs = yNode.getAttributes();
    let attrStr = "";

    // Sort attributes to ensure deterministic output (xml:id first)
    const keys = Object.keys(attrs)
      .filter((key) => attrs[key] !== undefined)
      .sort((a, b) => {
        if (a === "xml:id") return -1;
        if (b === "xml:id") return 1;
        return a.localeCompare(b);
      });

    for (const key of keys) {
      attrStr += ` ${key}="${escapeXml(attrs[key])}"`;
    }

    const children = yNode.toArray();

    if (children.length === 0) {
      return `${indent}<${name}${attrStr}/>`;
    }

    // Handle mixed content or text-only content without adding newlines
    const hasTextContent = children.some((child) => child instanceof Y.XmlText);

    if (hasTextContent) {
      const childrenStrs: string[] = [];
      for (const child of children) {
        childrenStrs.push(
          serializeYNode(child as Y.XmlFragment | Y.XmlElement | Y.XmlText, 0),
        );
      }
      return `${indent}<${name}${attrStr}>${childrenStrs.join("")}</${name}>`;
    }

    // Standard nested element formatting
    const childrenStrs: string[] = [];
    for (const child of children) {
      childrenStrs.push(
        serializeYNode(
          child as Y.XmlFragment | Y.XmlElement | Y.XmlText,
          level + 1,
        ),
      );
    }

    return `${indent}<${name}${attrStr}>\n${childrenStrs.join("\n")}\n${indent}</${name}>`;
  } else if (yNode instanceof Y.XmlText) {
    return escapeXml(yNode.toString());
  } else if (yNode instanceof Y.XmlFragment) {
    const childrenStrs: string[] = [];
    for (const child of yNode.toArray()) {
      const serializedChild = serializeYNode(
        child as Y.XmlFragment | Y.XmlElement | Y.XmlText,
        level,
      );
      if (serializedChild) childrenStrs.push(serializedChild);
    }
    return childrenStrs.join("\n");
  }

  return "";
}
