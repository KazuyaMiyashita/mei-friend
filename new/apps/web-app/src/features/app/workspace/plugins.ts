import type { MeiFriend, MeiFriendWorkspace } from '@mei-friend/core'
import {
  annotationPlugin,
  facsimilePlugin,
  fileIOPlugin,
  historyPlugin,
  meiEditorPlugin,
  selectionPlugin,
  verovioPlugin,
  workspaceFileIOPlugin,
  workspaceLocalPersistencePlugin,
} from '@mei-friend/plugins'

// ── Plugin definitions (pure: no React dependency) ──────────────────────────────────

export const createAppWorkspacePlugins = (initialEnabled = false) => {
  const fileIO = workspaceFileIOPlugin()
  return [fileIO, workspaceLocalPersistencePlugin(fileIO, initialEnabled)] as const
}

export const createAppMeiFriendPlugins = () =>
  [
    verovioPlugin(),
    selectionPlugin(),
    meiEditorPlugin(),
    fileIOPlugin(),
    historyPlugin(),
    facsimilePlugin(),
    annotationPlugin(),
  ] as const

export type AppWorkspacePlugins = ReturnType<typeof createAppWorkspacePlugins>
export type AppMeiFriendPlugins = ReturnType<typeof createAppMeiFriendPlugins>

export type AppWorkspace = MeiFriendWorkspace<AppWorkspacePlugins, AppMeiFriendPlugins>
export type AppMeiFriend = MeiFriend<AppMeiFriendPlugins>
