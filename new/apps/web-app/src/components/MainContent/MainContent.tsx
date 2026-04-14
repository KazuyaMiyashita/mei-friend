import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/react'
import { DragDropProvider } from '@dnd-kit/react'
import { useCallback, useRef, useState } from 'react'
import { useLayoutDispatch, useLayoutState } from '../../features/app/layout/LayoutProvider'
import { findGroupById } from '../../features/app/layout/layoutUtils'
import type { Zone } from '../../features/app/layout/types'
import { useWorkspace } from '../../features/app/workspace/WorkspaceProvider'
import SplashOverlay from '../Modals/SplashOverlay'
import LayoutRenderer from './LayoutRenderer'
import type { DraggingInfo } from './TabGroup'
import './MainContent.css'

interface MainContentProps {
  showSplash: boolean
  onDismissSplash: (alwaysShow: boolean) => void
}

export default function MainContent({ showSplash, onDismissSplash }: MainContentProps) {
  const layoutState = useLayoutState()
  const dispatch = useLayoutDispatch()
  const workspace = useWorkspace()

  // Session state to track if splash was dismissed
  const [isSplashDismissed, setIsSplashDismissed] = useState(false)

  // Synchronously update on render to prevent stale closures
  const layoutStateRef = useRef(layoutState)
  layoutStateRef.current = layoutState

  const [draggingInfo, setDraggingInfo] = useState<DraggingInfo | null>(null)

  // ── Tab DnD ──────────────────────────────────────────────────────────────

  const handleDragStart = useCallback((event: Parameters<DragStartEvent>[0]) => {
    const sourceData = event.operation?.source?.data as
      | { panelId: string; groupId: string }
      | undefined
    if (sourceData && layoutStateRef.current.layout) {
      const group = findGroupById(layoutStateRef.current.layout, sourceData.groupId)
      const info = {
        panelId: sourceData.panelId,
        sourceGroupId: sourceData.groupId,
        sourceTabCount: group?.tabs.length ?? 0,
      }
      console.log('[DnD] dragStart', info)
      setDraggingInfo(info)
    }
  }, [])

  const handleDragEnd = useCallback(
    (event: Parameters<DragEndEvent>[0]) => {
      setDraggingInfo(null)
      if (event.canceled) return

      const source = event.operation.source
      const target = event.operation.target
      if (!source || !target) return

      const sourceData = source.data as { panelId: string; groupId: string } | undefined
      const targetData = target.data as { groupId: string; zone: Zone } | undefined
      if (!sourceData || !targetData) return

      const { panelId, groupId: srcGroupId } = sourceData
      const { groupId: tgtGroupId, zone } = targetData

      const isEdgeZone = zone === 'top' || zone === 'bottom' || zone === 'left' || zone === 'right'
      console.log('[DnD] dragEnd', {
        panelId,
        srcGroupId,
        tgtGroupId,
        zone,
        isEdgeZone,
        layout: layoutStateRef.current.layout,
      })
      if (!isEdgeZone) {
        if (srcGroupId === tgtGroupId) return
        dispatch({ type: 'moveTab', panelId, srcGroupId, tgtGroupId })
      } else {
        const direction = zone === 'top' || zone === 'bottom' ? 'vertical' : 'horizontal'
        const insertBefore = zone === 'top' || zone === 'left'
        dispatch({
          type: 'splitGroup',
          panelId,
          srcGroupId,
          tgtGroupId,
          direction,
          insertBefore,
        })
      }
    },
    [dispatch],
  )

  const handleDragOver = useCallback(
    (event: Parameters<DragOverEvent>[0]) => {
      const source = event.operation.source
      const target = event.operation.target
      if (!source || !target) return

      const current = layoutStateRef.current
      if (!current.layout) return

      const sourceData = source.data as { panelId: string; groupId: string } | undefined
      const targetData = target.data as { groupId: string; zone: Zone } | undefined
      if (!sourceData || !targetData) return

      const { panelId, groupId: srcGroupId } = sourceData
      const { groupId: tgtGroupId, zone } = targetData

      if (srcGroupId === tgtGroupId && zone === 'center') {
        const group = findGroupById(current.layout, tgtGroupId)
        if (!group) return
        const oldIndex = group.tabs.indexOf(panelId)
        const targetIndex = group.tabs.indexOf(target.id as string)
        if (oldIndex === -1 || targetIndex === -1 || oldIndex === targetIndex) return
        dispatch({
          type: 'reorderTab',
          groupId: tgtGroupId,
          oldIndex,
          newIndex: targetIndex,
        })
      }
    },
    [dispatch],
  )

  // ── File Drop ──────────────────────────────────────────────────────

  const handleFileDrop = useCallback(
    async (file: File, groupId: string | null) => {
      await workspace.runApi((api) => api.fileIO.addFile(file))
      const xml = await workspace.runApi((api) => api.fileIO.readFile(file.name))
      const meiFriendId = await workspace.openMeiFile(file.name, xml)
      if (groupId) {
        dispatch({
          type: 'addPanelToGroup',
          panelType: 'notation',
          groupId,
          meiFriendId,
        })
      } else {
        dispatch({ type: 'openFile', meiFriendId })
      }
    },
    [workspace, dispatch],
  )

  const handleDismissSplash = useCallback(
    (alwaysShow: boolean) => {
      setIsSplashDismissed(true)
      onDismissSplash(alwaysShow)
    },
    [onDismissSplash],
  )

  return (
    <div className="dragContainer">
      {showSplash && !isSplashDismissed && <SplashOverlay onDismiss={handleDismissSplash} />}
      <DragDropProvider
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <main
          className="friendContainer"
          id="friendContainer"
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('Files')) e.preventDefault()
          }}
        >
          <LayoutRenderer
            node={layoutState.layout}
            panels={layoutState.panels}
            draggingInfo={draggingInfo}
            callbacks={{
              onActivate: (panelId, groupId) =>
                dispatch({ type: 'setActiveTab', panelId, groupId }),
              onClose: (panelId, groupId) => dispatch({ type: 'closeTab', panelId, groupId }),
              onFocusGroup: (groupId) => dispatch({ type: 'focusGroup', groupId }),
              onFileDrop: handleFileDrop,
            }}
          />
        </main>
      </DragDropProvider>
    </div>
  )
}
