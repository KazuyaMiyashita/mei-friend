import type { MeiFriendPlugins, PluginStateMap } from '@mei-friend/core'
import { useSyncExternalStore } from 'react'
import type { AppMeiFriendPlugins } from './plugins'
import { useWorkspaceContext } from './WorkspaceProvider'

export type AppMeiFriendSnapshot = PluginStateMap<MeiFriendPlugins<AppMeiFriendPlugins>>

export function useMeiFriend(meiFriendId: string | null): AppMeiFriendSnapshot | null {
  const { workspace } = useWorkspaceContext()
  const instance = meiFriendId ? workspace.getMeiFriendInstance(meiFriendId) : undefined
  return useSyncExternalStore(
    instance ? (l: () => void) => instance.subscribe(l) : () => () => {},
    instance ? () => instance.getSnapshot() as AppMeiFriendSnapshot : () => null,
  )
}
