import { Duration } from '../models/Duration'
import { Fraction } from '../models/Fraction'
import { Measure } from '../models/Measure'
import { Meter } from '../models/Meter'
import { Note } from '../models/Note'
import { Offset } from '../models/Offset'
import type { NoteSelection } from '../models/Selection'
import { getElementById } from './MeiDocument'

/**
 * Calculates the duration of the specified element.
 */
export function getDurationOfElement(el: Element): Duration {
  const chord = el.closest('chord')
  const target = chord || el

  const durAttr = target.getAttribute('dur')
  if (!durAttr) {
    return new Duration(Fraction.zero())
  }

  const dots = parseInt(target.getAttribute('dots') || '0', 10)
  return Duration.fromMei(durAttr, dots)
}

/**
 * Calculates the offset of an element within a measure.
 */
export function getOffsetOfElement(el: Element): Offset {
  const layer = el.closest('layer')
  if (!layer) return Offset.start()

  let currentOffset = Offset.start()
  for (const child of Array.from(layer.children)) {
    if (child.contains(el)) break
    const dur = getDurationOfElement(child)
    currentOffset = currentOffset.add(dur)
  }
  return currentOffset
}

/**
 * Searches for the active meter.
 */
export function getActiveMeter(el: Element): Meter | null {
  const doc = el.ownerDocument
  // For simplicity, search for the first meterSig, but ideally should search for the nearest definition
  const meterSig = doc.querySelector('meterSig')
  if (meterSig) {
    const count = parseInt(meterSig.getAttribute('count') || '4', 10)
    const unit = parseInt(meterSig.getAttribute('unit') || '4', 10)
    return new Meter(count, Duration.fromMei(unit))
  }
  return null
}

/**
 * Retrieves timing information for a specific element.
 */
export function getDurationAndOffset(
  doc: Document,
  xmlId: string,
): { duration: Duration; offset: Offset } | null {
  const el = getElementById(doc, xmlId)
  if (!el) return null

  return {
    duration: getDurationOfElement(el),
    offset: getOffsetOfElement(el),
  }
}

/**
 * Constructs a NoteSelection from an xml:id.
 */
export function findNoteSelectionById(doc: Document, xmlId: string): NoteSelection | null {
  const el = getElementById(doc, xmlId)
  if (!el) return null

  const measure = el.closest('measure')
  const staff = el.closest('staff')
  const layer = el.closest('layer')
  if (!measure || !staff || !layer) return null

  const measureN = parseInt(measure.getAttribute('n') || '1', 10)
  const staffN = parseInt(staff.getAttribute('n') || '1', 10)
  const layerN = parseInt(layer.getAttribute('n') || '1', 10)

  return {
    kind: 'note',
    xmlId,
    address: { measureN, staffN, layerN },
    offset: getOffsetOfElement(el),
  }
}

/**
 * Extracts the entire score structure of the document.
 * Returns a Map with measure numbers (@n) as keys.
 */
export type ScoreModel = Map<
  number,
  {
    xmlId: string
    staves: Map<
      number,
      {
        xmlId: string
        layers: Map<number, Measure>
      }
    >
  }
>

export function buildScoreModel(doc: Document): ScoreModel {
  const model: ScoreModel = new Map()
  const measures = Array.from(doc.querySelectorAll('measure'))

  measures.forEach((mEl) => {
    const mN = parseInt(mEl.getAttribute('n') || '1', 10)
    const staffModels = new Map()

    const staves = Array.from(mEl.querySelectorAll('staff'))
    staves.forEach((sEl) => {
      const sN = parseInt(sEl.getAttribute('n') || '1', 10)
      const layerModels = getMeasureModel(doc, mEl.getAttribute('xml:id') || '')

      // getMeasureModel returns Map<layerId, Measure>, but here layerN is used as the key
      const layerByN = new Map<number, Measure>()
      const layerElements = Array.from(sEl.querySelectorAll('layer'))
      layerElements.forEach((lEl) => {
        const lN = parseInt(lEl.getAttribute('n') || '1', 10)
        const lId = lEl.getAttribute('xml:id') || ''
        const m = layerModels.get(lId)
        if (m) layerByN.set(lN, m)
      })

      staffModels.set(sN, {
        xmlId: sEl.getAttribute('xml:id') || '',
        layers: layerByN,
      })
    })

    model.set(mN, {
      xmlId: mEl.getAttribute('xml:id') || '',
      staves: staffModels,
    })
  })

  return model
}

/**
 * Internal function to build a logical model of a measure by layer.
 */
export function getMeasureModel(doc: Document, measureId: string): Map<string, Measure> {
  const measureEl = getElementById(doc, measureId)
  if (!measureEl || measureEl.localName !== 'measure') return new Map()

  const meter = getActiveMeter(measureEl)
  const result = new Map<string, Measure>()

  const layers = Array.from(measureEl.querySelectorAll('layer'))
  layers.forEach((layerEl, index) => {
    const layerId = layerEl.getAttribute('xml:id') || `layer-${index}`
    const notes: Note[] = []

    for (const child of Array.from(layerEl.children)) {
      if (child.localName === 'note' || child.localName === 'rest') {
        const id = child.getAttribute('xml:id') || ''
        notes.push(new Note(id, getDurationOfElement(child)))
      } else if (child.localName === 'chord') {
        const id =
          child.getAttribute('xml:id') || child.querySelector('note')?.getAttribute('xml:id') || ''
        notes.push(new Note(id, getDurationOfElement(child)))
      } else if (child.localName === 'mRest') {
        const id = child.getAttribute('xml:id') || ''
        const dur = meter ? new Duration(meter.totalLength) : new Duration(Fraction.zero())
        notes.push(new Note(id, dur))
      }
    }

    result.set(layerId, new Measure(measureId, notes, meter))
  })

  return result
}
