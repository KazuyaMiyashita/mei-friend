import type { CoreSlice } from '@mei-friend2/core'
import type { StoreApi } from 'zustand/vanilla'
import type { FacsimileSlice, FacsimileSurface, FacsimileZone } from '../slices/facsimileSlice'

export class FacsimileService {
  private unsubscribe: (() => void) | null = null

  constructor(private store: StoreApi<CoreSlice & FacsimileSlice>) {
    this.startSubscription()
    // Initial parse
    const doc = store.getState().meiDocument?.getDocument()
    if (doc) {
      this.store.getState().facsimile.updateState(this.parseFacsimile(doc))
    }
  }

  private startSubscription() {
    this.unsubscribe = this.store.subscribe((state, prevState) => {
      if (state.meiDocument !== prevState.meiDocument) {
        const doc = state.meiDocument?.getDocument()
        if (doc) {
          const parsed = this.parseFacsimile(doc)
          const currentFacs = state.facsimile
          const maxIndex = parsed.surfaces.length - 1
          state.facsimile.updateState({
            ...parsed,
            currentSurfaceIndex: Math.min(
              currentFacs.currentSurfaceIndex,
              maxIndex < 0 ? 0 : maxIndex,
            ),
            selectedZoneId: parsed.zones.has(currentFacs.selectedZoneId ?? '')
              ? currentFacs.selectedZoneId
              : null,
          })
        }
      }
    })
  }

  private parseFacsimile(doc: Document) {
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

  destroy() {
    this.unsubscribe?.()
  }
}
