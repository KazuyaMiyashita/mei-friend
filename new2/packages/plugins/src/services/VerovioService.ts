import { buildScoreModel, type CoreSlice } from '@mei-friend2/core'
import type { StoreApi } from 'zustand/vanilla'
import type { VerovioSlice } from '../slices/verovioSlice'
import type { VrvCommand, VrvResponse } from '../verovio-protocol'

export class VerovioService {
  private worker: Worker | null = null
  private workerPromise: Promise<Worker> | null = null
  private unsubscribe: (() => void) | null = null

  constructor(private store: StoreApi<CoreSlice & VerovioSlice>) {
    this.startSubscription()
  }

  private startSubscription() {
    this.unsubscribe = this.store.subscribe((state, prevState) => {
      const verovio = state.verovio
      const prevVerovio = prevState.verovio
      const core = state
      const prevCore = prevState

      // 1. React to XML changes
      if (core.meiDocument !== prevCore.meiDocument) {
        if (core.meiDocument) {
          const scoreModel = buildScoreModel(core.meiDocument.getDocument())
          state.verovio.updateState({ scoreModel })
        }

        const xml = core.xmlContent
        if (xml) {
          if (
            verovio.vrvOptions.breaks !== 'none' &&
            (!verovio.vrvOptions.pageWidth || !verovio.vrvOptions.pageHeight)
          ) {
            state.verovio.updateState({ isDataLoaded: false })
          } else {
            state.verovio.updateState({ isRendering: true, isDataLoaded: true })
            this.ensureWorker().then((w) => {
              w.postMessage({
                cmd: 'updateData',
                mei: xml,
                pageNo: verovio.currentPage,
              } satisfies VrvCommand)
            })
          }
        } else {
          state.verovio.updateState({ isDataLoaded: false })
        }
      }

      // 2. React to Page changes (if triggered via changePage action)
      if (
        verovio.currentPage !== prevVerovio.currentPage &&
        verovio.isRendering &&
        !prevVerovio.isRendering
      ) {
        this.ensureWorker().then((w) => {
          w.postMessage({ cmd: 'changePage', pageNo: verovio.currentPage } satisfies VrvCommand)
        })
      }

      // 3. React to Options changes
      if (
        verovio.vrvOptions !== prevVerovio.vrvOptions &&
        verovio.isRendering &&
        !prevVerovio.isRendering
      ) {
        this.ensureWorker().then((w) => {
          const xml = core.xmlContent
          if (!verovio.isDataLoaded && xml) {
            w.postMessage({
              cmd: 'updateAll',
              options: verovio.vrvOptions,
              mei: xml,
              pageNo: verovio.currentPage,
            } satisfies VrvCommand)
            state.verovio.updateState({ isDataLoaded: true })
          } else {
            w.postMessage({
              cmd: 'setOptions',
              options: verovio.vrvOptions,
              pageNo: verovio.currentPage,
            } satisfies VrvCommand)
          }
        })
      }
    })
  }

  private async ensureWorker(): Promise<Worker> {
    if (this.workerPromise) return this.workerPromise

    this.workerPromise = new Promise<Worker>((resolve) => {
      const w = new Worker(new URL('../workers/verovio.worker.ts', import.meta.url), {
        type: 'module',
      })

      w.onmessage = (e: MessageEvent<VrvResponse>) => {
        const msg = e.data
        if (msg.cmd === 'updated') {
          this.store.getState().verovio.updateState({
            currentSvg: msg.svg,
            totalPages: msg.pageCount,
            currentPage: msg.pageNo,
            isRendering: false,
          })
        } else if (msg.cmd === 'error') {
          console.error('[VerovioService] worker error:', msg.message)
          this.store.getState().verovio.updateState({ isRendering: false })
        } else if (msg.cmd === 'vrvLoaded') {
          this.worker = w
          resolve(w)
        }
      }

      w.postMessage({ cmd: 'loadVerovio' } satisfies VrvCommand)
    })

    return this.workerPromise
  }

  destroy() {
    this.unsubscribe?.()
    this.worker?.terminate()
    this.worker = null
    this.workerPromise = null
  }
}
