import { useLayoutState } from './LayoutProvider'
import type { PanelInstance } from './types'

export interface UseFocusedPanelReturn {
  focusedPanelId: string | null
  focusedPanel: PanelInstance | null
}

/** Derived hook that returns the focused panel and its ID */
export function useFocusedPanel(): UseFocusedPanelReturn {
  const { focusedPanelId, panels } = useLayoutState()
  const focusedPanel = focusedPanelId ? (panels[focusedPanelId] ?? null) : null
  return { focusedPanelId, focusedPanel }
}
