import { useCallback, useRef, useState } from 'react'
import { useLayoutDispatch, useLayoutState } from '../../../features/app/layout/LayoutProvider'
import {
  useMeiFriendIds,
  useWorkspace,
  useWorkspaceSnapshot,
} from '../../../features/app/workspace/WorkspaceProvider'
import WorkspaceTree from './WorkspaceTree'
import './WorkspacePanel.css'

export default function WorkspacePanel() {
  const ids = useMeiFriendIds()
  const workspace = useWorkspace()
  const snapshot = useWorkspaceSnapshot()
  const dispatch = useLayoutDispatch()
  const layoutState = useLayoutState()
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounterRef = useRef(0)

  const handleOpenMei = useCallback(
    async (path: string) => {
      const xml = await workspace.runApi((api) => api.fileIO.readFile(path))
      const meiFriendId = await workspace.openMeiFile(path, xml)
      dispatch({ type: 'openFile', meiFriendId })
    },
    [workspace, dispatch],
  )

  const handleOpenImage = useCallback(
    (path: string) => {
      dispatch({ type: 'openImage', imagePath: path })
    },
    [dispatch],
  )

  // Open paths for MEI files
  const openFilePaths = ids
    .map((id) => workspace.getMeiFriendPath(id))
    .filter((path): path is string => path !== null)

  // Open paths for image panels
  const openImagePaths = Object.values(layoutState.panels)
    .filter((p) => p.type === 'image' && p.imagePath)
    .map((p) => p.imagePath as string)

  // ── File Drop ──────────────────────────────────────────────────────

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current++
    if (dragCounterRef.current === 1) setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setIsDragOver(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      dragCounterRef.current = 0
      setIsDragOver(false)

      const files = Array.from(e.dataTransfer.files)
      if (files.length === 0) return

      // Add to existing file list (no overwriting)
      for (const file of files) {
        await workspace.runApi((api) => api.fileIO.addFile(file))
      }
    },
    [workspace],
  )

  return (
    <section
      className={`explorerPanel${isDragOver ? ' explorerPanel--dropTarget' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      aria-label="Workspace Explorer"
    >
      <div className="explorerTitle">WORKSPACE</div>

      <div className="explorerSection">
        <div className="explorerSectionHeader">{snapshot.name.toUpperCase()}</div>
        <div className="explorerSectionContent">
          {snapshot.files === null ? (
            <div className="explorerEmpty">No files loaded in workspace.</div>
          ) : (
            <WorkspaceTree
              files={snapshot.files}
              onOpenFile={handleOpenMei}
              onOpenImage={handleOpenImage}
              openFilePaths={openFilePaths}
              openImagePaths={openImagePaths}
            />
          )}
        </div>
      </div>

      {/* Drop overlay */}
      {isDragOver && (
        <div className="explorerDropOverlay">
          <div className="explorerDropOverlayText">Drop files to add to workspace</div>
        </div>
      )}
    </section>
  )
}
