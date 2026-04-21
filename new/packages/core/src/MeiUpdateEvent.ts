/** Emitted when a specific element in the document was updated. */
export interface ElementUpdateEvent {
  readonly type: "element-update";
  /** The xml:id of the element that was modified. */
  readonly xmlId: string;
  /** The new XML string representation of the modified element. */
  readonly xmlString: string;
  /**
   * The origin identifier of the update, as provided to `update(xmlId, xmlString, origin)`.
   * Useful for distinguishing local application changes from external/plugin changes.
   */
  // biome-ignore lint/suspicious/noExplicitAny: origin can be any type provided by the user.
  readonly origin: any;
  /** True if the update originated locally in this client, false if it came from a remote peer via collaboration. */
  readonly isLocal: boolean;
}

/**
 * Emitted when the entire document was replaced via `replaceXmlString`.
 * Both `xmlId` and `xmlString` refer to the root <mei> element of the **new** document.
 */
export interface DocumentReplaceEvent {
  readonly type: "document-replace";
  /** The xml:id of the new root <mei> element after replacement. */
  readonly xmlId: string;
  /** The XML string of the new root <mei> element (full subtree). */
  readonly xmlString: string;
  /**
   * The origin identifier of the update, as provided to `replaceXmlString(xmlString, origin)`.
   * Useful for distinguishing local application changes from external/plugin changes.
   */
  // biome-ignore lint/suspicious/noExplicitAny: origin can be any type provided by the user.
  readonly origin: any;
  /** True if the update originated locally in this client, false if it came from a remote peer via collaboration. */
  readonly isLocal: boolean;
}

/**
 * Represents an update event in the MEI document.
 * This is a discriminated union — use `event.type` to narrow to the specific event kind.
 */
export type MeiUpdateEvent = ElementUpdateEvent | DocumentReplaceEvent;
