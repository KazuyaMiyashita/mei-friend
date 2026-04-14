import type { AppMeiFriend } from '../workspace/plugins'
import { type AppMeiFriendState, useMeiFriend } from '../workspace/useMeiFriend'
import { useWorkspace } from '../workspace/WorkspaceProvider'
import { useFocusedPanel } from './useFocusedPanel'

export interface FocusedMeiFriend {
  id: string | null
  state: AppMeiFriendState | null
  instance: AppMeiFriend | null
}

/**
 * Hook that retrieves the state and instance of the focused MeiFriend instance.
 */
export function useFocusedMeiFriend(): FocusedMeiFriend {
  const { focusedPanel } = useFocusedPanel()
  const meiFriendId = focusedPanel?.meiFriendId ?? null
  const workspace = useWorkspace()
  const state = useMeiFriend(meiFriendId)
  const instance = meiFriendId
    ? (workspace.getMeiFriendInstance(meiFriendId) as AppMeiFriend | undefined)
    : null

  return {
    id: meiFriendId,
    state,
    instance: instance ?? null,
  }
}
