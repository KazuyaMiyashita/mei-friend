import { Offset } from '../models/Offset'
import type { NoteSelection } from '../models/Selection'
import type { ScoreModel } from './measureCalculations'

/**
 * Performs navigation based on offset and returns the next selection state.
 */
export function navigateAddressByOffset(
  scoreModel: ScoreModel,
  current: NoteSelection,
  direction: 'left' | 'right' | 'up' | 'down',
): NoteSelection | null {
  const { measureN, staffN, layerN } = current.address

  const measure = scoreModel.get(measureN)
  const staff = measure?.staves.get(staffN)
  const layer = staff?.layers.get(layerN)
  if (!layer) return null

  if (direction === 'left' || direction === 'right') {
    const idx = layer.notes.findIndex((n) => n.id === current.xmlId)
    if (idx === -1) return null

    if (direction === 'right') {
      if (idx < layer.notes.length - 1) {
        const nextNote = layer.notes[idx + 1]
        const nextOffset = current.offset.add(layer.notes[idx].duration)
        return {
          kind: 'note',
          xmlId: nextNote.id,
          address: current.address,
          offset: nextOffset,
        }
      } else {
        const nextM = scoreModel.get(measureN + 1)
        const nextL = nextM?.staves.get(staffN)?.layers.get(layerN)
        if (nextL && nextL.notes.length > 0) {
          return {
            kind: 'note',
            xmlId: nextL.notes[0].id,
            address: { measureN: measureN + 1, staffN, layerN },
            offset: Offset.start(),
          }
        }
      }
    } else {
      // left
      if (idx > 0) {
        const prevNote = layer.notes[idx - 1]
        let offset = Offset.start()
        for (let i = 0; i < idx - 1; i++) {
          offset = offset.add(layer.notes[i].duration)
        }
        return {
          kind: 'note',
          xmlId: prevNote.id,
          address: current.address,
          offset,
        }
      } else {
        const prevM = scoreModel.get(measureN - 1)
        const prevL = prevM?.staves.get(staffN)?.layers.get(layerN)
        if (prevL && prevL.notes.length > 0) {
          const lastNote = prevL.notes[prevL.notes.length - 1]
          let offset = Offset.start()
          for (let i = 0; i < prevL.notes.length - 1; i++) {
            offset = offset.add(prevL.notes[i].duration)
          }
          return {
            kind: 'note',
            xmlId: lastNote.id,
            address: { measureN: measureN - 1, staffN, layerN },
            offset,
          }
        }
      }
    }
  }

  if (direction === 'up' || direction === 'down') {
    const targetStaffN = direction === 'up' ? staffN - 1 : staffN + 1
    const targetStaff = measure?.staves.get(targetStaffN)
    const targetLayer = targetStaff?.layers.get(layerN)
    if (!targetLayer || targetLayer.notes.length === 0) return null

    let bestNote = targetLayer.notes[0]
    let bestOffset = Offset.start()
    let minDiff = Math.abs(current.offset.toNumber() - bestOffset.toNumber())

    let currentIterOffset = Offset.start()
    for (let i = 0; i < targetLayer.notes.length; i++) {
      const diff = Math.abs(current.offset.toNumber() - currentIterOffset.toNumber())
      if (diff < minDiff) {
        minDiff = diff
        bestNote = targetLayer.notes[i]
        bestOffset = currentIterOffset
      }
      currentIterOffset = currentIterOffset.add(targetLayer.notes[i].duration)
    }

    return {
      kind: 'note',
      xmlId: bestNote.id,
      address: { measureN, staffN: targetStaffN, layerN },
      offset: bestOffset,
    }
  }

  return null
}
