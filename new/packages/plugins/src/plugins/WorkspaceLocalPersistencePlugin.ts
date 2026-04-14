import { definePlugin, workspaceCorePlugin } from '@mei-friend/core'
import { workspaceFileIOPlugin } from './WorkspaceFileIOPlugin'

export interface WorkspaceLocalPersistenceState {
  enabled: boolean
}

export interface WorkspaceLocalPersistenceApi {
  isEnabled: () => boolean
  setEnabled: (enabled: boolean) => void
  /**
   * Saves content to a file in the workspace if persistence is enabled and
   * the file was loaded from a FileSystemFileHandle.
   */
  saveFile: (path: string, content: string | ArrayBuffer) => Promise<boolean>
  /**
   * Saves the workspace configuration (name) to mf-workspace.json.
   */
  saveWorkspaceConfig: () => Promise<boolean>
}

export const workspaceLocalPersistencePlugin = (
  fileIO = workspaceFileIOPlugin(),
  initialEnabled = false,
) =>
  definePlugin({
    name: 'localPersistence' as const,
    deps: [workspaceCorePlugin, fileIO] as const,
    initialState: {
      enabled: initialEnabled,
    },
    api: (ctx): WorkspaceLocalPersistenceApi => ({
      isEnabled: () => ctx.getState().enabled,
      setEnabled: (enabled: boolean) => {
        ctx.setState({ enabled })
      },

      saveFile: async (path, content) => {
        if (!ctx.getState().enabled) return false

        const handle = ctx.depApi.fileIO.getFileHandle(path)
        if (handle) {
          try {
            const writable = await handle.createWritable()
            await writable.write(content)
            await writable.close()
            return true
          } catch (err) {
            console.error(`Failed to save file ${path}:`, err)
            return false
          }
        }
        return false
      },

      saveWorkspaceConfig: async () => {
        if (!ctx.getState().enabled) return false

        const { name } = ctx.depState.core
        const { directoryHandle } = ctx.depState.fileIO

        if (!directoryHandle) return false

        try {
          const handle = await directoryHandle.getFileHandle('mf-workspace.json', { create: true })
          const content = JSON.stringify({ name }, null, 2)
          const writable = await handle.createWritable()
          await writable.write(content)
          await writable.close()
          return true
        } catch (err) {
          console.error('Failed to save workspace config:', err)
          return false
        }
      },
    }),
  })
