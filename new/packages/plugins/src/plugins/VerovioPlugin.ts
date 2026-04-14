import {
  type AnySelection,
  buildScoreModel,
  definePlugin,
  meiFriendCorePlugin,
  type ScoreModel,
  type UpdateCtx,
} from '@mei-friend/core'
import type { VrvCommand, VrvResponse } from '../verovio-protocol'

export interface BBox {
  x: number
  y: number
  width: number
  height: number
}

/** Map of xml:id to BBox (constructed by NotationPanel after SVG rendering) */
export type BBoxMap = Map<string, BBox>

export interface DebugFilters {
  measure: boolean
  staff: boolean
  note: boolean
  caret: boolean
}

export interface VerovioOptions {
  scale: number
  breaks: 'auto' | 'line' | 'encoded' | 'none' | 'smart'
  adjustPageHeight: boolean
  font: string
  pageMarginBottom: number
  pageMarginLeft: number
  pageMarginRight: number
  pageMarginTop: number
  inputFrom: string
  mdivAll: boolean
  graceFactor: number
  hairpinSize: number
  outputIndent: number
  spacingLinear: number
  spacingNonLinear: number
  minLastJustification: number
  svgAdditionalAttribute: string[]
  bottomMarginArtic: number
  topMarginArtic: number
  footer: string
  pageWidth?: number
  pageHeight?: number
  overlayClassName?: string
}

export const DEFAULT_VRV_OPTIONS: VerovioOptions = {
  scale: 55,
  breaks: 'auto',
  adjustPageHeight: true,
  font: 'Leipzig',
  pageMarginBottom: 15,
  pageMarginLeft: 50,
  pageMarginRight: 50,
  pageMarginTop: 50,
  inputFrom: 'mei',
  mdivAll: true,
  graceFactor: 0.66,
  hairpinSize: 2,
  outputIndent: 3,
  spacingLinear: 0.2,
  spacingNonLinear: 0.5,
  minLastJustification: 0,
  svgAdditionalAttribute: [
    'layer@n',
    'staff@n',
    'dir@vgrp',
    'dynam@vgrp',
    'hairpin@vgrp',
    'pedal@vgrp',
    'measure@n',
    'beamSpan@plist',
  ],
  bottomMarginArtic: 1.2,
  topMarginArtic: 1.2,
  footer: 'none',
  overlayClassName: 'mf-overlay',
}

export interface VerovioState {
  currentPage: number
  totalPages: number
  currentSvg: string | null
  isRendering: boolean
  /** Whether MEI data is loaded in the worker */
  isDataLoaded: boolean
  /** Score model built from MEI XML */
  scoreModel: ScoreModel | null
  /** Visual position map constructed by NotationPanel after SVG rendering */
  bboxMap: BBoxMap | null
  vrvOptions: VerovioOptions
  debugFilters: DebugFilters
}

export interface VerovioApi {
  changePage: (page: number) => Promise<void>
  setVrvOptions: (opts: Partial<VerovioOptions>) => Promise<void>
  updateBboxMap: (map: BBoxMap) => void
  /** @internal Used by worker callback via dispatch */
  updateStateFromWorker: (patch: Partial<VerovioState>) => void
  setDebugFilters: (filters: Partial<DebugFilters>) => void
  renderOverlays: (
    container: HTMLElement,
    selection?: AnySelection | null,
    inputModeActive?: boolean,
  ) => void
}

// ── SVG Helpers ─────────────────────────────────────────────────────────────

function createOverlayRect(
  bbox: { x: number; y: number; width: number; height: number },
  className: string,
  targetId: string,
  baseClassName: string,
  interactive = false,
): SVGRectElement {
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  rect.setAttribute('x', String(bbox.x))
  rect.setAttribute('y', String(bbox.y))
  rect.setAttribute('width', String(bbox.width))
  rect.setAttribute('height', String(bbox.height))
  rect.setAttribute('class', `${baseClassName} ${className}`)
  rect.setAttribute('data-target-id', targetId)
  if (!interactive) rect.setAttribute('style', 'pointer-events: none;')
  return rect
}

function createCaret(
  x: number,
  y: number,
  height: number,
  baseClassName: string,
  isDebug = false,
): SVGRectElement {
  const caret = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  caret.setAttribute('x', String(x))
  caret.setAttribute('y', String(y))
  caret.setAttribute('width', isDebug ? '30' : '80')
  caret.setAttribute('height', String(height))
  caret.setAttribute(
    'class',
    `${baseClassName} ${baseClassName}-caret${isDebug ? ` ${baseClassName}-caret--debug` : ''}`,
  )
  caret.setAttribute('style', 'pointer-events: none;')
  return caret
}

function buildElementMap(innerSvg: SVGSVGElement): Map<string, SVGGraphicsElement> {
  const map = new Map<string, SVGGraphicsElement>()
  innerSvg.querySelectorAll('g[id]').forEach((el) => {
    map.set(el.id, el as SVGGraphicsElement)
  })
  return map
}

/**
 * Provides Verovio-based MEI rendering and score model management.
 */
export const verovioPlugin = () => {
  let worker: Worker | null = null
  let workerPromise: Promise<Worker> | null = null

  const ensureWorker = (ctx: UpdateCtx<VerovioState, Record<string, unknown>>): Promise<Worker> => {
    if (workerPromise) return workerPromise

    workerPromise = new Promise<Worker>((resolve) => {
      const w = new Worker(new URL('../workers/verovio.worker.ts', import.meta.url), {
        type: 'module',
      })

      w.onmessage = (e: MessageEvent<VrvResponse>) => {
        const msg = e.data
        if (msg.cmd === 'updated') {
          ctx.dispatch((api) => {
            const vrvApi = (api as Record<string, unknown>).verovio as VerovioApi | undefined
            if (vrvApi) {
              vrvApi.updateStateFromWorker({
                currentSvg: msg.svg,
                totalPages: msg.pageCount,
                currentPage: msg.pageNo,
                isRendering: false,
              })
            }
          })
        } else if (msg.cmd === 'error') {
          console.error('[VerovioPlugin] worker error:', msg.message)
          ctx.dispatch((api) => {
            const vrvApi = (api as Record<string, unknown>).verovio as VerovioApi | undefined
            if (vrvApi) {
              vrvApi.updateStateFromWorker({ isRendering: false })
            }
          })
        } else if (msg.cmd === 'vrvLoaded') {
          worker = w
          resolve(w)
        }
      }

      w.postMessage({ cmd: 'loadVerovio' } satisfies VrvCommand)
    })

    return workerPromise
  }

  return definePlugin({
    name: 'verovio' as const,
    deps: [meiFriendCorePlugin] as const,
    initialState: {
      currentPage: 1,
      totalPages: 1,
      currentSvg: null,
      isRendering: false,
      isDataLoaded: false,
      scoreModel: null,
      bboxMap: null,
      vrvOptions: DEFAULT_VRV_OPTIONS,
      debugFilters: {
        measure: false,
        staff: false,
        note: false,
        caret: false,
      },
    } as VerovioState,

    onInit: async (ctx) => {
      const doc = ctx.depApi.core.getDocument()?.getDocument()
      if (doc) {
        ctx.setState({ scoreModel: buildScoreModel(doc) })
      }
    },

    onUpdate: async (ctx, xmlChanged) => {
      if (xmlChanged) {
        const doc = ctx.depApi.core.getDocument()?.getDocument()
        if (doc) {
          ctx.setState({ scoreModel: buildScoreModel(doc) })
        }

        const xml = ctx.depApi.core.getXml()
        if (xml) {
          const state = ctx.getState()
          if (
            state.vrvOptions.breaks !== 'none' &&
            (!state.vrvOptions.pageWidth || !state.vrvOptions.pageHeight)
          ) {
            ctx.setState({ isDataLoaded: false })
            return
          }

          ctx.setState({ isRendering: true, isDataLoaded: true })
          const w = await ensureWorker(ctx)
          w.postMessage({
            cmd: 'updateData',
            mei: xml,
            pageNo: state.currentPage,
          } satisfies VrvCommand)
        } else {
          ctx.setState({ isDataLoaded: false })
        }
      }
    },

    onDestroy: () => {
      worker?.terminate()
      worker = null
      workerPromise = null
    },

    api: (ctx): VerovioApi => ({
      changePage: async (page) => {
        ctx.setState({ currentPage: page, isRendering: true })
        const w = await ensureWorker(ctx)
        w.postMessage({ cmd: 'changePage', pageNo: page } satisfies VrvCommand)
      },
      setVrvOptions: async (opts) => {
        const state = ctx.getState()
        const newOpts = { ...state.vrvOptions, ...opts }
        ctx.setState({ vrvOptions: newOpts, isRendering: true })

        const w = await ensureWorker(ctx)
        const xml = ctx.depApi.core.getXml()

        if (!state.isDataLoaded && xml) {
          w.postMessage({
            cmd: 'updateAll',
            options: newOpts,
            mei: xml,
            pageNo: state.currentPage,
          } satisfies VrvCommand)
          ctx.setState({ isDataLoaded: true })
        } else {
          w.postMessage({
            cmd: 'setOptions',
            options: newOpts,
            pageNo: state.currentPage,
          } satisfies VrvCommand)
        }
      },
      updateBboxMap: (map) => {
        ctx.setState({ bboxMap: map })
      },
      updateStateFromWorker: (patch) => {
        ctx.setState(patch)
      },
      setDebugFilters: (filters) => {
        const state = ctx.getState()
        ctx.setState({ debugFilters: { ...state.debugFilters, ...filters } })
      },
      renderOverlays: (container, selection, inputModeActive) => {
        const rootSvg = container.querySelector('svg')
        if (!rootSvg) return
        const innerSvg = rootSvg.querySelector('.definition-scale') as SVGSVGElement | null
        if (!innerSvg) return

        const state = ctx.getState()
        const { scoreModel, vrvOptions, debugFilters } = state
        const baseClass = vrvOptions.overlayClassName ?? 'mf-overlay'

        if (!scoreModel) return

        // Calculate current BBoxes from SVG
        const currentBboxMap: BBoxMap = new Map()
        innerSvg.querySelectorAll('g[id]').forEach((el) => {
          const bbox = (el as SVGGraphicsElement).getBBox()
          currentBboxMap.set(el.id, {
            x: bbox.x,
            y: bbox.y,
            width: bbox.width,
            height: bbox.height,
          })
        })

        let overlayLayer = innerSvg.querySelector(`#${baseClass}-layer`)
        if (!overlayLayer) {
          overlayLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g')
          overlayLayer.id = `${baseClass}-layer`
          innerSvg.appendChild(overlayLayer)
        }
        overlayLayer.innerHTML = ''

        const pageMarginGroup = innerSvg.querySelector('g.page-margin')
        if (pageMarginGroup) {
          const transform = pageMarginGroup.getAttribute('transform')
          if (transform) overlayLayer.setAttribute('transform', transform)
          else overlayLayer.removeAttribute('transform')
        }

        const elMap = buildElementMap(innerSvg)
        const measureRects: SVGRectElement[] = []
        const staffRects: SVGRectElement[] = []
        const noteRects: SVGRectElement[] = []
        const caretRects: SVGRectElement[] = []

        scoreModel.forEach((measure) => {
          const mBbox = currentBboxMap.get(measure.xmlId)
          if (mBbox && debugFilters.measure) {
            measureRects.push(
              createOverlayRect(mBbox, `${baseClass}-measure`, measure.xmlId, baseClass),
            )
          }

          measure.staves.forEach((staff) => {
            const sEl = elMap.get(staff.xmlId)
            const sBbox = currentBboxMap.get(staff.xmlId)

            if (sBbox) {
              staffRects.push(
                createOverlayRect(
                  sBbox,
                  `${baseClass}-staff${debugFilters.staff ? ` ${baseClass}-staff--debug` : ''}`,
                  staff.xmlId,
                  baseClass,
                  true,
                ),
              )
            }

            staff.layers.forEach((layerModel) => {
              layerModel.notes.forEach((note) => {
                const eBbox = currentBboxMap.get(note.id)
                if (!eBbox) return

                noteRects.push(
                  createOverlayRect(
                    eBbox,
                    `${baseClass}-note${debugFilters.note ? ` ${baseClass}-note--debug` : ''}`,
                    note.id,
                    baseClass,
                    true,
                  ),
                )

                if (debugFilters.caret && sEl && sBbox) {
                  caretRects.push(createCaret(eBbox.x, sBbox.y, sBbox.height, baseClass, true))
                }
              })
            })
          })
        })

        // Add selection caret
        if (inputModeActive && selection && selection.kind === 'note') {
          const measure = scoreModel.get(selection.address.measureN)
          const staff = measure?.staves.get(selection.address.staffN)
          if (staff) {
            const staffBbox = currentBboxMap.get(staff.xmlId)
            if (staffBbox) {
              const elBbox = currentBboxMap.get(selection.xmlId)
              const x = elBbox ? elBbox.x : staffBbox.x + 200
              caretRects.push(createCaret(x, staffBbox.y, staffBbox.height, baseClass))
            }
          }
        }

        measureRects.forEach((r) => {
          overlayLayer?.appendChild(r)
        })
        staffRects.forEach((r) => {
          overlayLayer?.appendChild(r)
        })
        noteRects.forEach((r) => {
          overlayLayer?.appendChild(r)
        })
        caretRects.forEach((r) => {
          overlayLayer?.appendChild(r)
        })
      },
    }),
  })
}
