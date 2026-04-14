import type { SliceCreator } from '@mei-friend2/core'
import type { WorkspaceFileIOSlice } from './workspaceFileIOSlice'

export interface WorkspaceLocalPersistenceState {
  enabled: boolean
}

export interface WorkspaceLocalPersistenceActions {
  setEnabled: (enabled: boolean) => void
  saveFile: (path: string, content: string | ArrayBuffer) => Promise<boolean>
  saveWorkspaceConfig: () => Promise<boolean>
}

export type WorkspaceLocalPersistenceSlice = {
  localPersistence: WorkspaceLocalPersistenceState & WorkspaceLocalPersistenceActions
}

export const createWorkspaceLocalPersistenceSlice =
  (initialEnabled = false): SliceCreator<WorkspaceLocalPersistenceSlice> =>
  (set, get) => ({
    localPersistence: {
      enabled: initialEnabled,

      setEnabled: (enabled: boolean) => {
        // biome-ignore lint/suspicious/noExplicitAny: slice pattern
        set((state: any) => ({
          localPersistence: { ...state.localPersistence, enabled },
        }))
      },

      saveFile: async (path, content) => {
        const state = get() as WorkspaceLocalPersistenceSlice & WorkspaceFileIOSlice
        if (!state.localPersistence.enabled) return false

        const handle = state.fileIO.getFileHandle(path)
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
        const state = get() as WorkspaceLocalPersistenceSlice &
          WorkspaceFileIOSlice & { name: string }
        if (!state.localPersistence.enabled) return false

        const { name } = state
        const { directoryHandle } = state.fileIO

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
    },
  })
