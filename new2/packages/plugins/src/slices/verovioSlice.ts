import type { ScoreModel, SliceCreator } from '@mei-friend2/core'

export interface BBox {
  x: number
  y: number
  width: number
  height: number
}

/** Map of xml:id to BBox */
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
  isDataLoaded: boolean
  scoreModel: ScoreModel | null
  bboxMap: BBoxMap | null
  vrvOptions: VerovioOptions
  debugFilters: DebugFilters
}

export interface VerovioActions {
  changePage: (page: number) => void
  setVrvOptions: (opts: Partial<VerovioOptions>) => void
  updateBboxMap: (map: BBoxMap) => void
  setDebugFilters: (filters: Partial<DebugFilters>) => void
  updateState: (patch: Partial<VerovioState>) => void
}

export type VerovioSlice = { verovio: VerovioState & VerovioActions }

export const createVerovioSlice: SliceCreator<VerovioSlice> = (set, _get) => ({
  verovio: {
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

    changePage: (page: number) => {
      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      set((state: any) => ({
        verovio: { ...state.verovio, currentPage: page, isRendering: true },
      }))
    },

    setVrvOptions: (opts: Partial<VerovioOptions>) => {
      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      set((state: any) => ({
        verovio: {
          ...state.verovio,
          vrvOptions: { ...state.verovio.vrvOptions, ...opts },
          isRendering: true,
        },
      }))
    },

    updateBboxMap: (map: BBoxMap) => {
      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      set((state: any) => ({
        verovio: { ...state.verovio, bboxMap: map },
      }))
    },

    setDebugFilters: (filters: Partial<DebugFilters>) => {
      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      set((state: any) => ({
        verovio: {
          ...state.verovio,
          debugFilters: { ...state.verovio.debugFilters, ...filters },
        },
      }))
    },

    updateState: (patch: Partial<VerovioState>) => {
      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      set((state: any) => {
        const nextVerovio = { ...state.verovio, ...patch }
        return { verovio: nextVerovio }
      })
    },
  },
})
