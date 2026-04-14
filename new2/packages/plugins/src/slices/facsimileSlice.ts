import type { CoreSlice, SliceCreator } from '@mei-friend2/core'

export interface FacsimileSurface {
  id: string
  target: string | null
  width: number | null
  height: number | null
  zoneIds: string[]
}

export interface FacsimileZone {
  id: string
  surfaceId: string
  ulx: number
  uly: number
  lrx: number
  lry: number
  label: string | null
  pointingElementIds: string[]
}

export interface FacsimileState {
  hasFacsimile: boolean
  surfaces: FacsimileSurface[]
  zones: Map<string, FacsimileZone>
  currentSurfaceIndex: number
  zoomPercent: number
  showZones: boolean
  showFullPage: boolean
  showTitles: boolean
  editMode: boolean
  selectedZoneId: string | null
}

export interface FacsimileActions {
  setZoom: (percent: number) => void
  setShowZones: (v: boolean) => void
  setShowFullPage: (v: boolean) => void
  setShowTitles: (v: boolean) => void
  setEditMode: (v: boolean) => void
  setCurrentSurface: (index: number) => void
  selectZone: (zoneId: string | null) => void
  updateZoneCoords: (zoneId: string, ulx: number, uly: number, lrx: number, lry: number) => void
  addZone: (surfaceId: string, ulx: number, uly: number, lrx: number, lry: number) => string
  deleteZone: (zoneId: string) => void
  updateState: (patch: Partial<FacsimileState>) => void
}

export type FacsimileSlice = { facsimile: FacsimileState & FacsimileActions }

function generateXmlId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export const createFacsimileSlice: SliceCreator<FacsimileSlice> = (set, get) => ({
  facsimile: {
    hasFacsimile: false,
    surfaces: [],
    zones: new Map(),
    currentSurfaceIndex: 0,
    zoomPercent: 100,
    showZones: true,
    showFullPage: true,
    showTitles: true,
    editMode: false,
    selectedZoneId: null,

    setZoom: (percent: number) => {
      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      set((state: any) => ({
        facsimile: { ...state.facsimile, zoomPercent: Math.max(10, Math.min(300, percent)) },
      }))
    },

    setShowZones: (v: boolean) => {
      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      set((state: any) => ({
        facsimile: { ...state.facsimile, showZones: v },
      }))
    },

    setShowFullPage: (v: boolean) => {
      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      set((state: any) => ({
        facsimile: { ...state.facsimile, showFullPage: v },
      }))
    },

    setShowTitles: (v: boolean) => {
      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      set((state: any) => ({
        facsimile: { ...state.facsimile, showTitles: v },
      }))
    },

    setEditMode: (v: boolean) => {
      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      set((state: any) => ({
        facsimile: { ...state.facsimile, editMode: v },
      }))
    },

    setCurrentSurface: (index: number) => {
      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      set((state: any) => {
        const { surfaces } = state.facsimile
        const clamped = Math.max(0, Math.min(surfaces.length - 1, index))
        return {
          facsimile: { ...state.facsimile, currentSurfaceIndex: clamped, selectedZoneId: null },
        }
      })
    },

    selectZone: (zoneId: string | null) => {
      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      set((state: any) => ({
        facsimile: { ...state.facsimile, selectedZoneId: zoneId },
      }))
    },

    updateZoneCoords: (zoneId: string, ulx: number, uly: number, lrx: number, lry: number) => {
      const state = get() as CoreSlice
      state.edit((doc: Document) => {
        const el =
          doc.querySelector(`[*|id="${zoneId}"]`) ?? doc.querySelector(`zone[xml\\:id="${zoneId}"]`)
        if (!el) return
        el.setAttribute('ulx', String(Math.round(ulx)))
        el.setAttribute('uly', String(Math.round(uly)))
        el.setAttribute('lrx', String(Math.round(lrx)))
        el.setAttribute('lry', String(Math.round(lry)))
      })
    },

    addZone: (surfaceId: string, ulx: number, uly: number, lrx: number, lry: number) => {
      const newId = generateXmlId('zone')
      const state = get() as CoreSlice
      state.edit((doc: Document) => {
        const surfaceEl =
          doc.querySelector(`[*|id="${surfaceId}"]`) ??
          doc.querySelector(`surface[xml\\:id="${surfaceId}"]`)
        if (!surfaceEl) return
        const zoneEl = doc.createElementNS('http://www.music-encoding.org/ns/mei', 'zone')
        zoneEl.setAttribute('xml:id', newId)
        zoneEl.setAttribute('ulx', String(Math.round(ulx)))
        zoneEl.setAttribute('uly', String(Math.round(uly)))
        zoneEl.setAttribute('lrx', String(Math.round(lrx)))
        zoneEl.setAttribute('lry', String(Math.round(lry)))
        surfaceEl.appendChild(zoneEl)
      })
      return newId
    },

    deleteZone: (zoneId: string) => {
      const state = get() as CoreSlice
      state.edit((doc: Document) => {
        const el =
          doc.querySelector(`[*|id="${zoneId}"]`) ?? doc.querySelector(`zone[xml\\:id="${zoneId}"]`)
        if (!el) return
        for (const pointing of Array.from<Element>(doc.querySelectorAll(`[facs~="#${zoneId}"]`))) {
          const facs = pointing.getAttribute('facs') ?? ''
          const updated = facs
            .split(/\s+/)
            .filter((t: string) => t !== `#${zoneId}`)
            .join(' ')
            .trim()
          if (updated) {
            pointing.setAttribute('facs', updated)
          } else {
            pointing.removeAttribute('facs')
          }
        }
        el.parentElement?.removeChild(el)
      })
    },

    updateState: (patch: Partial<FacsimileState>) => {
      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      set((state: any) => ({
        facsimile: { ...state.facsimile, ...patch },
      }))
    },
  },
})
