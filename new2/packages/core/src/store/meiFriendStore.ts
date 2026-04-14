import { createStore } from 'zustand/vanilla'
import { MeiDocument } from '../mei/MeiDocument'
import type { SliceCreator } from './types'

export interface CoreState {
  xmlContent: string | null
  fileName: string | null
  isDirty: boolean
  savedXml: string | null
  meiDocument: MeiDocument | null
}

export interface CoreActions {
  updateXml: (xml: string, fileName?: string) => void
  edit: (fn: (doc: Document) => void) => void
  markAsSaved: () => void
}

export type CoreSlice = CoreState & CoreActions

export const createCoreSlice = (
  // biome-ignore lint/suspicious/noExplicitAny: slice pattern
  set: (partial: any, replace?: boolean) => void,
  get: () => CoreState,
): CoreSlice => ({
  xmlContent: null,
  fileName: null,
  isDirty: false,
  savedXml: null,
  meiDocument: null,

  updateXml: (xml: string, fileName?: string) => {
    const state = get()
    const xmlChanged = state.xmlContent !== xml
    const isInitialLoad = state.xmlContent === null
    const newSavedXml = isInitialLoad ? xml : state.savedXml

    let newMeiDocument = state.meiDocument
    if (xmlChanged) {
      newMeiDocument = xml ? new MeiDocument(xml) : null
    }

    set({
      xmlContent: xml,
      fileName: fileName ?? state.fileName,
      savedXml: newSavedXml,
      isDirty: xml !== newSavedXml,
      meiDocument: newMeiDocument,
    })
  },

  edit: (fn: (doc: Document) => void) => {
    const state = get()
    if (!state.meiDocument) return
    const nextDoc = state.meiDocument.update(fn)
    const xml = nextDoc.xmlToString()
    set({
      xmlContent: xml,
      isDirty: xml !== state.savedXml,
      meiDocument: nextDoc,
    })
  },

  markAsSaved: () => {
    const state = get()
    set({
      isDirty: false,
      savedXml: state.xmlContent,
    })
  },
})

export function createMeiFriendStore<TSlices>(
  initialState?: Partial<CoreState>,
  // biome-ignore lint/suspicious/noExplicitAny: slice pattern
  sliceCreators: SliceCreator<any>[] = [],
) {
  return createStore<CoreSlice & TSlices>((set, get, api) => {
    // biome-ignore lint/suspicious/noExplicitAny: slice pattern
    const core = createCoreSlice(set as any, get as any)
    const mergedInitialState = { ...core, ...initialState }

    const slices = sliceCreators.reduce((acc, creator) => {
      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      // biome-ignore lint/performance/noAccumulatingSpread: necessary for merging slices
      return { ...acc, ...creator(set as any, get as any, api) }
      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
    }, {} as any)

    return {
      ...mergedInitialState,
      ...slices,
    }
  })
}
