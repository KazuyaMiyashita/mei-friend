/**
 * FacsimilePanel
 *
 * A panel that displays the source image and zone rectangles based on the MEI <facsimile> element.
 * Loads image files via the workspace's fileIO plugin.
 * Changes to zone coordinates are written back to the MEI XML via facsimilePlugin.api.
 */

import { resolveWorkspacePath } from '@mei-friend/core'
import type { FacsimileZone } from '@mei-friend/plugins'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useMeiFriend } from '../../features/app/workspace/useMeiFriend'
import { useWorkspace } from '../../features/app/workspace/WorkspaceProvider'
import './FacsimilePanel.css'

interface Props {
  meiFriendId: string | null
}

// ── Zone Resizing ────────────────────────────────────────────────────────────

type ResizeHandle = 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se' | 'move'

interface ResizeState {
  zoneId: string
  handle: ResizeHandle
  startX: number
  startY: number
  origUlx: number
  origUly: number
  origLrx: number
  origLry: number
  scale: number
}

interface DrawState {
  startX: number
  startY: number
  surfaceId: string
}

const HANDLE_SIZE = 8

function getHandleRects(zone: FacsimileZone) {
  const { ulx, uly, lrx, lry } = zone
  const mx = (ulx + lrx) / 2
  const my = (uly + lry) / 2
  const hs = HANDLE_SIZE
  return [
    { handle: 'nw' as ResizeHandle, x: ulx - hs / 2, y: uly - hs / 2 },
    { handle: 'n' as ResizeHandle, x: mx - hs / 2, y: uly - hs / 2 },
    { handle: 'ne' as ResizeHandle, x: lrx - hs / 2, y: uly - hs / 2 },
    { handle: 'w' as ResizeHandle, x: ulx - hs / 2, y: my - hs / 2 },
    { handle: 'e' as ResizeHandle, x: lrx - hs / 2, y: my - hs / 2 },
    { handle: 'sw' as ResizeHandle, x: ulx - hs / 2, y: lry - hs / 2 },
    { handle: 's' as ResizeHandle, x: mx - hs / 2, y: lry - hs / 2 },
    { handle: 'se' as ResizeHandle, x: lrx - hs / 2, y: lry - hs / 2 },
  ]
}

function applyResize(
  orig: { ulx: number; uly: number; lrx: number; lry: number },
  handle: ResizeHandle,
  dx: number,
  dy: number,
): { ulx: number; uly: number; lrx: number; lry: number } {
  let { ulx, uly, lrx, lry } = orig
  if (handle === 'move') {
    return { ulx: ulx + dx, uly: uly + dy, lrx: lrx + dx, lry: lry + dy }
  }
  if (handle.includes('w')) ulx += dx
  if (handle.includes('e')) lrx += dx
  if (handle.includes('n')) uly += dy
  if (handle.includes('s')) lry += dy
  if (lrx - ulx < 4) {
    if (handle.includes('e')) lrx = ulx + 4
    else ulx = lrx - 4
  }
  if (lry - uly < 4) {
    if (handle.includes('s')) lry = uly + 4
    else uly = lry - 4
  }
  return { ulx, uly, lrx, lry }
}

// ── Main Component ──────────────────────────────────────────────────────

export default function FacsimilePanel({ meiFriendId }: Props) {
  const mf = useMeiFriend(meiFriendId)
  const workspace = useWorkspace()
  const viewportRef = useRef<HTMLDivElement>(null)

  // surfaceId → Blob URL (loaded)
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map())
  // surfaceId → Resolved path (used for error display on load failure)
  const [imageErrors, setImageErrors] = useState<Map<string, string>>(new Map())
  // Set of loading surfaceIds
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())

  const [drawRect, setDrawRect] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null,
  )
  const [liveZone, setLiveZone] = useState<{
    id: string
    ulx: number
    uly: number
    lrx: number
    lry: number
  } | null>(null)

  const resizeRef = useRef<ResizeState | null>(null)
  const drawRef = useRef<DrawState | null>(null)

  const facsState = mf?.facsimile
  const instance = meiFriendId ? workspace.getMeiFriendInstance(meiFriendId) : null

  // ── Image Loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!facsState?.hasFacsimile) return
    const fileName = mf?.core.fileName ?? null

    let cancelled = false

    const loadImages = async () => {
      for (const surface of facsState.surfaces) {
        if (!surface.target) continue
        if (imageUrls.has(surface.id) || imageErrors.has(surface.id)) continue

        setLoadingIds((prev) => new Set(prev).add(surface.id))

        try {
          const resolved = fileName
            ? resolveWorkspacePath(fileName, surface.target)
            : surface.target
          const buffer = await workspace.runApi((api) => api.fileIO.readFileBuffer(resolved))
          if (cancelled) return

          const ext = resolved.split('.').pop()?.toLowerCase() ?? ''
          const mimeMap: Record<string, string> = {
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            gif: 'image/gif',
            webp: 'image/webp',
            svg: 'image/svg+xml',
            tif: 'image/tiff',
            tiff: 'image/tiff',
          }
          const blob = new Blob([buffer], { type: mimeMap[ext] ?? 'application/octet-stream' })
          const url = URL.createObjectURL(blob)

          setImageUrls((prev) => {
            const next = new Map(prev)
            next.set(surface.id, url)
            return next
          })
        } catch {
          if (cancelled) return
          // Load failed: record resolved path to use for error display
          const resolved = fileName
            ? resolveWorkspacePath(fileName, surface.target)
            : surface.target
          setImageErrors((prev) => {
            const next = new Map(prev)
            next.set(surface.id, resolved)
            return next
          })
        } finally {
          if (!cancelled) {
            setLoadingIds((prev) => {
              const next = new Set(prev)
              next.delete(surface.id)
              return next
            })
          }
        }
      }
    }

    loadImages()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    facsState?.surfaces,
    mf?.core.fileName,
    workspace.runApi,
    imageUrls.has,
    imageErrors.has,
    facsState?.hasFacsimile,
  ])

  // Reset error cache when workspace file updates (retry)
  useEffect(() => {
    setImageErrors(new Map())
  }, [])

  // ── Mouse Events for Zone Resizing ───────────────────────────────────────

  const onHandleMouseDown = useCallback(
    (
      e: React.MouseEvent,
      zone: FacsimileZone,
      handle: ResizeHandle,
      imageWidth: number,
      displayWidth: number,
    ) => {
      e.stopPropagation()
      e.preventDefault()
      resizeRef.current = {
        zoneId: zone.id,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        origUlx: zone.ulx,
        origUly: zone.uly,
        origLrx: zone.lrx,
        origLry: zone.lry,
        scale: imageWidth / displayWidth,
      }
      setLiveZone({ id: zone.id, ulx: zone.ulx, uly: zone.uly, lrx: zone.lrx, lry: zone.lry })
    },
    [],
  )

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return
      const rs = resizeRef.current
      const dx = (e.clientX - rs.startX) * rs.scale
      const dy = (e.clientY - rs.startY) * rs.scale
      const next = applyResize(
        { ulx: rs.origUlx, uly: rs.origUly, lrx: rs.origLrx, lry: rs.origLry },
        rs.handle,
        dx,
        dy,
      )
      setLiveZone({ id: rs.zoneId, ...next })
    }
    const onMouseUp = async (e: MouseEvent) => {
      if (!resizeRef.current) return
      const rs = resizeRef.current
      const dx = (e.clientX - rs.startX) * rs.scale
      const dy = (e.clientY - rs.startY) * rs.scale
      const next = applyResize(
        { ulx: rs.origUlx, uly: rs.origUly, lrx: rs.origLrx, lry: rs.origLry },
        rs.handle,
        dx,
        dy,
      )
      await instance?.runApi((api) =>
        api.facsimile.updateZoneCoords(rs.zoneId, next.ulx, next.uly, next.lrx, next.lry),
      )
      resizeRef.current = null
      setLiveZone(null)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [instance])

  // ── Mouse Events for Zone Drawing ────────────────────────────────────────────

  const onViewportMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!facsState?.editMode || resizeRef.current) return
      const surface = facsState.surfaces[facsState.currentSurfaceIndex]
      if (!surface) return
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
      drawRef.current = {
        startX: e.clientX - rect.left,
        startY: e.clientY - rect.top,
        surfaceId: surface.id,
      }
      setDrawRect({ x: drawRef.current.startX, y: drawRef.current.startY, w: 0, h: 0 })
    },
    [facsState],
  )

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!drawRef.current || !viewportRef.current) return
      const rect = viewportRef.current.getBoundingClientRect()
      const x = Math.min(drawRef.current.startX, e.clientX - rect.left)
      const y = Math.min(drawRef.current.startY, e.clientY - rect.top)
      const w = Math.abs(e.clientX - rect.left - drawRef.current.startX)
      const h = Math.abs(e.clientY - rect.top - drawRef.current.startY)
      setDrawRect({ x, y, w, h })
    }
    const onMouseUp = async (e: MouseEvent) => {
      const currentDraw = drawRef.current
      if (!currentDraw || !viewportRef.current || !instance) return
      const rect = viewportRef.current.getBoundingClientRect()
      const endX = e.clientX - rect.left
      const endY = e.clientY - rect.top
      const x0 = Math.min(currentDraw.startX, endX)
      const y0 = Math.min(currentDraw.startY, endY)
      const x1 = Math.max(currentDraw.startX, endX)
      const y1 = Math.max(currentDraw.startY, endY)
      if (x1 - x0 > 4 && y1 - y0 > 4 && facsState) {
        const zoom = facsState.zoomPercent / 100
        await instance.runApi((api) =>
          api.facsimile.addZone(currentDraw.surfaceId, x0 / zoom, y0 / zoom, x1 / zoom, y1 / zoom),
        )
      }
      drawRef.current = null
      setDrawRect(null)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [instance, facsState])

  // ── Early Return ──────────────────────────────────────────────────────────

  if (!mf?.core.xmlContent) {
    return (
      <div className="facsimilePlaceholder">
        <strong>No file open</strong>
        <p>Open a MEI file to view its facsimile</p>
      </div>
    )
  }

  if (!facsState?.hasFacsimile) {
    return (
      <div className="facsimilePlaceholder">
        <strong>No facsimile data</strong>
        <p>This file does not contain a &lt;facsimile&gt; element.</p>
      </div>
    )
  }

  const {
    surfaces,
    zones,
    currentSurfaceIndex,
    zoomPercent,
    showZones,
    showTitles,
    editMode,
    selectedZoneId,
  } = facsState
  const surface = surfaces[currentSurfaceIndex]
  const imageUrl = surface ? imageUrls.get(surface.id) : undefined
  const imageError = surface ? imageErrors.get(surface.id) : undefined
  const isLoading = surface ? loadingIds.has(surface.id) : false
  const zoom = zoomPercent / 100

  const surfaceZones: FacsimileZone[] = surface
    ? surface.zoneIds.flatMap((id: string) => {
        const z = zones.get(id)
        return z ? [z] : []
      })
    : []

  const imgNaturalWidth = surface?.width ?? null
  const imgNaturalHeight = surface?.height ?? null

  // ── Rendering ──────────────────────────────────────────────────────────

  return (
    <div className="facsimilePanel">
      {/* Toolbar */}
      <div className="facsimileControls">
        <label className="ctrlLabel" title="Zoom">
          <span className="ctrlLabelText">Zoom</span>
          <input
            type="range"
            min={10}
            max={300}
            step={5}
            value={zoomPercent}
            onChange={async (e) =>
              await instance?.runApi((api) => api.facsimile.setZoom(Number(e.target.value)))
            }
            className="ctrlRange"
          />
          <span className="ctrlValue">{zoomPercent}%</span>
        </label>

        <div className="facsimilePageNav">
          <button
            type="button"
            className="ctrlBtn"
            onClick={async () =>
              await instance?.runApi((api) =>
                api.facsimile.setCurrentSurface(currentSurfaceIndex - 1),
              )
            }
            disabled={currentSurfaceIndex <= 0}
            title="Previous surface"
          >
            ‹
          </button>
          <span className="facsimilePageInfo">
            {currentSurfaceIndex + 1} / {surfaces.length}
          </span>
          <button
            type="button"
            className="ctrlBtn"
            onClick={async () =>
              await instance?.runApi((api) =>
                api.facsimile.setCurrentSurface(currentSurfaceIndex + 1),
              )
            }
            disabled={currentSurfaceIndex >= surfaces.length - 1}
            title="Next surface"
          >
            ›
          </button>
        </div>

        <button
          type="button"
          className={`ctrlBtn${showZones ? ' ctrlBtn--active' : ''}`}
          onClick={async () =>
            await instance?.runApi((api) => api.facsimile.setShowZones(!showZones))
          }
          title="Show zones"
        >
          Zones
        </button>
        <button
          type="button"
          className={`ctrlBtn${showTitles ? ' ctrlBtn--active' : ''}`}
          onClick={async () =>
            await instance?.runApi((api) => api.facsimile.setShowTitles(!showTitles))
          }
          title="Show image filename"
        >
          Titles
        </button>
        <button
          type="button"
          className={`ctrlBtn${editMode ? ' ctrlBtn--active' : ''}`}
          onClick={async () =>
            await instance?.runApi((api) => api.facsimile.setEditMode(!editMode))
          }
          title="Edit zone positions"
        >
          Edit zones
        </button>

        {editMode && selectedZoneId && (
          <button
            type="button"
            className="ctrlBtn"
            onClick={async () => {
              await instance?.runApi((api) => api.facsimile.deleteZone(selectedZoneId))
              await instance?.runApi((api) => api.facsimile.selectZone(null))
            }}
            title="Delete selected zone"
            style={{ color: 'var(--fileStatusWarnColor)' }}
          >
            Delete zone
          </button>
        )}
      </div>

      {/* Image Viewport */}
      {/* biome-ignore lint/a11y/useSemanticElements: Viewport area cannot be a native button */}
      <div
        ref={viewportRef}
        className={`facsimileViewport${editMode ? ' facsimileViewport--drawing' : ''}`}
        onMouseDown={onViewportMouseDown}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            // Drawing is primarily mouse-based, but we provide the role/tabIndex for accessibility
            e.preventDefault()
          }
        }}
        aria-label="Facsimile viewport"
      >
        {!surface ? (
          <div className="facsimilePlaceholder">
            <strong>No surface</strong>
          </div>
        ) : isLoading ? (
          <div className="facsimileLoading">Loading…</div>
        ) : imageError ? (
          /* ── File Not Found Error ── */
          <div className="facsimileImageError">
            <span className="errorIcon">⚠</span>
            <strong>Image file not found</strong>
            <span className="errorPath">{imageError}</span>
            <p>
              Add the image to the workspace via the Explorer panel,
              <br />
              then reopen this file.
            </p>
          </div>
        ) : !imageUrl ? (
          <div className="facsimilePlaceholder">
            <strong>No image</strong>
            <p>
              {surface.target
                ? `Target: ${surface.target}`
                : 'No image target specified in <graphic>'}
            </p>
          </div>
        ) : (
          <div className="facsimileInner" style={{ transform: `scale(${zoom})` }}>
            <img
              className="facsimileImage"
              src={imageUrl}
              alt={surface.target ?? 'facsimile'}
              draggable={false}
            />

            {showTitles && surface.target && (
              <span className="facsimileTitle">{surface.target.split('/').pop()}</span>
            )}

            {showZones && (
              <svg
                className="facsimileSvgOverlay"
                style={{
                  width: imgNaturalWidth ?? '100%',
                  height: imgNaturalHeight ?? '100%',
                }}
                viewBox={
                  imgNaturalWidth && imgNaturalHeight
                    ? `0 0 ${imgNaturalWidth} ${imgNaturalHeight}`
                    : undefined
                }
                xmlns="http://www.w3.org/2000/svg"
                role="img"
              >
                <title>Facsimile zones</title>
                {surfaceZones.map((zone) => {
                  const z = liveZone?.id === zone.id ? { ...zone, ...liveZone } : zone
                  const isSelected = selectedZoneId === zone.id

                  return (
                    <g key={zone.id}>
                      {/* biome-ignore lint/a11y/useSemanticElements: SVG elements cannot be <button> */}
                      <rect
                        role="button"
                        tabIndex={0}
                        className={[
                          'facsimileZone',
                          isSelected ? 'facsimileZone--selected' : '',
                          editMode ? 'facsimileZone--edit' : '',
                        ].join(' ')}
                        x={z.ulx}
                        y={z.uly}
                        width={z.lrx - z.ulx}
                        height={z.lry - z.uly}
                        onClick={async (e) => {
                          e.stopPropagation()
                          await instance?.runApi((api) =>
                            api.facsimile.selectZone(isSelected ? null : zone.id),
                          )
                        }}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation()
                            e.preventDefault()
                            await instance?.runApi((api) =>
                              api.facsimile.selectZone(isSelected ? null : zone.id),
                            )
                          }
                        }}
                        onMouseDown={
                          editMode
                            ? (e) => {
                                if ((e.target as SVGElement).classList.contains('facsimileHandle'))
                                  return
                                onHandleMouseDown(
                                  e,
                                  zone,
                                  'move',
                                  imgNaturalWidth ?? z.lrx - z.ulx,
                                  imgNaturalWidth ?? z.lrx - z.ulx,
                                )
                              }
                            : undefined
                        }
                      />

                      {(zone.label ?? zone.pointingElementIds[0]) && (
                        <text className="facsimileZoneLabel" x={z.ulx + 3} y={z.uly - 3}>
                          {zone.label ?? zone.pointingElementIds[0]}
                        </text>
                      )}

                      {editMode &&
                        isSelected &&
                        getHandleRects(z).map(({ handle, x, y }) => (
                          // biome-ignore lint/a11y/useSemanticElements: SVG elements cannot be <button>
                          <rect
                            key={handle}
                            role="button"
                            tabIndex={0}
                            className="facsimileHandle"
                            x={x}
                            y={y}
                            width={HANDLE_SIZE}
                            height={HANDLE_SIZE}
                            rx={1}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                              }
                            }}
                            onMouseDown={(e) =>
                              onHandleMouseDown(
                                e,
                                zone,
                                handle,
                                imgNaturalWidth ?? z.lrx - z.ulx,
                                imgNaturalWidth ?? z.lrx - z.ulx,
                              )
                            }
                          />
                        ))}
                    </g>
                  )
                })}
              </svg>
            )}

            {editMode && drawRect && (
              <svg
                className="facsimileSvgOverlay"
                style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
                role="presentation"
              >
                <rect
                  x={drawRect.x / zoom}
                  y={drawRect.y / zoom}
                  width={drawRect.w / zoom}
                  height={drawRect.h / zoom}
                  fill="none"
                  stroke="var(--fileStatusChangedColor, darkorange)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
              </svg>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
