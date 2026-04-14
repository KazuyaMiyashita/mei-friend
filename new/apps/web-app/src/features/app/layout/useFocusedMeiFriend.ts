import type { AppMeiFriend } from '../workspace/plugins'
import { type AppMeiFriendSnapshot, useMeiFriend } from '../workspace/useMeiFriend'
import { useWorkspaceContext } from '../workspace/WorkspaceProvider'
import { useFocusedPanel } from './useFocusedPanel'

export interface UseFocusedMeiFriendReturn {
  meiFriendId: string | null
  /** Focused MeiFriend instance (for API calls) */
  instance: AppMeiFriend | null
  /** State snapshot of the focused MeiFriend */
  snapshot: AppMeiFriendSnapshot | null
}

/**
 * Derived hook that returns the MeiFriend instance and snapshot of the focused panel.
 * Returns null if the focused panel is not a MeiFriend panel or if it's the welcome screen.
 */
export function useFocusedMeiFriend(): UseFocusedMeiFriendReturn {
  const { focusedPanel } = useFocusedPanel()
  const meiFriendId = focusedPanel?.meiFriendId ?? null
  const { workspace } = useWorkspaceContext()
  const snapshot = useMeiFriend(meiFriendId)
  const instance = meiFriendId
    ? ((workspace.getMeiFriendInstance(meiFriendId) as AppMeiFriend | undefined) ?? null)
    : null

  return { meiFriendId, instance, snapshot }
}
