import type {
  LayoutNode,
  LayoutState,
  PanelInstance,
  PanelType,
  SplitNode,
  TabGroupNode,
} from './types'

// ── helpers ────────────────────────────────────────────────────────────────

/**
 * Recursively walks the tree and transforms each TabGroupNode.
 * If fn returns null, the node is removed.
 * If fn returns a LayoutNode (SplitNode is also allowed), it is replaced as is.
 */
function mapLayout(
  node: LayoutNode,
  fn: (n: TabGroupNode) => LayoutNode | null,
): LayoutNode | null {
  if (node.type === 'tabgroup') {
    return fn(node)
  }
  const newChildren: LayoutNode[] = []
  for (const child of node.children) {
    const mapped = mapLayout(child, fn)
    if (mapped !== null) newChildren.push(mapped)
  }
  if (newChildren.length === 0) return null
  if (newChildren.length === 1) return newChildren[0]
  return { ...node, children: newChildren }
}

/**
 * Removes empty TabGroupNodes (tabs: []) from SplitNode,
 * and replaces SplitNodes with a single child with that child.
 * Returns null if the root becomes empty.
 */
function pruneEmptyGroups(node: LayoutNode): LayoutNode | null {
  if (node.type === 'tabgroup') {
    return node.tabs.length === 0 ? null : node
  }
  const newChildren: LayoutNode[] = []
  for (const child of node.children) {
    const pruned = pruneEmptyGroups(child)
    if (pruned !== null) newChildren.push(pruned)
  }
  if (newChildren.length === 0) return null
  if (newChildren.length === 1) return newChildren[0]
  return { ...node, children: newChildren }
}

function uniqueId(): string {
  return `group-${Math.random().toString(36).slice(2, 9)}`
}

export function findGroupById(node: LayoutNode, id: string): TabGroupNode | null {
  if (node.type === 'tabgroup') return node.id === id ? node : null
  for (const child of node.children) {
    const found = findGroupById(child, id)
    if (found) return found
  }
  return null
}

// ── public helpers ─────────────────────────────────────────────────────────

/** Returns the TabGroupNode containing the panel instance ID */
export function findGroupForPanel(node: LayoutNode, panelId: string): TabGroupNode | null {
  if (node.type === 'tabgroup') return node.tabs.includes(panelId) ? node : null
  for (const child of node.children) {
    const found = findGroupForPanel(child, panelId)
    if (found) return found
  }
  return null
}

/** Returns the first TabGroupNode in the tree (for fallback) */
export function findFirstGroup(node: LayoutNode): TabGroupNode | null {
  if (node.type === 'tabgroup') return node
  for (const child of node.children) {
    const found = findFirstGroup(child)
    if (found) return found
  }
  return null
}

/**
 * Returns the TabGroupNode that the currently focused tab belongs to.
 * Returns the first group in the tree if focusedPanelId is invalid.
 */
export function getFocusedGroup(state: LayoutState): TabGroupNode | null {
  if (!state.layout) return null
  if (state.focusedPanelId) {
    const group = findGroupForPanel(state.layout, state.focusedPanelId)
    if (group) return group
  }
  return findFirstGroup(state.layout)
}

/** Returns the meiFriendId associated with the focused panel */
export function getFocusedMeiFriendId(state: LayoutState): string | null {
  if (!state.focusedPanelId) return null
  return state.panels[state.focusedPanelId]?.meiFriendId ?? null
}

// ── public API ─────────────────────────────────────────────────────────────

/** Changes the active tab (also updates the focused panel) */
export function setActiveTab(state: LayoutState, panelId: string, groupId: string): LayoutState {
  if (!state.layout) return state
  const layout =
    mapLayout(state.layout, (g) => (g.id === groupId ? { ...g, activeTab: panelId } : g)) ??
    state.layout
  return { ...state, layout, focusedPanelId: panelId }
}

/** Changes the focused group (does not change the tab). Records activeTab as the focused panel. */
export function focusGroup(state: LayoutState, groupId: string): LayoutState {
  if (!state.layout) return state
  const group = findGroupById(state.layout, groupId)
  const focusedPanelId = group?.activeTab ?? state.focusedPanelId
  return { ...state, focusedPanelId }
}

/**
 * Closes a tab.
 * If the group becomes empty, it is removed from the SplitNode, and the SplitNode is dismantled if necessary.
 * If all tabs are closed and the root becomes empty, layout: null (welcome screen) is returned.
 */
export function closeTab(state: LayoutState, panelId: string, groupId: string): LayoutState {
  if (!state.layout) return state

  // 1. Remove tab
  const withTabRemoved =
    mapLayout(state.layout, (g) => {
      if (g.id !== groupId) return g
      const tabs = g.tabs.filter((t) => t !== panelId)
      const activeTab = g.activeTab === panelId ? (tabs[tabs.length - 1] ?? null) : g.activeTab
      return { ...g, tabs, activeTab }
    }) ?? state.layout

  // 2. Remove empty group from SplitNode
  const pruned = pruneEmptyGroups(withTabRemoved)

  // 3. Go to null (welcome screen) if the root is empty
  const layout: LayoutNode | null = pruned ?? null

  const panels = { ...state.panels }
  delete panels[panelId]

  // If the closed tab was focused, move the focus to the new active tab
  let focusedPanelId = state.focusedPanelId
  if (focusedPanelId === panelId) {
    focusedPanelId = layout
      ? (findGroupById(layout, groupId)?.activeTab ?? findFirstGroup(layout)?.activeTab ?? null)
      : null
  }

  return { panels, layout, focusedPanelId }
}

/** Reorder tabs within a group */
export function reorderTabInGroup(
  state: LayoutState,
  groupId: string,
  oldIndex: number,
  newIndex: number,
): LayoutState {
  if (!state.layout) return state
  const layout =
    mapLayout(state.layout, (g) => {
      if (g.id !== groupId) return g
      const tabs = [...g.tabs]
      const [moved] = tabs.splice(oldIndex, 1)
      tabs.splice(newIndex, 0, moved)
      return { ...g, tabs }
    }) ?? state.layout
  return { ...state, layout }
}

/** Move a tab to the tab bar of another group (center drop / tab bar drop) */
export function moveTabToGroup(
  state: LayoutState,
  panelId: string,
  sourceGroupId: string,
  targetGroupId: string,
  targetIndex?: number,
): LayoutState {
  if (!state.layout) return state
  if (sourceGroupId === targetGroupId) return state

  const moved =
    mapLayout(state.layout, (g) => {
      if (g.id === sourceGroupId) {
        const tabs = g.tabs.filter((t) => t !== panelId)
        const activeTab = g.activeTab === panelId ? (tabs[0] ?? null) : g.activeTab
        return { ...g, tabs, activeTab }
      }
      if (g.id === targetGroupId) {
        const tabs = [...g.tabs]
        const insertAt = targetIndex !== undefined ? targetIndex : tabs.length
        tabs.splice(insertAt, 0, panelId)
        return { ...g, tabs, activeTab: panelId }
      }
      return g
    }) ?? state.layout
  const pruned = pruneEmptyGroups(moved)
  const layout: LayoutNode = pruned ?? {
    type: 'tabgroup',
    id: targetGroupId,
    tabs: [panelId],
    activeTab: panelId,
  }
  return { ...state, layout, focusedPanelId: panelId }
}

/** Split a group and move the tab to a new group (edge drop) */
export function splitGroup(
  state: LayoutState,
  panelId: string,
  sourceGroupId: string,
  targetGroupId: string,
  direction: 'horizontal' | 'vertical',
  insertBefore: boolean,
): LayoutState {
  if (!state.layout) return state
  // Do not split if it's the same group and there's only one tab (it would just create an empty group)
  if (sourceGroupId === targetGroupId) {
    const sourceGroup = findGroupById(state.layout, sourceGroupId)
    if (!sourceGroup || sourceGroup.tabs.length <= 1) return state
  }

  let updatedLayout =
    mapLayout(state.layout, (g) => {
      if (g.id !== sourceGroupId) return g
      const tabs = g.tabs.filter((t) => t !== panelId)
      const activeTab = g.activeTab === panelId ? (tabs[0] ?? null) : g.activeTab
      return { ...g, tabs, activeTab }
    }) ?? state.layout

  // Remove the source group if it becomes empty
  updatedLayout = pruneEmptyGroups(updatedLayout) ?? updatedLayout

  const newGroup: TabGroupNode = {
    type: 'tabgroup',
    id: uniqueId(),
    tabs: [panelId],
    activeTab: panelId,
  }

  updatedLayout =
    mapLayout(updatedLayout, (g) => {
      if (g.id !== targetGroupId) return g
      const splitNode: SplitNode = {
        type: 'split',
        direction,
        children: insertBefore ? [newGroup, g] : [g, newGroup],
      }
      return splitNode
    }) ?? updatedLayout

  return { ...state, layout: updatedLayout, focusedPanelId: panelId }
}

/**
 * Removes all panels associated with the specified meiFriendId from the layout.
 * If all panels are removed and the layout becomes empty, layout: null is returned.
 */
export function removeFileFromLayout(state: LayoutState, meiFriendId: string): LayoutState {
  if (!state.layout) return state
  const removedIds = new Set(
    Object.values(state.panels)
      .filter((p) => p.meiFriendId === meiFriendId)
      .map((p) => p.id),
  )
  if (removedIds.size === 0) return state

  // Remove tabs
  const withTabsRemoved =
    mapLayout(state.layout, (g) => {
      const tabs = g.tabs.filter((t) => !removedIds.has(t))
      const activeTab = removedIds.has(g.activeTab ?? '')
        ? (tabs[tabs.length - 1] ?? null)
        : g.activeTab
      return { ...g, tabs, activeTab }
    }) ?? state.layout

  const pruned = pruneEmptyGroups(withTabsRemoved)
  const panels = Object.fromEntries(
    Object.entries(state.panels).filter(([, p]) => p.meiFriendId !== meiFriendId),
  )
  const focusedPanelId = removedIds.has(state.focusedPanelId ?? '')
    ? pruned
      ? (findFirstGroup(pruned)?.activeTab ?? null)
      : null
    : state.focusedPanelId

  return { panels, layout: pruned ?? null, focusedPanelId }
}

/** Adds a panel to the focused group */
export function addPanelToGroup(
  state: LayoutState,
  type: PanelType,
  groupId: string,
  meiFriendId: string | null = null,
  imagePath?: string,
): LayoutState {
  if (!state.layout) return state
  const existingCount = Object.values(state.panels).filter((p) => p.type === type).length
  const newId = `${type}-${existingCount + 1}`
  const newPanel: PanelInstance = {
    id: newId,
    type,
    meiFriendId,
    ...(imagePath !== undefined ? { imagePath } : {}),
  }
  const panels = { ...state.panels, [newId]: newPanel }

  const layout =
    mapLayout(state.layout, (g) => {
      if (g.id !== groupId) return g
      return { ...g, tabs: [...g.tabs, newId], activeTab: newId }
    }) ?? state.layout

  return { panels, layout, focusedPanelId: newId }
}
