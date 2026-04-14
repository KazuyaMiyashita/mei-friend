import { findNoteSelectionById, getElementById } from '@mei-friend/core'
import type { VerovioOptions } from '@mei-friend/plugins'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppMeiFriend } from '../../features/app/workspace/plugins'
import { useMeiFriend } from '../../features/app/workspace/useMeiFriend'
import { useWorkspace } from '../../features/app/workspace/WorkspaceProvider'
import './NotationPanel.css'

interface Props {
  meiFriendId: string | null
}

// --- Main Component -------------------------------------------------------------

export default function NotationPanel({ meiFriendId }: Props) {
  const mf = useMeiFriend(meiFriendId)
  const workspace = useWorkspace()
  const instance: AppMeiFriend | null = meiFriendId
    ? (workspace.getMeiFriendInstance(meiFriendId) ?? null)
    : null
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const pageInputFocused = useRef(false)

  const [pageInput, setPageInput] = useState('')

  const svgHtml = useMemo(
    () => ({ __html: mf?.verovio?.currentSvg ?? '' }),
    [mf?.verovio?.currentSvg],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: trigger on SVG or debug changes
  useEffect(() => {
    const container = svgContainerRef.current
    if (!container || !instance) return

    instance.runApi((api) =>
      api.verovio.renderOverlays(
        container,
        mf?.selection?.selection,
        mf?.selection?.inputModeActive,
      ),
    )
  }, [
    instance,
    mf?.verovio?.currentSvg,
    mf?.verovio?.debugFilters,
    mf?.selection?.selection,
    mf?.selection?.inputModeActive,
  ])

  const activateInputMode = async () => {
    if (!instance) return
    await instance.runApi((api) => {
      const currentSel = mf?.selection?.selection
      if (!currentSel || currentSel.kind !== 'note') {
        const doc = api.core.getDocument()?.getDocument()
        if (doc) {
          const firstNote = doc.querySelector('note, rest')
          if (firstNote) {
            const id = firstNote.getAttribute('xml:id')
            if (id) {
              const sel = findNoteSelectionById(doc, id)
              if (sel) api.selection.setSelection(sel)
            }
          }
        }
      }
      api.selection.toggleInputMode()
    })
  }

  const handleClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!instance) return
    const target = e.target as Element
    const baseClass = mf?.verovio?.vrvOptions.overlayClassName ?? 'mf-overlay'
    await instance.runApi((api) => {
      const doc = api.core.getDocument()?.getDocument()
      if (!doc) return

      if (target.classList.contains(`${baseClass}-note`)) {
        const id = target.getAttribute('data-target-id')
        if (!id) return
        const sel = findNoteSelectionById(doc, id)
        if (sel) api.selection.setSelection(sel)
        return
      }

      if (target.classList.contains(`${baseClass}-staff`)) {
        const id = target.getAttribute('data-target-id')
        if (!id) return
        // For staff selection, only build the address
        const el = getElementById(doc, id)
        const measure = el?.closest('measure')
        if (el && measure) {
          const mN = parseInt(measure.getAttribute('n') || '1', 10)
          const sN = parseInt(el.getAttribute('n') || '1', 10)
          api.selection.setSelection({
            kind: 'staff',
            staffXmlId: id,
            measureXmlId: measure.getAttribute('xml:id') || '',
            measureN: mN,
            staffN: sN,
          })
        }
        return
      }

      api.selection.clearSelection()
    })
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: trigger on SVG change
  useEffect(() => {
    const container = svgContainerRef.current
    if (!container) return
    container.querySelectorAll('g.selected').forEach((el) => {
      el.classList.remove('selected')
    })
    const sel = mf?.selection?.selection
    if (sel?.kind === 'note' && sel.xmlId) {
      const el = container.querySelector(`g#${CSS.escape(sel.xmlId)}`)
      if (el) el.classList.add('selected')
    }
  }, [mf?.selection?.selection, mf?.verovio?.currentSvg])

  const vrvOptsRef = useRef<VerovioOptions | undefined>(undefined)
  useEffect(() => {
    vrvOptsRef.current = mf?.verovio?.vrvOptions
  })

  useEffect(() => {
    const container = svgContainerRef.current
    if (!container || !instance) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const compute = () => {
      const o = vrvOptsRef.current
      if (!o || o.breaks === 'none') return
      // Don't request new render if already rendering
      if (mf?.verovio?.isRendering) return

      const w = container.clientWidth
      const h = container.clientHeight
      if (!w || !h) return
      const pageWidth = Math.max(Math.floor(w * (100 / o.scale)), 100)
      const pageHeight = Math.max(Math.floor(h * (100 / o.scale)), 100)
      if (pageWidth !== o.pageWidth || pageHeight !== o.pageHeight) {
        instance.runApi((api) => api.verovio.setVrvOptions({ pageWidth, pageHeight }))
      }
    }
    const debouncedCompute = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(compute, 300)
    }
    const observer = new ResizeObserver(debouncedCompute)
    observer.observe(container)
    compute()
    return () => {
      observer.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [instance, mf?.verovio?.isRendering])

  useEffect(() => {
    if (!pageInputFocused.current) {
      setPageInput(String(mf?.verovio?.currentPage ?? 1))
    }
  }, [mf?.verovio?.currentPage])

  const setOpt = <K extends keyof VerovioOptions>(key: K, value: VerovioOptions[K]) => {
    instance?.runApi((api) => api.verovio.setVrvOptions({ [key]: value }))
  }

  if (!mf?.core?.xmlContent) {
    return (
      <div className="notationPlaceholder">
        <div style={{ fontSize: '48pt', marginBottom: '0.2em' }}>𝄞</div>
        <strong>No file open</strong>
        <p>Open a MEI file via File → Open file</p>
        <p>or drag &amp; drop a file here</p>
      </div>
    )
  }

  const vrvState = mf.verovio
  if (!vrvState) return <div>Verovio plugin not loaded</div>
  const opts = vrvState.vrvOptions
  const debugFilters = vrvState.debugFilters

  const commitPageInput = () => {
    pageInputFocused.current = false
    const n = parseInt(pageInput, 10)
    if (!Number.isNaN(n) && n >= 1 && n <= vrvState.totalPages) {
      if (n !== vrvState.currentPage) {
        instance?.runApi((api) => api.verovio.changePage(n))
      }
    } else {
      setPageInput(String(vrvState.currentPage))
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
            value={opts.scale}
            onChange={(e) => {
              const scale = Number(e.target.value)
              const container = svgContainerRef.current
              const o = vrvOptsRef.current
              if (container && o && o.breaks !== 'none') {
                const w = container.clientWidth
                const h = container.clientHeight
                if (w && h) {
                  instance?.runApi((api) =>
                    api.verovio.setVrvOptions({
                      scale,
                      pageWidth: Math.max(Math.floor(w * (100 / scale)), 100),
                      pageHeight: Math.max(Math.floor(h * (100 / scale)), 100),
                    }),
                  )
                  return
                }
              }
              setOpt('scale', scale)
            }}
            className="ctrlRange"
          />
          <span className="ctrlValue">{opts.scale}%</span>
        </label>

        <label className="ctrlLabel" title="Page breaks">
          <span className="ctrlLabelText">Breaks</span>
          <select
            value={opts.breaks}
            onChange={(e) => {
              const breaks = e.target.value as VerovioOptions['breaks']
              const container = svgContainerRef.current
              if (container && breaks !== 'none') {
                const w = container.clientWidth
                const h = container.clientHeight
                if (w && h) {
                  instance?.runApi((api) =>
                    api.verovio.setVrvOptions({
                      breaks,
                      pageWidth: Math.max(Math.floor(w * (100 / opts.scale)), 100),
                      pageHeight: Math.max(Math.floor(h * (100 / opts.scale)), 100),
                    }),
                  )
                  return
                }
              }
              setOpt('breaks', breaks)
            }}
            className="ctrlSelect"
          >
            <option value="none">None</option>
            <option value="auto">Automatic</option>
            <option value="line">System</option>
            <option value="encoded">System and page</option>
            <option value="smart" disabled>
              Smart
            </option>
          </select>
        </label>

        <div className="ctrlPageNav">
          <button
            type="button"
            className="ctrlBtn"
            onClick={() => instance?.runApi((api) => api.verovio.changePage(1))}
            disabled={vrvState.currentPage <= 1}
            title="First page"
          >
            «
          </button>
          <button
            type="button"
            className="ctrlBtn"
            onClick={() =>
              instance?.runApi((api) => api.verovio.changePage(vrvState.currentPage - 1))
            }
            disabled={vrvState.currentPage <= 1}
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
              max={vrvState.totalPages}
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
            <span className="ctrlPageTotal"> / {vrvState.totalPages}</span>
          </span>
          <button
            type="button"
            className="ctrlBtn"
            onClick={() =>
              instance?.runApi((api) => api.verovio.changePage(vrvState.currentPage + 1))
            }
            disabled={vrvState.currentPage >= vrvState.totalPages}
            title="Next page"
          >
            ›
          </button>
          <button
            type="button"
            className="ctrlBtn"
            onClick={() => instance?.runApi((api) => api.verovio.changePage(vrvState.totalPages))}
            disabled={vrvState.currentPage >= vrvState.totalPages}
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
              if (mf?.selection?.inputModeActive) {
                instance?.runApi((api) => api.selection.toggleInputMode())
              } else {
                activateInputMode()
              }
            }}
            style={{
              backgroundColor: mf?.selection?.inputModeActive ? 'var(--highlightColor)' : undefined,
              color: mf?.selection?.inputModeActive ? 'white' : undefined,
              borderColor: mf?.selection?.inputModeActive ? 'var(--highlightColor)' : undefined,
            }}
            title="Toggle Input Mode (N)"
          >
            ✎ Input: {mf?.selection?.inputModeActive ? 'ON' : 'OFF'}
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
          <span
            style={{
              fontSize: '10px',
              color: 'var(--color-fg-muted)',
              marginRight: '4px',
            }}
          >
            🐞 Debug:
          </span>
          {(['measure', 'staff', 'note', 'caret'] as const).map((key) => (
            <button
              type="button"
              key={key}
              className="ctrlBtn"
              onClick={() =>
                instance?.runApi((api) =>
                  api.verovio.setDebugFilters({ [key]: !debugFilters[key] }),
                )
              }
              style={{
                backgroundColor: debugFilters[key] ? 'var(--notationInputCaretColor)' : undefined,
                color: debugFilters[key] ? 'black' : undefined,
                borderColor: debugFilters[key] ? 'var(--notationInputCaretColor)' : undefined,
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
        {mf?.verovio?.currentSvg ? (
          <div
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Verovio SVGs must be injected as HTML
            dangerouslySetInnerHTML={svgHtml}
          />
        ) : (
          <div className="notationRendering">Rendering…</div>
        )}
      </div>
    </div>
  )
}
