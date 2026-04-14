import type { CoreSlice } from '@mei-friend2/core'
import type { StoreApi } from 'zustand/vanilla'
import type { HistorySlice } from '../slices/historySlice'

export class HistoryService {
  private unsubscribe: (() => void) | null = null

  constructor(private store: StoreApi<CoreSlice & HistorySlice>) {
    this.startSubscription()
  }

  private startSubscription() {
    this.unsubscribe = this.store.subscribe((state, prevState) => {
      const currentXml = state.xmlContent
      const prevXml = prevState.xmlContent

      if (currentXml !== prevXml) {
        // biome-ignore lint/suspicious/noExplicitAny: internal flag
        const history = state.history as any
        if (!history._isInternalUpdate && prevXml !== null && prevXml !== currentXml) {
          state.history.push(prevXml)
        }
      }
    })
  }

  destroy() {
    this.unsubscribe?.()
  }
}
