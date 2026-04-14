import {
  addMissingXmlIds,
  definePlugin,
  getElementById,
  guessOctave,
  insertNote,
  insertPointElement,
  insertRest,
  insertSpanElement,
  meiFriendCorePlugin,
  type PName,
  pitchChromaticInDoc,
  pitchDiatonicInDoc,
  pitchOctaveInDoc,
  removeXmlIds,
  renumberMeasures,
  setAccidental,
  toggleStemDir,
  type XmlIdStyle,
} from '@mei-friend/core'
import { selectionPlugin } from './SelectionPlugin'

export interface InsertNoteAtScoreAddressOpts {
  pname: string
  /** Automatically estimated from surrounding notes if omitted */
  oct?: string
  dur: string
  dots?: number
  accidGes?: string
}

export interface MeiEditorApi {
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

/**
 * Provides basic MEI editing operations.
 * Depends on 'core' for XML editing and 'selection' for identifying targets.
 */
export const meiEditorPlugin = () => {
  let xmlIdStyle: XmlIdStyle = 'mei-friend'

  return definePlugin({
    name: 'meiEditor' as const,
    deps: [meiFriendCorePlugin, selectionPlugin()] as const,
    api: (ctx): MeiEditorApi => {
      const getSelectionId = (): string | null => {
        const sel = ctx.depState.selection.selection
        if (!sel) return null
        return sel.kind === 'note' ? sel.xmlId : sel.staffXmlId
      }

      return {
        pitchChromatic: (delta) =>
          ctx.depApi.core.edit((doc: Document) => {
            const id = getSelectionId()
            if (id) pitchChromaticInDoc(doc, id, delta)
          }),
        pitchDiatonic: (delta) =>
          ctx.depApi.core.edit((doc: Document) => {
            const id = getSelectionId()
            if (id) pitchDiatonicInDoc(doc, id, delta)
          }),
        pitchOctave: (delta) =>
          ctx.depApi.core.edit((doc: Document) => {
            const id = getSelectionId()
            if (id) pitchOctaveInDoc(doc, id, delta)
          }),

        deleteSelectedElements: () => {
          const id = getSelectionId()
          if (!id) return
          ctx.depApi.core.edit((doc: Document) => {
            getElementById(doc, id)?.remove()
          })
        },

        addXmlIds: () =>
          ctx.depApi.core.edit((doc: Document) => {
            addMissingXmlIds(doc, xmlIdStyle)
          }),
        removeXmlIds: () =>
          ctx.depApi.core.edit((doc: Document) => {
            removeXmlIds(doc)
          }),
        renumberMeasures: (startNum = 1) =>
          ctx.depApi.core.edit((doc: Document) => {
            renumberMeasures(doc, startNum)
          }),

        insertSpanElement: (elName, placement, form) => {
          const id = getSelectionId()
          if (!id) return
          ctx.depApi.core.edit((doc: Document) => {
            insertSpanElement(doc, {
              elName,
              startId: id,
              endId: id,
              placement,
              form,
              style: xmlIdStyle,
            })
          })
        },

        insertPointElement: (elName, placement, content) => {
          const id = getSelectionId()
          if (!id) return
          ctx.depApi.core.edit((doc: Document) => {
            insertPointElement(doc, { elName, startId: id, placement, content, style: xmlIdStyle })
          })
        },

        setAccidental: (accid) =>
          ctx.depApi.core.edit((doc: Document) => {
            const id = getSelectionId()
            if (id) setAccidental(doc, id, accid)
          }),

        insertNoteAtScoreAddress: (xmlId, { pname, oct, dur, dots, accidGes }) => {
          let insertedId: string | null = null
          ctx.depApi.core.edit((doc: Document) => {
            const resolvedOct = oct ?? String(guessOctave(doc, xmlId, pname as PName))
            insertedId = insertNote(doc, {
              anchorId: xmlId,
              pname,
              oct: resolvedOct,
              dur,
              dots,
              accidGes,
              style: xmlIdStyle,
            })
          })
          return insertedId
        },

        insertRestAtScoreAddress: (xmlId, opts) => {
          let insertedId: string | null = null
          ctx.depApi.core.edit((doc: Document) => {
            insertedId = insertRest(doc, {
              anchorId: xmlId,
              dur: opts?.dur ?? '4',
              dots: opts?.dots,
              style: xmlIdStyle,
            })
          })
          return insertedId
        },

        toggleStemDir: () =>
          ctx.depApi.core.edit((doc: Document) => {
            const id = getSelectionId()
            if (id) toggleStemDir(doc, id)
          }),
        setXmlIdStyle: (style) => {
          xmlIdStyle = style
        },
      }
    },
  })
}
