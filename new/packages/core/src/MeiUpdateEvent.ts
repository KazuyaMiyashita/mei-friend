/**
 * Represents an update event in the MEI document.
 * This abstracts away the underlying Yjs event structure and provides
 * a simple view of what changed.
 */
export interface MeiUpdateEvent {
  /** The xml:id of the element that was modified. */
  xmlId: string;
  /** The new XML string representation of the modified element. */
  xmlString: string;
  /**
   * The origin identifier of the update, as provided to `update(xmlId, xmlString, origin)`.
   * Useful for distinguishing local application changes from external/plugin changes.
   */
  // biome-ignore lint/suspicious/noExplicitAny: origin can be any type provided by the user.
  origin: any;
  /** True if the update originated locally in this client, false if it came from a remote peer via collaboration. */
  isLocal: boolean;
}
