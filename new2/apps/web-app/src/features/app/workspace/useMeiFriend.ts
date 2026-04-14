import type { CoreSlice } from '@mei-friend2/core'
import { useSyncExternalStore } from 'react'
import type { AppMeiFriendSlices } from './plugins'
import { useWorkspaceContext } from './WorkspaceProvider'

export type AppMeiFriendState = AppMeiFriendSlices & CoreSlice

/**
 * Hook to access a specific MeiFriend instance's state.
 * Supports an optional selector for fine-grained re-renders.
 */
export function useMeiFriend<T = AppMeiFriendState>(
  meiFriendId: string | null,
  selector: (state: AppMeiFriendState) => T = (s) => s as unknown as T,
): T | null {
  const { workspace } = useWorkspaceContext()
  const instance = meiFriendId ? workspace.getMeiFriendInstance(meiFriendId) : undefined

  return useSyncExternalStore(
    instance ? (l: () => void) => instance.subscribe(l) : () => () => {},
    instance
      ? () => selector(instance.getSnapshot() as AppMeiFriendState)
      : () => null as unknown as T,
  )
}
