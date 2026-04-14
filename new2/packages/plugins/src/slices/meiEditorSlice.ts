import {
  addMissingXmlIds,
  getElementById,
  guessOctave,
  insertNote,
  insertPointElement,
  insertRest,
  insertSpanElement,
  type PName,
  pitchChromaticInDoc,
  pitchDiatonicInDoc,
  pitchOctaveInDoc,
  removeXmlIds,
  renumberMeasures,
  type SliceCreator,
  setAccidental,
  toggleStemDir,
  type XmlIdStyle,
} from '@mei-friend2/core'
import type { SelectionSlice } from './selectionSlice'

export interface InsertNoteAtScoreAddressOpts {
  pname: string
  /** Automatically estimated from surrounding notes if omitted */
  oct?: string
  dur: string
  dots?: number
  accidGes?: string
}

export interface MeiEditorActions {
  pitchChromatic: (delta: 1 | -1) => void
  pitchDiatonic: (delta: 1 | -1) => void
  pitchOctave: (delta: 1 | -1) => void
  deleteSelectedElements: () => void
  addXmlIds: () => void
  removeXmlIds: () => void
  renumberMeasures: (startNum?: number) => void
  insertSpanElement: (elName: string, placement?: string, form?: string) => void
  insertPointElement: (elName: string, placement?: string, content?: string) => void
  insertNoteAtScoreAddress: (xmlId: string, opts: InsertNoteAtScoreAddressOpts) => string | null
  insertRestAtScoreAddress: (xmlId: string, opts?: { dur?: string; dots?: number }) => string | null
  setAccidental: (accid: string) => void
  toggleStemDir: () => void
  setXmlIdStyle: (style: XmlIdStyle) => void
}

export type MeiEditorSlice = { meiEditor: MeiEditorActions & { xmlIdStyle: XmlIdStyle } }

export const createMeiEditorSlice: SliceCreator<MeiEditorSlice> = (set, get) => {
  const getSelectionId = (): string | null => {
    const state = get() as SelectionSlice
    const sel = state.selection.selection
    if (!sel) return null
    return sel.kind === 'note' ? sel.xmlId : sel.staffXmlId
  }

  return {
    meiEditor: {
      xmlIdStyle: 'mei-friend',

      pitchChromatic: (delta: 1 | -1) => {
        const id = getSelectionId()
        if (id) get().edit((doc: Document) => pitchChromaticInDoc(doc, id, delta))
      },
      pitchDiatonic: (delta: 1 | -1) => {
        const id = getSelectionId()
        if (id) get().edit((doc: Document) => pitchDiatonicInDoc(doc, id, delta))
      },
      pitchOctave: (delta: 1 | -1) => {
        const id = getSelectionId()
        if (id) get().edit((doc: Document) => pitchOctaveInDoc(doc, id, delta))
      },

      deleteSelectedElements: () => {
        const id = getSelectionId()
        if (!id) return
        get().edit((doc: Document) => {
          getElementById(doc, id)?.remove()
        })
      },

      addXmlIds: () => {
        const style = get().meiEditor.xmlIdStyle
        get().edit((doc: Document) => {
          addMissingXmlIds(doc, style)
        })
      },
      removeXmlIds: () => {
        get().edit((doc: Document) => {
          removeXmlIds(doc)
        })
      },
      renumberMeasures: (startNum = 1) => {
        get().edit((doc: Document) => {
          renumberMeasures(doc, startNum)
        })
      },

      insertSpanElement: (elName: string, placement?: string, form?: string) => {
        const id = getSelectionId()
        if (!id) return
        const style = get().meiEditor.xmlIdStyle
        get().edit((doc: Document) => {
          insertSpanElement(doc, {
            elName,
            startId: id,
            endId: id,
            placement,
            form,
            style,
          })
        })
      },

      insertPointElement: (elName: string, placement?: string, content?: string) => {
        const id = getSelectionId()
        if (!id) return
        const style = get().meiEditor.xmlIdStyle
        get().edit((doc: Document) => {
          insertPointElement(doc, { elName, startId: id, placement, content, style })
        })
      },

      setAccidental: (accid: string) => {
        const id = getSelectionId()
        if (id) {
          get().edit((doc: Document) => {
            setAccidental(doc, id, accid)
          })
        }
      },

      insertNoteAtScoreAddress: (
        xmlId: string,
        { pname, oct, dur, dots, accidGes }: InsertNoteAtScoreAddressOpts,
      ) => {
        let insertedId: string | null = null
        const style = get().meiEditor.xmlIdStyle
        get().edit((doc: Document) => {
          const resolvedOct = oct ?? String(guessOctave(doc, xmlId, pname as PName))
          insertedId = insertNote(doc, {
            anchorId: xmlId,
            pname,
            oct: resolvedOct,
            dur,
            dots,
            accidGes,
            style,
          })
        })
        return insertedId
      },

      insertRestAtScoreAddress: (xmlId: string, opts?: { dur?: string; dots?: number }) => {
        let insertedId: string | null = null
        const style = get().meiEditor.xmlIdStyle
        get().edit((doc: Document) => {
          insertedId = insertRest(doc, {
            anchorId: xmlId,
            dur: opts?.dur ?? '4',
            dots: opts?.dots,
            style,
          })
        })
        return insertedId
      },

      toggleStemDir: () => {
        const id = getSelectionId()
        if (id) {
          get().edit((doc: Document) => {
            toggleStemDir(doc, id)
          })
        }
      },
      setXmlIdStyle: (style: XmlIdStyle) => {
        // biome-ignore lint/suspicious/noExplicitAny: slice pattern
        set((state: any) => ({
          meiEditor: { ...state.meiEditor, xmlIdStyle: style },
        }))
      },
    },
  }
}
