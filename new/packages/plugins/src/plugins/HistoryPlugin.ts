import { definePlugin, meiFriendCorePlugin, type UpdateCtx } from '@mei-friend/core'

export interface HistoryState {
  past: string[]
  future: string[]
}

export interface HistoryApi {
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
}

/**
 * Provides undo/redo functionality by tracking MEI XML history.
 */
export const historyPlugin = (maxSize = 100) => {
  let isInternalUpdate = false
  let previousXml: string | null = null

  const pushToHistory = (ctx: UpdateCtx<HistoryState, Record<string, unknown>>, xml: string) => {
    if (isInternalUpdate) return
    if (xml === previousXml) return

    const state = ctx.getState()
    const newPast = previousXml ? [...state.past, previousXml] : state.past

    ctx.setState({
      past: newPast.slice(-maxSize),
      future: [],
    })
    previousXml = xml
  }

  return definePlugin({
    name: 'history' as const,
    deps: [meiFriendCorePlugin] as const,
    initialState: {
      past: [],
      future: [],
    } as HistoryState,

    onInit: (ctx) => {
      previousXml = ctx.depApi.core.getXml()
    },

    onUpdate: (ctx, xmlChanged) => {
      if (xmlChanged) {
        const xml = ctx.depApi.core.getXml()
        if (xml) pushToHistory(ctx, xml)
      }
    },

    api: (ctx): HistoryApi => ({
      undo: () => {
        const state = ctx.getState()
        if (state.past.length === 0) return

        const currentXml = ctx.depApi.core.getXml()
        const newPast = [...state.past]
        const toRestore = newPast.pop()
        if (toRestore === undefined) return

        isInternalUpdate = true
        ctx.depApi.core.updateXml(toRestore)
        isInternalUpdate = false

        const newFuture = currentXml ? [currentXml, ...state.future] : state.future
        ctx.setState({
          past: newPast,
          future: newFuture,
        })
        previousXml = toRestore
      },

      redo: () => {
        const state = ctx.getState()
        if (state.future.length === 0) return

        const currentXml = ctx.depApi.core.getXml()
        const newFuture = [...state.future]
        const toRestore = newFuture.shift()
        if (toRestore === undefined) return

        isInternalUpdate = true
        ctx.depApi.core.updateXml(toRestore)
        isInternalUpdate = false

        const newPast = currentXml ? [...state.past, currentXml] : state.past
        ctx.setState({
          past: newPast,
          future: newFuture.slice(0, maxSize),
        })
        previousXml = toRestore
      },

      canUndo: () => ctx.getState().past.length > 0,
      canRedo: () => ctx.getState().future.length > 0,
    }),
  })
}
