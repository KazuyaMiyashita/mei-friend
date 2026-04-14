/**
 * ImagePanel
 *
 * A simple viewer panel that displays image files within the workspace.
 * Unrelated to MeiFriend - only receives imagePath and loads via workspace.api.fileIO.
 * Does not have any editing capabilities.
 */

import { useEffect, useState } from 'react'
import { useWorkspace } from '../../features/app/workspace/WorkspaceProvider'
import './ImagePanel.css'

interface Props {
  /** Relative path within the workspace */
  imagePath: string
}

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; url: string }
  | { status: 'error'; path: string }

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
}

export default function ImagePanel({ imagePath }: Props) {
  const workspace = useWorkspace()
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })
  const [zoom, setZoom] = useState(100)

  useEffect(() => {
    let cancelled = false
    let blobUrl: string | null = null

    setLoadState({ status: 'loading' })

    const load = async () => {
      try {
        const buffer = await workspace.runApi((api) => api.fileIO.readFileBuffer(imagePath))
        if (cancelled) return

        const ext = imagePath.split('.').pop()?.toLowerCase() ?? ''
        const blob = new Blob([buffer], {
          type: MIME[ext] ?? 'application/octet-stream',
        })
        blobUrl = URL.createObjectURL(blob)
        setLoadState({ status: 'loaded', url: blobUrl })
      } catch {
        if (!cancelled) setLoadState({ status: 'error', path: imagePath })
      }
    }

    load()

    return () => {
      cancelled = true
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [imagePath, workspace])

  const fileName = imagePath.split('/').pop() ?? imagePath

  if (loadState.status === 'loading') {
    return (
      <div className="imagePanel">
        <div className="imagePanelPlaceholder">Loading…</div>
      </div>
    )
  }

  if (loadState.status === 'error') {
    return (
      <div className="imagePanel">
        <div className="imagePanelError">
          <span className="errorIcon">⚠</span>
          <strong>Image file not found</strong>
          <span className="errorPath">{loadState.path}</span>
          <p>Add the file to the workspace via the Explorer panel.</p>
        </div>
      </div>
    )
  }

  const { url } = loadState

  return (
    <div className="imagePanel">
      {/* Toolbar */}
      <div className="imagePanelControls">
        <label className="ctrlLabel" title="Zoom">
          <span className="ctrlLabelText">Zoom</span>
          <input
            type="range"
            min={10}
            max={400}
            step={5}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="ctrlRange"
          />
          <span className="ctrlValue">{zoom}%</span>
        </label>
        <button type="button" className="ctrlBtn" onClick={() => setZoom(100)} title="Reset zoom">
          1:1
        </button>
        <span
          className="ctrlLabelText"
          style={{ marginLeft: 'auto', fontFamily: 'monospace' }}
          title={imagePath}
        >
          {fileName}
        </span>
      </div>

      {/* Image Viewport */}
      <div className="imagePanelViewport">
        <div className="imagePanelInner" style={{ transform: `scale(${zoom / 100})` }}>
          <img className="imagePanelImg" src={url} alt={fileName} draggable={false} />
        </div>
      </div>
    </div>
  )
}
