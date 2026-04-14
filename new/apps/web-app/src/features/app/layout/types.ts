export type PanelType = 'notation' | 'xmlcode' | 'annotation' | 'facsimile' | 'image'

export type Zone = 'top' | 'bottom' | 'left' | 'right' | 'center'

export interface PanelInstance {
  id: string // e.g. 'notation-1', 'xmlcode-1'
  type: PanelType
  meiFriendId: string | null // null = file not open / image panel is always null
  /** image panel only: relative path in the workspace */
  imagePath?: string
}

export interface SplitNode {
  type: 'split'
  direction: 'horizontal' | 'vertical'
  children: LayoutNode[] // always 2+
}

export interface TabGroupNode {
  type: 'tabgroup'
  id: string
  tabs: string[] // PanelInstance id refs (empty array allowed)
  activeTab: string | null
}

export type LayoutNode = SplitNode | TabGroupNode

export interface LayoutState {
  panels: Record<string, PanelInstance>
  /** null = display welcome screen */
  layout: LayoutNode | null
  /** ID of the currently focused panel instance. More stable than group ID. */
  focusedPanelId: string | null
}
