import { findNoteSelectionById, getElementById } from '@mei-friend2/core'
import type { VerovioOptions } from '@mei-friend2/plugins'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useMeiFriend } from '../../features/app/workspace/useMeiFriend'
import { useWorkspace } from '../../features/app/workspace/WorkspaceProvider'
import './NotationPanel.css'

interface Props {
  meiFriendId: string | null
}

// --- Manual Overlay Helpers -------------------------------------------------------

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

// --- Main Component -------------------------------------------------------------

export default function NotationPanel({ meiFriendId }: Props) {
  const workspace = useWorkspace()
  const instance = meiFriendId ? workspace.getMeiFriendInstance(meiFriendId) : null

  // Selective subscription for performance
  const xmlContent = useMeiFriend(meiFriendId, (s) => s.xmlContent)
  const currentSvg = useMeiFriend(meiFriendId, (s) => s.verovio.currentSvg)
  const scoreModel = useMeiFriend(meiFriendId, (s) => s.verovio.scoreModel)
  const vrvOptions = useMeiFriend(meiFriendId, (s) => s.verovio.vrvOptions)
  const debugFilters = useMeiFriend(meiFriendId, (s) => s.verovio.debugFilters)
  const isRendering = useMeiFriend(meiFriendId, (s) => s.verovio.isRendering)
  const currentPage = useMeiFriend(meiFriendId, (s) => s.verovio.currentPage)
  const totalPages = useMeiFriend(meiFriendId, (s) => s.verovio.totalPages)
  const selection = useMeiFriend(meiFriendId, (s) => s.selection.selection)
  const inputModeActive = useMeiFriend(meiFriendId, (s) => s.selection.inputModeActive)

  const svgContainerRef = useRef<HTMLDivElement>(null)
  const pageInputFocused = useRef(false)
  const [pageInput, setPageInput] = useState('')

  // Cache for BBoxes to avoid redundant getBBox() calls (which trigger layout reflow)
  const bboxCacheRef = useRef<Map<string, { x: number; y: number; width: number; height: number }>>(
    new Map(),
  )

  const svgHtml = useMemo(() => ({ __html: currentSvg ?? '' }), [currentSvg])

  // 1. Calculate BBoxes (Heavy task - only run when SVG or ScoreModel changes)
  useLayoutEffect(() => {
    const container = svgContainerRef.current
    if (!container || !instance || !currentSvg || !scoreModel) return

    const rootSvg = container.querySelector('svg')
    if (!rootSvg) return
    const innerSvg = rootSvg.querySelector('.definition-scale') as SVGSVGElement | null
    if (!innerSvg) return

    const newBboxMap = new Map<string, { x: number; y: number; width: number; height: number }>()
    for (const el of Array.from(innerSvg.querySelectorAll('g[id]'))) {
      const bbox = (el as SVGGraphicsElement).getBBox()
      newBboxMap.set(el.id, {
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
      })
    }

    bboxCacheRef.current = newBboxMap
    // Sync bboxMap back to store for other plugins/components
    instance.runApi((api) => api.verovio.updateBboxMap(newBboxMap))
  }, [currentSvg, scoreModel, instance])

  // 2. Render Overlays & Selection Highlight (Light task - uses cached BBoxes)
  useLayoutEffect(() => {
    const container = svgContainerRef.current
    if (!container || !instance || !currentSvg || !vrvOptions || !scoreModel) return

    const rootSvg = container.querySelector('svg')
    if (!rootSvg) return
    const innerSvg = rootSvg.querySelector('.definition-scale') as SVGSVGElement | null
    if (!innerSvg) return

    const currentBboxMap = bboxCacheRef.current

    // --- Selection Highlight ---
    container.querySelectorAll('g.selected').forEach((el) => {
      el.classList.remove('selected')
    })
    if (selection?.kind === 'note' && selection.xmlId) {
      const el = container.querySelector(`g#${CSS.escape(selection.xmlId)}`)
      if (el) el.classList.add('selected')
    }

    // --- Overlay Rendering ---
    const baseClass = vrvOptions.overlayClassName ?? 'mf-overlay'
    let overlayLayer = innerSvg.querySelector(`#${CSS.escape(baseClass)}-layer`)
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

    const measureRects: SVGRectElement[] = []
    const staffRects: SVGRectElement[] = []
    const noteRects: SVGRectElement[] = []
    const caretRects: SVGRectElement[] = []

    for (const [_measureN, measureModel] of scoreModel.entries()) {
      const mBbox = currentBboxMap.get(measureModel.xmlId)
      if (mBbox && debugFilters?.measure) {
        measureRects.push(
          createOverlayRect(mBbox, `${baseClass}-measure`, measureModel.xmlId, baseClass),
        )
      }

      for (const [_staffN, staff] of measureModel.staves.entries()) {
        const sBbox = currentBboxMap.get(staff.xmlId)
        if (sBbox) {
          staffRects.push(
            createOverlayRect(
              sBbox,
              `${baseClass}-staff${debugFilters?.staff ? ` ${baseClass}-staff--debug` : ''}`,
              staff.xmlId,
              baseClass,
              true,
            ),
          )
        }

        for (const [_lN, layer] of staff.layers.entries()) {
          for (const note of layer.notes) {
            const eBbox = currentBboxMap.get(note.id)
            if (!eBbox) continue

            noteRects.push(
              createOverlayRect(
                eBbox,
                `${baseClass}-note${debugFilters?.note ? ` ${baseClass}-note--debug` : ''}`,
                note.id,
                baseClass,
                true,
              ),
            )

            if (debugFilters?.caret && sBbox) {
              caretRects.push(createCaret(eBbox.x, sBbox.y, sBbox.height, baseClass, true))
            }
          }
        }
      }
    }

    // Add selection caret
    if (inputModeActive && selection?.kind === 'note') {
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

    for (const r of measureRects) overlayLayer.appendChild(r)
    for (const r of staffRects) overlayLayer.appendChild(r)
    for (const r of noteRects) overlayLayer.appendChild(r)
    for (const r of caretRects) overlayLayer.appendChild(r)
  }, [currentSvg, scoreModel, vrvOptions, debugFilters, selection, inputModeActive, instance])

  // Handle Page Input sync
  useEffect(() => {
    if (!pageInputFocused.current) {
      setPageInput(String(currentPage ?? 1))
    }
  }, [currentPage])

  const activateInputMode = async () => {
    if (!instance) return
    const doc = instance.getSnapshot().meiDocument?.getDocument()
    if (!doc) return

    if (!selection || selection.kind !== 'note') {
      const firstNote = doc.querySelector('note, rest')
      if (firstNote) {
        const id = firstNote.getAttribute('xml:id')
        if (id) {
          const sel = findNoteSelectionById(doc, id)
          if (sel) instance.runApi((api) => api.selection.setSelection(sel))
        }
      }
    }
    instance.runApi((api) => api.selection.toggleInputMode())
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!instance) return
    const target = e.target as Element
    const baseClass = vrvOptions?.overlayClassName ?? 'mf-overlay'
    const doc = instance.getSnapshot().meiDocument?.getDocument()
    if (!doc) return

    if (target.classList.contains(`${baseClass}-note`)) {
      const id = target.getAttribute('data-target-id')
      if (!id) return
      const sel = findNoteSelectionById(doc, id)
      if (sel) instance.runApi((api) => api.selection.setSelection(sel))
      return
    }

    if (target.classList.contains(`${baseClass}-staff`)) {
      const id = target.getAttribute('data-target-id')
      if (!id) return
      const el = getElementById(doc, id)
      const measure = el?.closest('measure')
      if (el && measure) {
        const mN = parseInt(measure.getAttribute('n') || '1', 10)
        const sN = parseInt(el.getAttribute('n') || '1', 10)
        instance.runApi((api) =>
          api.selection.setSelection({
            kind: 'staff',
            staffXmlId: id,
            measureXmlId: measure.getAttribute('xml:id') || '',
            measureN: mN,
            staffN: sN,
          }),
        )
      }
      return
    }

    instance.runApi((api) => api.selection.clearSelection())
  }

  // Handle responsive rendering
  useEffect(() => {
    const container = svgContainerRef.current
    if (!container || !instance || !vrvOptions) return

    const compute = () => {
      if (vrvOptions.breaks === 'none' || isRendering) return

      const w = container.clientWidth
      const h = container.clientHeight
      if (!w || !h) return
      const pageWidth = Math.max(Math.floor(w * (100 / vrvOptions.scale)), 100)
      const pageHeight = Math.max(Math.floor(h * (100 / vrvOptions.scale)), 100)
      if (pageWidth !== vrvOptions.pageWidth || pageHeight !== vrvOptions.pageHeight) {
        instance.runApi((api) => api.verovio.setVrvOptions({ pageWidth, pageHeight }))
      }
    }

    const observer = new ResizeObserver(compute)
    observer.observe(container)
    compute()
    return () => observer.disconnect()
  }, [instance, vrvOptions, isRendering])

  if (!xmlContent) {
    return (
      <div className="notationPlaceholder">
        <div style={{ fontSize: '48pt', marginBottom: '0.2em' }}>𝄞</div>
        <strong>No file open</strong>
        <p>Open a MEI file via File → Open file</p>
        <p>or drag &amp; drop a file here</p>
      </div>
    )
  }

  if (!vrvOptions) return <div>Verovio plugin not loaded</div>

  const commitPageInput = () => {
    pageInputFocused.current = false
    const n = parseInt(pageInput, 10)
    if (!Number.isNaN(n) && n >= 1 && n <= (totalPages ?? 1)) {
      if (n !== currentPage) {
        instance?.runApi((api) => api.verovio.changePage(n))
      }
    } else {
      setPageInput(String(currentPage))
    }
  }

  return (
    <div className="notationPanel">
      <div className="notationControls">
        <label className="ctrlLabel" title="Scale">
          <span className="ctrlLabelText">Scale</span>
          <input
            type="range"
            min={10}
            max={200}
            step={5}
            value={vrvOptions.scale}
            onChange={(e) => {
              const scale = Number(e.target.value)
              instance?.runApi((api) => api.verovio.setVrvOptions({ scale }))
            }}
            className="ctrlRange"
          />
          <span className="ctrlValue">{vrvOptions.scale}%</span>
        </label>

        <label className="ctrlLabel" title="Page breaks">
          <span className="ctrlLabelText">Breaks</span>
          <select
            value={vrvOptions.breaks}
            onChange={(e) => {
              const breaks = e.target.value as VerovioOptions['breaks']
              instance?.runApi((api) => api.verovio.setVrvOptions({ breaks }))
            }}
            className="ctrlSelect"
          >
            <option value="none">None</option>
            <option value="auto">Automatic</option>
            <option value="line">System</option>
            <option value="encoded">System and page</option>
          </select>
        </label>

        <div className="ctrlPageNav">
          <button
            type="button"
            className="ctrlBtn"
            onClick={() => instance?.runApi((api) => api.verovio.changePage(1))}
            disabled={(currentPage ?? 1) <= 1}
            title="First page"
          >
            «
          </button>
          <button
            type="button"
            className="ctrlBtn"
            onClick={() =>
              instance?.runApi((api) => api.verovio.changePage((currentPage ?? 1) - 1))
            }
            disabled={(currentPage ?? 1) <= 1}
            title="Previous page"
          >
            ‹
          </button>
          <span className="ctrlPageInfo">
            <input
              type="number"
              className="ctrlPageInput"
              value={pageInput}
              min={1}
              max={totalPages ?? 1}
              onChange={(e) => setPageInput(e.target.value)}
              onFocus={() => {
                pageInputFocused.current = true
              }}
              onBlur={commitPageInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
              title="Current page"
            />
            <span className="ctrlPageTotal"> / {totalPages ?? 1}</span>
          </span>
          <button
            type="button"
            className="ctrlBtn"
            onClick={() =>
              instance?.runApi((api) => api.verovio.changePage((currentPage ?? 1) + 1))
            }
            disabled={(currentPage ?? 1) >= (totalPages ?? 1)}
            title="Next page"
          >
            ›
          </button>
          <button
            type="button"
            className="ctrlBtn"
            onClick={() => instance?.runApi((api) => api.verovio.changePage(totalPages ?? 1))}
            disabled={(currentPage ?? 1) >= (totalPages ?? 1)}
            title="Last page"
          >
            »
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', marginLeft: '12px' }}>
          <button
            type="button"
            className="ctrlBtn"
            onClick={() => {
              if (inputModeActive) {
                instance?.runApi((api) => api.selection.toggleInputMode())
              } else {
                activateInputMode()
              }
            }}
            style={{
              backgroundColor: inputModeActive ? 'var(--highlightColor)' : undefined,
              color: inputModeActive ? 'white' : undefined,
              borderColor: inputModeActive ? 'var(--highlightColor)' : undefined,
            }}
            title="Toggle Input Mode (N)"
          >
            ✎ Input: {inputModeActive ? 'ON' : 'OFF'}
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginLeft: '8px',
            borderLeft: '1px solid var(--dropdownBorderColor)',
            paddingLeft: '8px',
          }}
        >
          <span style={{ fontSize: '10px', color: 'var(--color-fg-muted)', marginRight: '4px' }}>
            🐞 Debug:
          </span>
          {(['measure', 'staff', 'note', 'caret'] as const).map((key) => (
            <button
              type="button"
              key={key}
              className="ctrlBtn"
              onClick={() =>
                instance?.runApi((api) =>
                  api.verovio.setDebugFilters({ [key]: !debugFilters?.[key] }),
                )
              }
              style={{
                backgroundColor: debugFilters?.[key] ? 'var(--notationInputCaretColor)' : undefined,
                color: debugFilters?.[key] ? 'black' : undefined,
                borderColor: debugFilters?.[key] ? 'var(--notationInputCaretColor)' : undefined,
                fontSize: '10px',
                padding: '2px 4px',
                marginLeft: '2px',
                textTransform: 'capitalize',
              }}
              title={`Toggle ${key} debug`}
            >
              {key === 'measure' ? 'Meas' : key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div
        role="application"
        aria-label="Music notation area"
        className="notationSvgArea"
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleClick(e as unknown as React.MouseEvent<HTMLDivElement>)
          }
        }}
        ref={svgContainerRef}
        style={{ position: 'relative' }}
      >
        <div
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Verovio SVGs
          dangerouslySetInnerHTML={svgHtml}
        />
        {isRendering && <div className="notationRendering">Rendering…</div>}
      </div>
    </div>
  )
}
