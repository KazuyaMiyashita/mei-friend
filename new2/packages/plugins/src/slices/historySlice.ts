import type { CoreSlice, SliceCreator } from '@mei-friend2/core'

export interface HistoryState {
  past: string[]
  future: string[]
  _isInternalUpdate: boolean
}

export interface HistoryActions {
  undo: () => void
  redo: () => void
  push: (xml: string) => void
}

export type HistorySlice = { history: HistoryState & HistoryActions }

export const createHistorySlice =
  (maxSize = 100): SliceCreator<HistorySlice> =>
  (set, get) => ({
    history: {
      past: [],
      future: [],
      _isInternalUpdate: false,

      undo: () => {
        const state = get() as CoreSlice & HistorySlice
        const { past, future } = state.history
        if (past.length === 0) return

        const currentXml = state.xmlContent
        const newPast = [...past]
        const toRestore = newPast.pop()
        if (toRestore === undefined) return

        // Use a flag to prevent the service from pushing this back to history
        set((s: CoreSlice & HistorySlice) => ({
          history: { ...s.history, _isInternalUpdate: true },
        }))
        state.updateXml(toRestore)
        set((s: CoreSlice & HistorySlice) => ({
          history: { ...s.history, _isInternalUpdate: false },
        }))

        set((s: CoreSlice & HistorySlice) => ({
          history: {
            ...s.history,
            past: newPast,
            future: currentXml ? [currentXml, ...future] : future,
          },
        }))
      },

      redo: () => {
        const state = get() as CoreSlice & HistorySlice
        const { past, future } = state.history
        if (future.length === 0) return

        const currentXml = state.xmlContent
        const newFuture = [...future]
        const toRestore = newFuture.shift()
        if (toRestore === undefined) return

        set((s: CoreSlice & HistorySlice) => ({
          history: { ...s.history, _isInternalUpdate: true },
        }))
        state.updateXml(toRestore)
        set((s: CoreSlice & HistorySlice) => ({
          history: { ...s.history, _isInternalUpdate: false },
        }))

        set((s: CoreSlice & HistorySlice) => ({
          history: {
            ...s.history,
            past: currentXml ? [...past, currentXml] : past,
            future: newFuture,
          },
        }))
      },

      push: (xml: string) => {
        set((s: CoreSlice & HistorySlice) => {
          const { past } = s.history
          return {
            history: {
              ...s.history,
              past: [...past, xml].slice(-maxSize),
              future: [],
            },
          }
        })
      },
    },
  })
