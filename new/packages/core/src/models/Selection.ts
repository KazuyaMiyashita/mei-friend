import type { ScoreAddress } from './Address'
import type { Offset } from './Offset'

/**
 * A selected note or rest.
 * Holds xmlId (visual reference for SVG/MEI), address (logical address on the score),
 * and the temporal offset within the measure (offset).
 */
export interface NoteSelection {
  kind: 'note'
  xmlId: string
  address: ScoreAddress
  offset: Offset
}

/**
 * A selected staff. Used for staff-level operations within a measure.
 */
export interface StaffSelection {
  kind: 'staff'
  staffXmlId: string
  measureXmlId: string
  measureN: number
  staffN: number
}

export type AnySelection = NoteSelection | StaffSelection

export function isNoteSelection(s: AnySelection): s is NoteSelection {
  return s.kind === 'note'
}

export function isStaffSelection(s: AnySelection): s is StaffSelection {
  return s.kind === 'staff'
}
