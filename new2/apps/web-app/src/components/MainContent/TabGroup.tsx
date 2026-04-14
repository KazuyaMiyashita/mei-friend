import { pointerIntersection } from '@dnd-kit/collision'
import { useDroppable } from '@dnd-kit/react'
import { useSortable } from '@dnd-kit/react/sortable'
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useLayoutDispatch } from '../../features/app/layout/LayoutProvider'
import type { PanelInstance, TabGroupNode, Zone } from '../../features/app/layout/types'
import { useMeiFriend } from '../../features/app/workspace/useMeiFriend'
import AnnotationPanel from '../panels/AnnotationPanel'
import FacsimilePanel from '../panels/FacsimilePanel'
import ImagePanel from '../panels/ImagePanel'
import NotationPanel from '../panels/NotationPanel'
import XMLCodePanel from '../panels/XMLCodePanel'
import ContextMenu, { type ContextMenuItem } from '../ui/ContextMenu'
import './TabGroup.css'

// ── panel content renderer ─────────────────────────────────────────────────

function renderPanelContent(instance: PanelInstance) {
  switch (instance.type) {
    case 'notation':
      return <NotationPanel meiFriendId={instance.meiFriendId} />
    case 'xmlcode':
      return <XMLCodePanel meiFriendId={instance.meiFriendId} />
    case 'annotation':
      return <AnnotationPanel meiFriendId={instance.meiFriendId} />
    case 'facsimile':
      return <FacsimilePanel meiFriendId={instance.meiFriendId} />
    case 'image':
      return instance.imagePath ? (
        <ImagePanel imagePath={instance.imagePath} />
      ) : (
        <div style={{ padding: 16 }}>No image path set.</div>
      )
  }
}

// ── TabLabel ───────────────────────────────────────────────────────────────

function FacsimileTabIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width="12"
      height="12"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
      fill="currentColor"
    >
      <title>Facsimile</title>
      <path d="M5 8.25a.75.75 0 01.75-.75h4a.75.75 0 010 1.5h-4A.75.75 0 015 8.25zM4 10.5A.75.75 0 004 12h4a.75.75 0 000-1.5H4z" />
      <path
        fillRule="evenodd"
        d="M13-.005H3a3 3 0 00-3 3c0 .676.224 1.254.603 1.722.526.65 1.331.783 1.907.783h1.177c-.364.662-.814 1.339-1.287 2.048-.205.309-.414.624-.623.946C.891 9.865 0 11.418 0 13a3 3 0 003 3h10a3 3 0 001.667-5.494.75.75 0 00-.834 1.246A1.5 1.5 0 1111.5 13c0-.642.225-1.347.623-2.136.397-.787.933-1.593 1.501-2.446l.011-.017c.554-.83 1.139-1.709 1.582-2.588.445-.885.783-1.836.783-2.818 0-1.672-1.346-3-3-3zm-10 1.5a1.5 1.5 0 00-1.5 1.5c0 .321.1.569.27.778.097.12.325.227.74.227h7.674A2.737 2.737 0 0110 2.995c0-.546.146-1.059.401-1.5H3zm10 0c.831 0 1.5.662 1.5 1.5 0 .646-.225 1.353-.623 2.143-.398.79-.933 1.595-1.501 2.448l-.017.026c-.552.828-1.134 1.702-1.575 2.576C10.338 11.072 10 12.021 10 13c0 .546.146 1.059.401 1.5H3A1.5 1.5 0 011.5 13c0-1.084.63-2.289 1.537-3.692.177-.274.366-.556.558-.845.632-.948 1.306-1.96 1.773-2.963h6.382a.75.75 0 00.417-1.373c-.444-.298-.667-.656-.667-1.132a1.5 1.5 0 011.5-1.5z"
      />
    </svg>
  )
}

function TabLabel({ instance }: { instance: PanelInstance }) {
  const fileName =
    useMeiFriend(instance.meiFriendId, (s) => s.fileName) ?? instance.meiFriendId ?? '—'
  if (instance.type === 'notation')
    return (
      <>
        <span className="tabTypeIcon">𝄞</span>
        {fileName}
      </>
    )
  if (instance.type === 'xmlcode')
    return (
      <>
        <span className="tabTypeIcon">&lt;/&gt;</span>
        {fileName}
      </>
    )
  if (instance.type === 'annotation') return <>Annotations</>
  if (instance.type === 'facsimile')
    return (
      <>
        <span className="tabTypeIcon">
          <FacsimileTabIcon />
        </span>
        {fileName}
      </>
    )
  if (instance.type === 'image') {
    const imgName = instance.imagePath?.split('/').pop() ?? '—'
    return (
      <>
        <span className="tabTypeIcon">🖼</span>
        {imgName}
      </>
    )
  }
  return <>{instance.type}</>
}

// ── DraggingInfo ───────────────────────────────────────────────────────────

export interface DraggingInfo {
  panelId: string
  sourceGroupId: string
  sourceTabCount: number
}

// ── SortableTab ────────────────────────────────────────────────────────────

interface SortableTabProps {
  panelId: string
  index: number
  groupId: string
  instance: PanelInstance
  isActive: boolean
  onActivate: () => void
  onClose: () => void
  onContextMenu: (e: React.MouseEvent) => void
}

function SortableTab({
  panelId,
  index,
  groupId,
  instance,
  isActive,
  onActivate,
  onClose,
  onContextMenu,
}: SortableTabProps) {
  const isDirty = useMeiFriend(instance.meiFriendId, (s) => s.isDirty) ?? false

  const { ref, isDragging } = useSortable({
    id: panelId,
    index,
    type: 'tab',
    accept: 'tab',
    group: groupId,
    data: { panelId, groupId },
  })

  return (
    // biome-ignore lint/a11y/useSemanticElements: Contains a close button
    <div
      ref={ref}
      className={`tab${isActive ? ' active' : ''}${isDragging ? ' dragging' : ''}${isDirty ? ' dirty' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onActivate()
        }
      }}
      onContextMenu={onContextMenu}
    >
      <span className="tabLabel">
        <TabLabel instance={instance} />
      </span>
      <div className="tabActionArea">
        {isDirty && <span className="dirtyDot">•</span>}
        <button
          type="button"
          className="tabCloseBtn"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          title="Close"
        >
          ×
        </button>
      </div>
    </div>
  )
}

// ── DropZone ───────────────────────────────────────────────────────────────

interface DropZoneProps {
  id: string
  zone: Zone
  groupId: string
  disabled: boolean
}

function DropZone({ id, zone, groupId, disabled }: DropZoneProps) {
  const { ref, isDropTarget } = useDroppable({
    id,
    data: { groupId, zone },
    accept: 'tab',
    collisionDetector: pointerIntersection,
    collisionPriority: zone === 'center' ? 1 : 2,
    disabled,
  })
  return (
    <div
      ref={ref}
      className={`dropZone dropZone-${zone}${isDropTarget && !disabled ? ' active' : ''}`}
    />
  )
}

// ── TabGroup ───────────────────────────────────────────────────────────────

interface TabGroupProps {
  node: TabGroupNode
  panels: Record<string, PanelInstance>
  draggingInfo: DraggingInfo | null
  onActivate: (panelId: string, groupId: string) => void
  onClose: (panelId: string, groupId: string) => void
  onFocusGroup: (groupId: string) => void
  onFileDrop: (file: File, groupId: string) => void
}

export default function TabGroup({
  node,
  panels,
  draggingInfo,
  onActivate,
  onClose,
  onFocusGroup,
  onFileDrop,
}: TabGroupProps) {
  const { id: groupId, tabs, activeTab } = node
  const dispatch = useLayoutDispatch()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; panelId: string } | null>(
    null,
  )

  const { getRootProps, isDragActive: isFileDragging } = useDropzone({
    onDrop: useCallback(
      (files: File[]) => {
        if (files[0]) onFileDrop(files[0], groupId)
      },
      [onFileDrop, groupId],
    ),
    accept: { 'application/xml': ['.mei', '.xml', '.musicxml'] },
    noClick: true,
    noKeyboard: true,
  })

  const handleTabContextMenu = useCallback((e: React.MouseEvent, panelId: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, panelId })
  }, [])

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  const contextMenuItems = useCallback((): ContextMenuItem[] => {
    if (!contextMenu) return []
    const instance = panels[contextMenu.panelId]
    const meiFriendId = instance?.meiFriendId ?? null
    return [
      {
        label: 'Open notation panel',
        disabled: !meiFriendId,
        onClick: () => {
          if (meiFriendId) {
            dispatch({ type: 'addPanelToGroup', panelType: 'notation', groupId, meiFriendId })
          }
        },
      },
      {
        label: 'Open XML code',
        disabled: !meiFriendId,
        onClick: () => {
          if (meiFriendId) {
            dispatch({ type: 'addPanelToGroup', panelType: 'xmlcode', groupId, meiFriendId })
          }
        },
      },
      {
        label: 'Open annotations',
        onClick: () => {
          dispatch({ type: 'addPanelToGroup', panelType: 'annotation', groupId, meiFriendId })
        },
      },
      {
        label: 'Open facsimile',
        onClick: () => {
          dispatch({ type: 'addPanelToGroup', panelType: 'facsimile', groupId, meiFriendId })
        },
      },
      { separator: true },
      {
        label: 'Close tab',
        onClick: () => onClose(contextMenu.panelId, groupId),
      },
    ]
  }, [contextMenu, panels, dispatch, groupId, onClose])

  const isSameGroup = draggingInfo?.sourceGroupId === groupId
  const centerDisabled = isSameGroup ?? false
  const edgeDisabled = isSameGroup ? (draggingInfo?.sourceTabCount ?? 0) <= 1 : false

  const { ref: tabBarRef, isDropTarget: isTabBarTarget } = useDroppable({
    id: `tabbar-${groupId}`,
    data: { groupId, zone: 'center' as Zone },
    accept: 'tab',
    collisionDetector: pointerIntersection,
    collisionPriority: 3,
    disabled: centerDisabled,
  })

  const activeInstance = activeTab ? panels[activeTab] : null

  return (
    <section
      {...getRootProps()}
      className="tabGroup"
      onClick={() => onFocusGroup(groupId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onFocusGroup(groupId)
        }
      }}
      aria-label="Tab Group"
    >
      <div
        ref={tabBarRef}
        className={`tabBar${isTabBarTarget && !centerDisabled ? ' dropTarget' : ''}`}
      >
        {tabs.map((panelId, index) => {
          const instance = panels[panelId]
          if (!instance) return null
          return (
            <SortableTab
              key={panelId}
              panelId={panelId}
              index={index}
              groupId={groupId}
              instance={instance}
              isActive={panelId === activeTab}
              onActivate={() => onActivate(panelId, groupId)}
              onClose={() => onClose(panelId, groupId)}
              onContextMenu={(e) => handleTabContextMenu(e, panelId)}
            />
          )
        })}
      </div>
      <div className={`tabContent${draggingInfo ? ' dragging' : ''}`}>
        {activeInstance ? (
          <div className="panelContent">{renderPanelContent(activeInstance)}</div>
        ) : (
          <div className="emptyPanel">
            <span>Drop a tab here</span>
          </div>
        )}
        <DropZone id={`drop-top-${groupId}`} zone="top" groupId={groupId} disabled={edgeDisabled} />
        <DropZone
          id={`drop-bottom-${groupId}`}
          zone="bottom"
          groupId={groupId}
          disabled={edgeDisabled}
        />
        <DropZone
          id={`drop-left-${groupId}`}
          zone="left"
          groupId={groupId}
          disabled={edgeDisabled}
        />
        <DropZone
          id={`drop-right-${groupId}`}
          zone="right"
          groupId={groupId}
          disabled={edgeDisabled}
        />
        <DropZone
          id={`drop-center-${groupId}`}
          zone="center"
          groupId={groupId}
          disabled={centerDisabled}
        />
      </div>
      {isFileDragging && <div className="fileDropOverlay" />}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems()}
          onClose={closeContextMenu}
        />
      )}
    </section>
  )
}
