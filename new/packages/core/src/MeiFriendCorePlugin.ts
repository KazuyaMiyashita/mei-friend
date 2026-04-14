import { MeiDocument } from './mei/MeiDocument'
import { definePlugin, type PluginCtx } from './PluginDAG'

export interface MeiFriendCoreState {
  xmlContent: string | null
  fileName: string | null
  isDirty: boolean
  savedXml: string | null
}

export interface MeiFriendCoreApi {
  getXml: () => string | null
  getFileName: () => string | null
  getDocument: () => MeiDocument | null
  updateXml: (xml: string, fileName?: string) => void
  edit: (fn: (doc: Document) => void) => void
  markAsSaved: () => void
}

/**
 * Core plugin for MeiFriend that manages the MEI XML content and document object.
 */
export const meiFriendCorePlugin = definePlugin({
  name: 'core' as const,
  deps: [],
  initialState: {
    xmlContent: null,
    fileName: null,
    isDirty: false,
    savedXml: null,
  } as MeiFriendCoreState,

  api: (ctx: PluginCtx<MeiFriendCoreState>): MeiFriendCoreApi => {
    let meiDocument: MeiDocument | null = null

    return {
      getXml: () => ctx.getState().xmlContent,
      getFileName: () => ctx.getState().fileName,
      getDocument: () => meiDocument,

      updateXml: (xml: string, fileName?: string) => {
        const state = ctx.getState()
        const xmlChanged = state.xmlContent !== xml
        const isInitialLoad = state.xmlContent === null
        const newSavedXml = isInitialLoad ? xml : state.savedXml

        if (xmlChanged) {
          meiDocument = xml ? new MeiDocument(xml) : null
        }

        ctx.setState({
          xmlContent: xml,
          fileName: fileName ?? state.fileName,
          savedXml: newSavedXml,
          isDirty: xml !== newSavedXml,
        })
      },

      edit: (fn: (doc: Document) => void) => {
        if (!meiDocument) return
        const nextDoc = meiDocument.update(fn)
        const xml = nextDoc.xmlToString()
        meiDocument = nextDoc
        const newSavedXml = ctx.getState().savedXml
        ctx.setState({
          xmlContent: xml,
          isDirty: xml !== newSavedXml,
        })
      },

      markAsSaved: () => {
        ctx.setState({
          isDirty: false,
          savedXml: ctx.getState().xmlContent,
        })
      },
    }
  },
})
