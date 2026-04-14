import { createContext, type ReactNode, useContext, useReducer, useState } from 'react'
import {
  addPanelToGroup,
  closeTab,
  findGroupById,
  findGroupForPanel,
  focusGroup,
  getFocusedGroup,
  getFocusedMeiFriendId,
  moveTabToGroup,
  removeFileFromLayout,
  reorderTabInGroup,
  setActiveTab,
  splitGroup,
} from './layoutUtils'
import type { LayoutState, PanelType, TabGroupNode } from './types'

// ── action types ─────────────────────────────────────────────────────────────

export type LayoutAction =
  | { type: 'setActiveTab'; panelId: string; groupId: string }
  | { type: 'focusGroup'; groupId: string }
  | { type: 'closeTab'; panelId: string; groupId: string }
  | {
      type: 'addPanelToGroup'
      panelType: PanelType
      groupId: string
      meiFriendId?: string | null
      imagePath?: string
    }
  | { type: 'openFile'; meiFriendId: string }
  | { type: 'closeFile'; meiFriendId: string }
  | { type: 'openImage'; imagePath: string }
  | { type: 'reorderTab'; groupId: string; oldIndex: number; newIndex: number }
  | {
      type: 'moveTab'
      panelId: string
      srcGroupId: string
      tgtGroupId: string
      targetIndex?: number
    }
  | {
      type: 'splitGroup'
      panelId: string
      srcGroupId: string
      tgtGroupId: string
      direction: 'horizontal' | 'vertical'
      insertBefore: boolean
    }

// ── sidebar ───────────────────────────────────────────────────────────────────

export type SidebarPanel = 'workspace' | 'notation' | 'settings'

export interface SidebarState {
  activeSidebar: SidebarPanel | null
  setActiveSidebar: (panel: SidebarPanel | null) => void
}

// ── initial state ─────────────────────────────────────────────────────────────

const INITIAL_LAYOUT_STATE: LayoutState = {
  panels: {},
  layout: null,
  focusedPanelId: null,
}

// ── reducer ───────────────────────────────────────────────────────────────────

function layoutReducer(state: LayoutState, action: LayoutAction): LayoutState {
  switch (action.type) {
    case 'setActiveTab':
      if (!state.layout) return state
      return setActiveTab(state, action.panelId, action.groupId)

    case 'focusGroup':
      if (!state.layout) return state
      return focusGroup(state, action.groupId)

    case 'closeTab':
      return closeTab(state, action.panelId, action.groupId)

    case 'addPanelToGroup': {
      if (!state.layout) return state
      const group = findGroupById(state.layout, action.groupId)
      if (group) {
        const mfId = action.meiFriendId ?? null
        const existing = group.tabs.find((tabId: string) => {
          const p = state.panels[tabId]
          if (p?.type !== action.panelType) return false
          if (action.panelType === 'image') return p.imagePath === action.imagePath
          return p.meiFriendId === mfId
        })
        if (existing) return setActiveTab(state, existing, action.groupId)
      }
      return addPanelToGroup(
        state,
        action.panelType,
        action.groupId,
        action.meiFriendId ?? null,
        action.imagePath,
      )
    }

    case 'openFile': {
      const { meiFriendId } = action
      if (state.layout === null) {
        const groupId = `group-${Math.random().toString(36).slice(2, 9)}`
        const panelId = `notation-1`
        const newGroup: TabGroupNode = {
          type: 'tabgroup',
          id: groupId,
          tabs: [panelId],
          activeTab: panelId,
        }
        return {
          panels: { [panelId]: { id: panelId, type: 'notation', meiFriendId } },
          layout: newGroup,
          focusedPanelId: panelId,
        }
      } else {
        const existingPanels = Object.values(state.panels).filter(
          (p) => p.meiFriendId === meiFriendId,
        )
        if (existingPanels.length > 0) {
          const targetPanel = existingPanels.find((p) => p.type === 'notation') ?? existingPanels[0]
          const targetGroup = findGroupForPanel(state.layout, targetPanel.id)
          if (targetGroup) {
            return setActiveTab(state, targetPanel.id, targetGroup.id)
          }
        }

        const focusedGrp = getFocusedGroup(state)
        const groupId = focusedGrp?.id
        if (!groupId) return state
        return addPanelToGroup(state, 'notation', groupId, meiFriendId)
      }
    }

    case 'closeFile':
      return removeFileFromLayout(state, action.meiFriendId)

    case 'openImage': {
      const { imagePath } = action
      if (state.layout) {
        const existingPanel = Object.values(state.panels).find(
          (p) => p.type === 'image' && p.imagePath === imagePath,
        )
        if (existingPanel) {
          const targetGroup = findGroupForPanel(state.layout, existingPanel.id)
          if (targetGroup) return setActiveTab(state, existingPanel.id, targetGroup.id)
        }
      }

      if (state.layout === null) {
        const groupId = `group-${Math.random().toString(36).slice(2, 9)}`
        const panelId = 'image-1'
        const newGroup: TabGroupNode = {
          type: 'tabgroup',
          id: groupId,
          tabs: [panelId],
          activeTab: panelId,
        }
        return {
          panels: { [panelId]: { id: panelId, type: 'image', meiFriendId: null, imagePath } },
          layout: newGroup,
          focusedPanelId: panelId,
        }
      }

      const focusedGrp = getFocusedGroup(state)
      const groupId = focusedGrp?.id
      if (!groupId) return state
      return addPanelToGroup(state, 'image', groupId, null, imagePath)
    }

    case 'reorderTab':
      if (!state.layout) return state
      return reorderTabInGroup(state, action.groupId, action.oldIndex, action.newIndex)

    case 'moveTab':
      if (!state.layout) return state
      return moveTabToGroup(
        state,
        action.panelId,
        action.srcGroupId,
        action.tgtGroupId,
        action.targetIndex,
      )

    case 'splitGroup':
      if (!state.layout) return state
      return splitGroup(
        state,
        action.panelId,
        action.srcGroupId,
        action.tgtGroupId,
        action.direction,
        action.insertBefore,
      )

    default:
      return state
  }
}

// ── contexts ──────────────────────────────────────────────────────────────────

const LayoutStateContext = createContext<LayoutState>(INITIAL_LAYOUT_STATE)
const LayoutDispatchContext = createContext<React.Dispatch<LayoutAction>>(() => {})
const LayoutSidebarContext = createContext<SidebarState>({
  activeSidebar: 'workspace',
  setActiveSidebar: () => {},
})

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(layoutReducer, INITIAL_LAYOUT_STATE)
  const [activeSidebar, setActiveSidebar] = useState<SidebarPanel | null>('workspace')

  return (
    <LayoutStateContext.Provider value={state}>
      <LayoutDispatchContext.Provider value={dispatch}>
        <LayoutSidebarContext.Provider value={{ activeSidebar, setActiveSidebar }}>
          {children}
        </LayoutSidebarContext.Provider>
      </LayoutDispatchContext.Provider>
    </LayoutStateContext.Provider>
  )
}

// ── hooks ─────────────────────────────────────────────────────────────────────

export function useLayoutState(): LayoutState {
  return useContext(LayoutStateContext)
}

export function useLayoutDispatch(): React.Dispatch<LayoutAction> {
  return useContext(LayoutDispatchContext)
}

export function useLayoutSidebar(): SidebarState {
  return useContext(LayoutSidebarContext)
}

/** Returns the focused group (null if layout is null) */
export function useFocusedGroup() {
  const state = useLayoutState()
  return getFocusedGroup(state)
}

/** Returns the meiFriendId associated with the focused panel */
export function useFocusedMeiFriendId(): string | null {
  const state = useLayoutState()
  return getFocusedMeiFriendId(state)
}
