import { getElementById, MEI_NS, XML_NS } from './MeiDocument'

/** xml:id style */
export type XmlIdStyle = 'Original' | 'Base36' | 'mei-friend'

/**
 * Generates a new xml:id.
 */
export function generateXmlId(tagName: string, style: XmlIdStyle = 'mei-friend'): string {
  if (style === 'mei-friend') {
    return `${tagName}-${Math.random().toString(36).slice(2, 9)}`
  }
  if (style === 'Base36') {
    return `${tagName}-${Date.now().toString(36)}`
  }
  return `${tagName}-${crypto.randomUUID().split('-')[0]}`
}

/**
 * Removes the leading # from an xml:id.
 */
export function rmHash(id: string): string {
  return id.startsWith('#') ? id.slice(1) : id
}

/**
 * Returns the line number (0-based) corresponding to the xml:id in the XML text.
 * Returns -1 if not found.
 */
export function findLineOfId(xmlText: string, xmlId: string): number {
  const pattern = new RegExp(`xml:id=["']${escapeRegex(xmlId)}["']`)
  const lines = xmlText.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) return i
  }
  return -1
}

/**
 * Returns the character offset (starting byte) corresponding to the xml:id in the XML text.
 * Returns -1 if not found.
 */
export function findOffsetOfId(xmlText: string, xmlId: string): number {
  const pattern = new RegExp(`xml:id=["']${escapeRegex(xmlId)}["']`)
  const match = pattern.exec(xmlText)
  if (!match) return -1
  // Search for the position of < before the xml:id=... position
  let pos = match.index
  while (pos > 0 && xmlText[pos] !== '<') pos--
  return pos
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Collects all xml:id attributes under the specified element.
 */
export function collectIds(root: Element | Document): string[] {
  const elements = root.querySelectorAll('[*|id]')
  return Array.from(elements)
    .map((el) => el.getAttributeNS(XML_NS, 'id') ?? el.getAttribute('xml:id') ?? '')
    .filter(Boolean)
}

/**
 * Adds xml:id to all elements if missing (destructive).
 */
export function addMissingXmlIds(doc: Document, style: XmlIdStyle = 'mei-friend'): number {
  let added = 0
  const allElements = doc.querySelectorAll('*')
  allElements.forEach((el) => {
    if (!el.hasAttributeNS(XML_NS, 'id') && !el.hasAttribute('xml:id')) {
      const id = generateXmlId(el.tagName.replace(/^mei:/, ''), style)
      el.setAttributeNS(XML_NS, 'xml:id', id)
      added++
    }
  })
  return added
}

/** List of URI attribute names (attributes that might be referenced by other elements) */
const URI_ATTRS = [
  'startid',
  'endid',
  'corresp',
  'next',
  'prev',
  'sameas',
  'copyof',
  'synch',
  'follows',
  'precedes',
  'plist',
]

/**
 * Removes xml:id attributes from XML that are not referenced elsewhere (destructive).
 */
export function removeXmlIds(doc: Document): { removed: number; kept: number } {
  // Collect referenced IDs
  const referencedIds = new Set<string>()
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of URI_ATTRS) {
      const val = el.getAttribute(attr)
      if (val) {
        val.split(/\s+/).forEach((v) => {
          referencedIds.add(rmHash(v))
        })
      }
    }
  })

  let removed = 0
  let kept = 0
  doc.querySelectorAll('[*|id]').forEach((el) => {
    const id = el.getAttributeNS(XML_NS, 'id') ?? el.getAttribute('xml:id') ?? ''
    if (referencedIds.has(id)) {
      kept++
    } else {
      el.removeAttributeNS(XML_NS, 'id')
      el.removeAttribute('xml:id')
      removed++
    }
  })

  return { removed, kept }
}

/**
 * Renumbers the @n attribute of measure elements sequentially starting from startNum (destructive).
 */
export function renumberMeasures(doc: Document, startNum = 1): number {
  const measures = doc.querySelectorAll('measure')
  let n = startNum
  measures.forEach((m) => {
    m.setAttribute('n', String(n++))
  })
  return n - startNum
}

// ── Element Insertion ──────────────────────────────────────────────────────────────

export interface SpanElementOptions {
  elName: string
  startId: string
  endId?: string
  placement?: string
  form?: string
  style?: XmlIdStyle
}

export function insertSpanElement(doc: Document, opts: SpanElementOptions): string | null {
  const startEl = getElementById(doc, opts.startId)
  if (!startEl) return null

  const measure = startEl.closest('measure')
  if (!measure) return null

  const newId = generateXmlId(opts.elName, opts.style)
  const newEl = doc.createElementNS(MEI_NS, opts.elName)
  newEl.setAttributeNS(XML_NS, 'xml:id', newId)
  newEl.setAttribute('startid', `#${opts.startId}`)
  if (opts.endId) newEl.setAttribute('endid', `#${opts.endId}`)

  const staffN = startEl.closest('staff')?.getAttribute('n')
  if (staffN) newEl.setAttribute('staff', staffN)

  if (opts.placement && ['slur', 'tie', 'phrase'].includes(opts.elName)) {
    newEl.setAttribute('curvedir', opts.placement)
  } else if (opts.placement && opts.elName !== 'arpeg') {
    newEl.setAttribute('place', opts.placement)
  }

  if (opts.form && opts.elName === 'hairpin') {
    newEl.setAttribute('form', opts.form)
  }

  measure.appendChild(newEl)
  return newId
}

export interface InsertNoteOptions {
  anchorId: string
  pname: string
  oct: string
  dur: string
  dots?: number
  accidGes?: string
  style?: XmlIdStyle
}

export function insertNote(doc: Document, opts: InsertNoteOptions): string | null {
  const anchor = getElementById(doc, opts.anchorId)
  if (!anchor) return null

  const newNote = doc.createElementNS(MEI_NS, 'note')
  const newId = generateXmlId('note', opts.style)
  newNote.setAttributeNS(XML_NS, 'xml:id', newId)
  newNote.setAttribute('pname', opts.pname)
  newNote.setAttribute('oct', opts.oct)
  newNote.setAttribute('dur', opts.dur)
  if (opts.dots && opts.dots > 0) newNote.setAttribute('dots', String(opts.dots))
  if (opts.accidGes && opts.accidGes !== 'n') newNote.setAttribute('accid.ges', opts.accidGes)

  if (anchor.tagName === 'layer') {
    anchor.prepend(newNote)
  } else {
    anchor.insertAdjacentElement('afterend', newNote)
  }

  return newId
}

export interface InsertRestOptions {
  anchorId: string
  dur: string
  dots?: number
  style?: XmlIdStyle
}

export function insertRest(doc: Document, opts: InsertRestOptions): string | null {
  const anchor = getElementById(doc, opts.anchorId)
  if (!anchor) return null

  const newRest = doc.createElementNS(MEI_NS, 'rest')
  const newId = generateXmlId('rest', opts.style)
  newRest.setAttributeNS(XML_NS, 'xml:id', newId)
  newRest.setAttribute('dur', opts.dur)
  if (opts.dots && opts.dots > 0) newRest.setAttribute('dots', String(opts.dots))

  if (anchor.tagName === 'layer') {
    anchor.prepend(newRest)
  } else {
    anchor.insertAdjacentElement('afterend', newRest)
  }

  return newId
}

export interface PointElementOptions {
  elName: string
  startId: string
  placement?: string
  content?: string
  style?: XmlIdStyle
}

export function insertPointElement(doc: Document, opts: PointElementOptions): string | null {
  const startEl = getElementById(doc, opts.startId)
  if (!startEl) return null

  const measure = startEl.closest('measure')
  if (!measure) return null

  const newId = generateXmlId(opts.elName, opts.style)
  const newEl = doc.createElementNS(MEI_NS, opts.elName)
  newEl.setAttributeNS(XML_NS, 'xml:id', newId)
  newEl.setAttribute('startid', `#${opts.startId}`)

  const staffN = startEl.closest('staff')?.getAttribute('n')
  if (staffN) newEl.setAttribute('staff', staffN)

  if (opts.placement) newEl.setAttribute('place', opts.placement)
  if (opts.content) newEl.appendChild(doc.createTextNode(opts.content))

  measure.appendChild(newEl)
  return newId
}

/**
 * Cursor navigation: Retrieves the ID of the previous or next element (pure function).
 */
export function navigateCursor(
  doc: Document,
  currentId: string,
  direction: 'left' | 'right' | 'up' | 'down',
): string | null {
  const current = getElementById(doc, currentId)
  if (!current) return null

  if (direction === 'left' || direction === 'right') {
    const sibling =
      direction === 'left' ? current.previousElementSibling : current.nextElementSibling
    if (sibling && (sibling.tagName === 'note' || sibling.tagName === 'rest')) {
      return sibling.getAttributeNS(XML_NS, 'id') || sibling.getAttribute('xml:id')
    }
    // To the adjacent measure
    const measure = current.closest('measure')
    const staff = current.closest('staff')
    const layer = current.closest('layer')
    if (!measure || !staff || !layer) return null

    const nextMeasure =
      direction === 'left' ? measure.previousElementSibling : measure.nextElementSibling
    if (nextMeasure && nextMeasure.tagName === 'measure') {
      const staffN = staff.getAttribute('n')
      const layerN = layer.getAttribute('n')
      const targetStaff = nextMeasure.querySelector(`staff[n="${staffN}"]`)
      const targetLayer = targetStaff?.querySelector(`layer[n="${layerN}"]`)
      if (targetLayer) {
        const target =
          direction === 'left' ? targetLayer.lastElementChild : targetLayer.firstElementChild
        return (
          target?.getAttributeNS(XML_NS, 'id') ||
          target?.getAttribute('xml:id') ||
          targetLayer.getAttributeNS(XML_NS, 'id') ||
          targetLayer.getAttribute('xml:id')
        )
      }
    }
  }

  if (direction === 'up' || direction === 'down') {
    const staff = current.closest('staff')
    const measure = current.closest('measure')
    if (!staff || !measure) return null

    const staffN = parseInt(staff.getAttribute('n') || '1', 10)
    const targetStaffN = direction === 'up' ? staffN - 1 : staffN + 1
    const targetStaff = measure.querySelector(`staff[n="${targetStaffN}"]`)
    const targetLayer = targetStaff?.querySelector('layer')
    if (targetLayer) {
      const target = targetLayer.firstElementChild || targetLayer
      return target.getAttributeNS(XML_NS, 'id') || target.getAttribute('xml:id')
    }
  }

  return null
}

/** Sets or changes the accidental of the selected note (destructive). */
export function setAccidental(doc: Document, xmlId: string, accid: string): boolean {
  const el = getElementById(doc, xmlId)
  if (!el || el.tagName !== 'note') return false

  const existing = el.querySelector('accid')
  if (existing) existing.remove()

  if (accid && accid !== 'n') {
    const accidEl = doc.createElementNS(MEI_NS, 'accid')
    const newId = generateXmlId('accid')
    accidEl.setAttributeNS(XML_NS, 'xml:id', newId)
    accidEl.setAttribute('accid', accid)
    el.appendChild(accidEl)
  }

  return true
}

/** Sets or toggles the @stem.dir of a note/chord (destructive). */
export function toggleStemDir(doc: Document, xmlId: string): boolean {
  const el = getElementById(doc, xmlId)
  if (!el) return false

  const target = el.tagName === 'note' ? (el.closest('chord') ?? el) : el
  const current = target.getAttribute('stem.dir')
  if (current === 'up') target.setAttribute('stem.dir', 'down')
  else if (current === 'down') target.removeAttribute('stem.dir')
  else target.setAttribute('stem.dir', 'up')

  return true
}
