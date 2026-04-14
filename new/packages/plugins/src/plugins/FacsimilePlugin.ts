import { definePlugin, meiFriendCorePlugin } from '@mei-friend/core'

// ── Types ──────────────────────────────────────────────────────────────────

export interface FacsimileSurface {
  id: string
  /** Image path from <graphic @target> (relative to MEI or absolute URL) */
  target: string | null
  /** Width (px) calculated from <surface @lrx> - <surface @ulx> */
  width: number | null
  /** Height (px) calculated from <surface @lry> - <surface @uly> */
  height: number | null
  /** Array of zone IDs belonging to this surface */
  zoneIds: string[]
}

export interface FacsimileZone {
  id: string
  surfaceId: string
  ulx: number
  uly: number
  lrx: number
  lry: number
  /** zone/@label */
  label: string | null
  /** xml:ids of elements pointing to this zone (@facs="#{id}") */
  pointingElementIds: string[]
}

export interface FacsimileState {
  /** Whether the MEI file contains <facsimile> elements */
  hasFacsimile: boolean
  /** List of parsed surfaces (ordered) */
  surfaces: FacsimileSurface[]
  /** Map of zones keyed by id */
  zones: Map<string, FacsimileZone>
  /** Index of currently displayed surface */
  currentSurfaceIndex: number
  /** Zoom percentage (10–300) */
  zoomPercent: number
  /** Toggle zone rectangles */
  showZones: boolean
  /** Full page vs cropped to zone */
  showFullPage: boolean
  /** Toggle image titles */
  showTitles: boolean
  /** Zone edit mode (drag/resize) */
  editMode: boolean
  /** Currently selected zone ID */
  selectedZoneId: string | null
}

export interface FacsimileApi {
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
}

// ── XML Parsing ───────────────────────────────────────────────────────────────

function parseFacsimile(
  doc: Document,
): Pick<FacsimileState, 'hasFacsimile' | 'surfaces' | 'zones'> {
  const facsEl = doc.querySelector('facsimile')
  if (!facsEl) {
    return { hasFacsimile: false, surfaces: [], zones: new Map() }
  }

  const surfaces: FacsimileSurface[] = []
  const zones = new Map<string, FacsimileZone>()

  for (const surfaceEl of Array.from(facsEl.querySelectorAll(':scope > surface'))) {
    const surfaceId = surfaceEl.getAttribute('xml:id') ?? `surface-${surfaces.length}`

    const ulx = parseFloat(surfaceEl.getAttribute('ulx') ?? '0') || 0
    const uly = parseFloat(surfaceEl.getAttribute('uly') ?? '0') || 0
    const lrx = parseFloat(surfaceEl.getAttribute('lrx') ?? '0') || 0
    const lry = parseFloat(surfaceEl.getAttribute('lry') ?? '0') || 0
    const width = lrx > ulx ? lrx - ulx : null
    const height = lry > uly ? lry - uly : null

    const graphicEl = surfaceEl.querySelector(':scope > graphic')
    const target = graphicEl?.getAttribute('target') ?? null

    const zoneIds: string[] = []
    for (const zoneEl of Array.from(surfaceEl.querySelectorAll(':scope > zone'))) {
      const zoneId = zoneEl.getAttribute('xml:id')
      if (!zoneId) continue

      const zUlx = parseFloat(zoneEl.getAttribute('ulx') ?? '0') || 0
      const zUly = parseFloat(zoneEl.getAttribute('uly') ?? '0') || 0
      const zLrx = parseFloat(zoneEl.getAttribute('lrx') ?? '0') || 0
      const zLry = parseFloat(zoneEl.getAttribute('lry') ?? '0') || 0
      const label = zoneEl.getAttribute('label')

      zones.set(zoneId, {
        id: zoneId,
        surfaceId,
        ulx: zUlx,
        uly: zUly,
        lrx: zLrx,
        lry: zLry,
        label,
        pointingElementIds: [],
      })
      zoneIds.push(zoneId)
    }

    surfaces.push({ id: surfaceId, target, width, height, zoneIds })
  }

  for (const el of Array.from(doc.querySelectorAll('[facs]'))) {
    const facs = el.getAttribute('facs') ?? ''
    for (const token of facs.trim().split(/\s+/)) {
      const zoneId = token.startsWith('#') ? token.slice(1) : token
      const zone = zones.get(zoneId)
      if (zone) {
        const xmlId = el.getAttribute('xml:id')
        if (xmlId) zone.pointingElementIds.push(xmlId)
      }
    }
  }

  return { hasFacsimile: true, surfaces, zones }
}

// ── Utilities ────────────────────────────────────────────────────────────

function generateXmlId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

// ── Plugin Definition ────────────────────────────────────────────────────────────

/**
 * Manages facsimile (facsimile/surface/zone) data and synchronization with MEI XML.
 */
export const facsimilePlugin = () =>
  definePlugin({
    name: 'facsimile' as const,
    deps: [meiFriendCorePlugin] as const,

    initialState: {
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
    } as FacsimileState,

    onInit: (ctx) => {
      const doc = ctx.depApi.core.getDocument()?.getDocument()
      if (doc) {
        ctx.setState(parseFacsimile(doc))
      }
    },

    onUpdate: (ctx, xmlChanged) => {
      if (!xmlChanged) return
      const doc = ctx.depApi.core.getDocument()?.getDocument()
      if (doc) {
        const parsed = parseFacsimile(doc)
        const currentIndex = ctx.getState().currentSurfaceIndex
        const maxIndex = parsed.surfaces.length - 1
        ctx.setState({
          ...parsed,
          currentSurfaceIndex: Math.min(currentIndex, maxIndex < 0 ? 0 : maxIndex),
          selectedZoneId: parsed.zones.has(ctx.getState().selectedZoneId ?? '')
            ? ctx.getState().selectedZoneId
            : null,
        })
      }
    },

    api: (ctx): FacsimileApi => ({
      setZoom: (percent) => ctx.setState({ zoomPercent: Math.max(10, Math.min(300, percent)) }),

      setShowZones: (v) => ctx.setState({ showZones: v }),
      setShowFullPage: (v) => ctx.setState({ showFullPage: v }),
      setShowTitles: (v) => ctx.setState({ showTitles: v }),
      setEditMode: (v) => ctx.setState({ editMode: v }),

      setCurrentSurface: (index) => {
        const { surfaces } = ctx.getState()
        const clamped = Math.max(0, Math.min(surfaces.length - 1, index))
        ctx.setState({ currentSurfaceIndex: clamped, selectedZoneId: null })
      },

      selectZone: (zoneId) => ctx.setState({ selectedZoneId: zoneId }),

      updateZoneCoords: (zoneId, ulx, uly, lrx, lry) => {
        ctx.depApi.core.edit((doc: Document) => {
          const el =
            doc.querySelector(`[*|id="${zoneId}"]`) ??
            doc.querySelector(`zone[xml\\:id="${zoneId}"]`)
          if (!el) return
          el.setAttribute('ulx', String(Math.round(ulx)))
          el.setAttribute('uly', String(Math.round(uly)))
          el.setAttribute('lrx', String(Math.round(lrx)))
          el.setAttribute('lry', String(Math.round(lry)))
        })
      },

      addZone: (surfaceId, ulx, uly, lrx, lry) => {
        const newId = generateXmlId('zone')
        ctx.depApi.core.edit((doc: Document) => {
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

      deleteZone: (zoneId) => {
        ctx.depApi.core.edit((doc: Document) => {
          const el =
            doc.querySelector(`[*|id="${zoneId}"]`) ??
            doc.querySelector(`zone[xml\\:id="${zoneId}"]`)
          if (!el) return
          for (const pointing of Array.from<Element>(
            doc.querySelectorAll(`[facs~="#${zoneId}"]`),
          )) {
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
    }),
  })
