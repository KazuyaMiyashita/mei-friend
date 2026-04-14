import {
  type AccidGes,
  base40ToPitch,
  type PitchInfo,
  PNAMES,
  type PName,
  pitchToBase40,
} from '../models/Pitch'
import { getElementById, XML_NS } from './MeiDocument'

/** Returns the localName of the element (the name excluding the namespace prefix). */
function localName(el: Element): string {
  return el.localName ?? el.tagName.replace(/^.*:/, '')
}

/** Retrieves pitch information from a note element. Returns null for non-note elements. */
export function getNoteFromDoc(
  doc: Document,
  xmlId: string,
): { el: Element; pname: PName; accidGes: AccidGes; oct: number } | null {
  const el = getElementById(doc, xmlId)
  if (!el) {
    console.warn('[pitch] element not found for id:', xmlId)
    return null
  }
  const elName = localName(el)
  if (elName !== 'note') {
    console.warn('[pitch] element is not a note:', elName, 'id:', xmlId)
    return null
  }
  const pname = el.getAttribute('pname') as PName | null
  if (!pname || !PNAMES.includes(pname)) {
    console.warn('[pitch] note has no valid pname:', pname)
    return null
  }
  const accidGes = (el.getAttribute('accid.ges') ?? 'n') as AccidGes
  const oct = parseInt(el.getAttribute('oct') ?? '4', 10)
  return { el, pname, accidGes, oct }
}

/**
 * For a chord element, returns a list of xml:ids for its direct note children.
 */
export function resolveNoteIds(doc: Document, xmlId: string): string[] {
  const el = getElementById(doc, xmlId)
  if (!el) return []
  const name = localName(el)
  if (name === 'note') return [xmlId]
  if (name === 'chord') {
    const notes: string[] = []
    for (let i = 0; i < el.children.length; i++) {
      const child = el.children[i]
      if (localName(child) === 'note') {
        const childId = child.getAttributeNS(XML_NS, 'id') ?? child.getAttribute('xml:id')
        if (childId) notes.push(childId)
      }
    }
    return notes
  }
  return []
}

export function applyPitchToElement(el: Element, { pname, accidGes, oct }: PitchInfo): void {
  el.setAttribute('pname', pname)
  el.setAttribute('oct', String(oct))
  if (accidGes === 'n') el.removeAttribute('accid.ges')
  else el.setAttribute('accid.ges', accidGes)
}

// ─── Manipulation API (Document version) ───────────────────────────────────────────────────

/** Changes the pitch of the selected note element by delta semitones. */
export function pitchChromaticInDoc(doc: Document, xmlId: string, delta: 1 | -1): boolean {
  const ids = resolveNoteIds(doc, xmlId)
  if (ids.length === 0) return false
  let changed = false
  for (const id of ids) {
    const note = getNoteFromDoc(doc, id)
    if (!note) continue
    const newPitch = base40ToPitch(pitchToBase40(note) + delta)
    applyPitchToElement(note.el, newPitch)
    changed = true
  }
  return changed
}

/** Changes the pitch of the selected note element diatonically by delta steps. */
export function pitchDiatonicInDoc(doc: Document, xmlId: string, delta: 1 | -1): boolean {
  const ids = resolveNoteIds(doc, xmlId)
  if (ids.length === 0) return false
  let changed = false
  for (const id of ids) {
    const note = getNoteFromDoc(doc, id)
    if (!note) continue
    const { el, pname, oct } = note
    const currentStep = PNAMES.indexOf(pname)
    const nextStep = currentStep + delta
    let newOct = oct
    let newPnameIdx: number
    if (nextStep < 0) {
      newPnameIdx = PNAMES.length - 1
      newOct = oct - 1
    } else if (nextStep >= PNAMES.length) {
      newPnameIdx = 0
      newOct = oct + 1
    } else {
      newPnameIdx = nextStep
    }
    applyPitchToElement(el, { pname: PNAMES[newPnameIdx], accidGes: note.accidGes, oct: newOct })
    changed = true
  }
  return changed
}

/** Changes the octave of the selected note element by delta octaves. */
export function pitchOctaveInDoc(doc: Document, xmlId: string, delta: 1 | -1): boolean {
  const ids = resolveNoteIds(doc, xmlId)
  if (ids.length === 0) return false
  let changed = false
  for (const id of ids) {
    const note = getNoteFromDoc(doc, id)
    if (!note) continue
    applyPitchToElement(note.el, {
      pname: note.pname,
      accidGes: note.accidGes,
      oct: note.oct + delta,
    })
    changed = true
  }
  return changed
}

// ─── Context Helpers ────────────────────────────────────────────────────────

function findPreviousNote(doc: Document, anchorId: string): Element | null {
  const anchor = getElementById(doc, anchorId)
  if (!anchor) return null

  if (localName(anchor) === 'layer') {
    const notes = anchor.getElementsByTagName('note')
    return notes.length > 0 ? notes[notes.length - 1] : null
  }

  let sibling: Element | null = anchor.previousElementSibling
  while (sibling) {
    if (localName(sibling) === 'note') return sibling
    if (localName(sibling) === 'chord') {
      const childNotes = sibling.getElementsByTagName('note')
      if (childNotes.length > 0) return childNotes[childNotes.length - 1]
    }
    sibling = sibling.previousElementSibling
  }

  const layer = anchor.closest?.('layer') ?? anchor.parentElement?.closest?.('layer') ?? null
  const staff = layer?.parentElement
  const measure = staff?.parentElement
  const prevMeasure = measure?.previousElementSibling
  if (prevMeasure && localName(prevMeasure) === 'measure') {
    const staffN = staff?.getAttribute('n') ?? '1'
    const layerN = layer?.getAttribute('n') ?? '1'
    const prevLayer = prevMeasure.querySelector(`staff[n="${staffN}"] layer[n="${layerN}"]`)
    if (prevLayer) {
      const prevNotes = prevLayer.getElementsByTagName('note')
      if (prevNotes.length > 0) return prevNotes[prevNotes.length - 1]
    }
  }

  return null
}

export function guessOctave(doc: Document, anchorId: string, pname: PName): number {
  const prevNote = findPreviousNote(doc, anchorId)
  if (!prevNote) return 4

  const prevPname = prevNote.getAttribute('pname') as PName | null
  const prevOct = parseInt(prevNote.getAttribute('oct') ?? '4', 10)
  if (!prevPname || !PNAMES.includes(prevPname)) return 4

  const prevStep = PNAMES.indexOf(prevPname)
  const targetStep = PNAMES.indexOf(pname)

  let bestOct = prevOct
  let bestDist = Infinity

  for (const oct of [prevOct - 1, prevOct, prevOct + 1]) {
    const dist = Math.abs((oct - prevOct) * 7 + (targetStep - prevStep))
    if (dist < bestDist) {
      bestDist = dist
      bestOct = oct
    }
  }

  return bestOct
}

const SHARP_ORDER: PName[] = ['f', 'c', 'g', 'd', 'a', 'e', 'b']
const FLAT_ORDER: PName[] = ['b', 'e', 'a', 'd', 'g', 'c', 'f']

export function getEffectiveKeySig(
  doc: Document,
  anchorId: string,
): Array<{ pname: PName; accid: AccidGes }> {
  const anchor = getElementById(doc, anchorId)
  if (!anchor) return []

  const staffN = anchor.closest?.('staff')?.getAttribute('n') ?? '1'

  const keySigs = Array.from(doc.querySelectorAll('keySig, staffDef keySig'))
  let bestKeySig: Element | null = null
  for (const ks of keySigs) {
    const staffDef = ks.closest?.('staffDef')
    if (staffDef && staffDef.getAttribute('n') !== staffN) continue
    bestKeySig = ks
  }

  if (!bestKeySig) return []

  const sig = bestKeySig.getAttribute('sig')
  const fifthsAttr = bestKeySig.getAttribute('fifths')

  let count = 0
  let isSharp = true

  if (sig) {
    const m = /^(\d+)([sf])$/.exec(sig)
    if (m) {
      count = parseInt(m[1], 10)
      isSharp = m[2] === 's'
    }
  } else if (fifthsAttr) {
    const fifths = parseInt(fifthsAttr, 10)
    if (fifths > 0) {
      count = fifths
      isSharp = true
    } else if (fifths < 0) {
      count = -fifths
      isSharp = false
    }
  }

  const order = isSharp ? SHARP_ORDER : FLAT_ORDER
  const accid: AccidGes = isSharp ? 's' : 'f'
  return order.slice(0, count).map((p) => ({ pname: p, accid }))
}
