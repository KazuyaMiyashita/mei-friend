/** MEI namespace */
export const MEI_NS = 'http://www.music-encoding.org/ns/mei'
/** XML namespace */
export const XML_NS = 'http://www.w3.org/XML/1998/namespace'

/**
 * Parses an XML string and returns a Document.
 */
export function parseXml(xmlText: string): Document {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')
  if (doc.querySelector('parsererror')) {
    throw new Error('XML Parse Error')
  }
  return doc
}

/**
 * Serializes an XML Document to a string.
 */
export function xmlToString(doc: Document): string {
  return new XMLSerializer().serializeToString(doc)
}

/**
 * Deep clones a Document.
 */
export function cloneDocument(doc: Document): Document {
  return doc.cloneNode(true) as Document
}

/**
 * Finds an element by xml:id (considering namespaces).
 */
export function getElementById(doc: Document, id: string): Element | null {
  try {
    const el = doc.querySelector(`[*|id="${id}"]`)
    if (el) return el
  } catch {
    // ignore
  }
  const all = doc.getElementsByTagName('*')
  for (let i = 0; i < all.length; i++) {
    const el = all[i]
    const elId = el.getAttributeNS(XML_NS, 'id') ?? el.getAttribute('xml:id')
    if (elId === id) return el
  }
  return null
}

/**
 * Container for MEI score documents.
 * Provides helpers to behave immutably internally.
 */
export class MeiDocument {
  private readonly doc: Document

  constructor(input: string | Document) {
    this.doc = typeof input === 'string' ? parseXml(input) : input
  }

  xmlToString(): string {
    return xmlToString(this.doc)
  }

  /**
   * Returns the underlying Document object directly for performance.
   * Use this for read-only queries (e.g. querySelector, buildScoreModel) only.
   * Direct modification of the returned Document is prohibited —
   * use MeiFriend.edit() for all mutations so that plugins and history are notified.
   */
  getDocument(): Document {
    return this.doc
  }

  /**
   * Clones the document and returns a new instance with changes applied.
   */
  update(fn: (doc: Document) => void): MeiDocument {
    const nextDoc = cloneDocument(this.doc)
    fn(nextDoc)
    return new MeiDocument(nextDoc)
  }
}
