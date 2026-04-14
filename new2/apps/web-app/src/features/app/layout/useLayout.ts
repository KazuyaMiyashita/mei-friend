import { useCallback } from 'react'
import {
  type LayoutAction,
  type SidebarPanel,
  useLayoutDispatch,
  useLayoutSidebar,
  useLayoutState,
} from './LayoutProvider'
import { findGroupForPanel } from './layoutUtils'
import type { LayoutState, PanelType } from './types'

export interface UseLayoutReturn {
  layoutState: LayoutState
  dispatch: React.Dispatch<LayoutAction>
  // File operations
  openFileInLayout: (meiFriendId: string) => void
  closeFileFromLayout: (meiFriendId: string) => void
  openImageInLayout: (imagePath: string) => void
  // Panel operations
  openPanel: (
    type: PanelType,
    groupId: string,
    meiFriendId?: string | null,
    imagePath?: string,
  ) => void
  closePanel: (panelId: string, groupId: string) => void
  focusPanel: (panelId: string) => void
  setActiveTab: (panelId: string, groupId: string) => void
  focusGroup: (groupId: string) => void
  splitGroup: (
    panelId: string,
    srcGroupId: string,
    tgtGroupId: string,
    direction: 'horizontal' | 'vertical',
    insertBefore: boolean,
  ) => void
  moveTab: (panelId: string, srcGroupId: string, tgtGroupId: string, targetIndex?: number) => void
  reorderTab: (groupId: string, oldIndex: number, newIndex: number) => void
  // Sidebar
  activeSidebar: SidebarPanel | null
  setActiveSidebar: (panel: SidebarPanel | null) => void
}

export function useLayout(): UseLayoutReturn {
  const layoutState = useLayoutState()
  const dispatch = useLayoutDispatch()
  const { activeSidebar, setActiveSidebar } = useLayoutSidebar()

  const openFileInLayout = useCallback(
    (meiFriendId: string) => dispatch({ type: 'openFile', meiFriendId }),
    [dispatch],
  )

  const closeFileFromLayout = useCallback(
    (meiFriendId: string) => dispatch({ type: 'closeFile', meiFriendId }),
    [dispatch],
  )

  const openImageInLayout = useCallback(
    (imagePath: string) => dispatch({ type: 'openImage', imagePath }),
    [dispatch],
  )

  const openPanel = useCallback(
    (type: PanelType, groupId: string, meiFriendId?: string | null, imagePath?: string) =>
      dispatch({ type: 'addPanelToGroup', panelType: type, groupId, meiFriendId, imagePath }),
    [dispatch],
  )

  const closePanel = useCallback(
    (panelId: string, groupId: string) => dispatch({ type: 'closeTab', panelId, groupId }),
    [dispatch],
  )

  const focusPanel = useCallback(
    (panelId: string) => {
      if (!layoutState.layout) return
      const group = findGroupForPanel(layoutState.layout, panelId)
      if (group) dispatch({ type: 'setActiveTab', panelId, groupId: group.id })
    },
    [dispatch, layoutState.layout],
  )

  const setActiveTab = useCallback(
    (panelId: string, groupId: string) => dispatch({ type: 'setActiveTab', panelId, groupId }),
    [dispatch],
  )

  const focusGroupFn = useCallback(
    (groupId: string) => dispatch({ type: 'focusGroup', groupId }),
    [dispatch],
  )

  const splitGroupFn = useCallback(
    (
      panelId: string,
      srcGroupId: string,
      tgtGroupId: string,
      direction: 'horizontal' | 'vertical',
      insertBefore: boolean,
    ) => dispatch({ type: 'splitGroup', panelId, srcGroupId, tgtGroupId, direction, insertBefore }),
    [dispatch],
  )

  const moveTab = useCallback(
    (panelId: string, srcGroupId: string, tgtGroupId: string, targetIndex?: number) =>
      dispatch({ type: 'moveTab', panelId, srcGroupId, tgtGroupId, targetIndex }),
    [dispatch],
  )

  const reorderTab = useCallback(
    (groupId: string, oldIndex: number, newIndex: number) =>
      dispatch({ type: 'reorderTab', groupId, oldIndex, newIndex }),
    [dispatch],
  )

  return {
    layoutState,
    dispatch,
    openFileInLayout,
    closeFileFromLayout,
    openImageInLayout,
    openPanel,
    closePanel,
    focusPanel,
    setActiveTab,
    focusGroup: focusGroupFn,
    splitGroup: splitGroupFn,
    moveTab,
    reorderTab,
    activeSidebar,
    setActiveSidebar,
  }
}
