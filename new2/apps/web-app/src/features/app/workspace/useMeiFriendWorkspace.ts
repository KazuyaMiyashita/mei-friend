import type { WorkspaceCoreState } from '@mei-friend2/core'
import { useCallback, useSyncExternalStore } from 'react'
import { useApplication } from '../application/useApplication'
import { useLayoutDispatch } from '../layout/LayoutProvider'
import { openFolderInWorkspace } from './openWorkspace'
import type { AppWorkspace } from './plugins'
import { createWorkspace, useWorkspaceContext } from './WorkspaceProvider'

export interface UseMeiFriendWorkspaceReturn {
  workspace: AppWorkspace
  workspaceState: WorkspaceCoreState
  isAnyDirty: () => boolean
  saveMei: (meiFriendId: string) => Promise<void>
  openFile: (path: string, xml: string) => Promise<string>
  openXmlContent: (xml: string, fileName: string, isNewFile?: boolean) => Promise<string>
  closeFile: (meiFriendId: string) => Promise<void>
  openFolder: (askPersistenceMode?: () => Promise<'browser' | 'local' | 'cancel'>) => Promise<void>
}

export function useMeiFriendWorkspace(): UseMeiFriendWorkspaceReturn {
  const { workspace, replaceWorkspace } = useWorkspaceContext()
  const { settings, updateSettings } = useApplication()
  const dispatch = useLayoutDispatch()

  const workspaceState = useSyncExternalStore(
    (l) => workspace.subscribe(l),
    () => workspace.getSnapshot() as unknown as WorkspaceCoreState,
  )

  const saveMei = useCallback(
    async (meiFriendId: string) => {
      const inst = workspace.getMeiFriendInstance(meiFriendId)
      if (!inst) return

      const path = workspace.getMeiFriendPath(meiFriendId)
      const xml = inst.getSnapshot().xmlContent

      let savedLocally = false
      if (path && xml) {
        savedLocally = await workspace.runApi((api) => api.localPersistence.saveFile(path, xml))
      }

      if (savedLocally) {
        await inst.runApi((api) => api.markAsSaved())
      } else {
        await inst.runApi((api) => api.fileIO.saveMei())
      }
    },
    [workspace],
  )

  const openFile = useCallback(
    async (path: string, xml: string) => {
      const meiFriendId = await workspace.openMeiFile(path, xml)
      dispatch({ type: 'openFile', meiFriendId })
      return meiFriendId
    },
    [workspace, dispatch],
  )

  const openXmlContent = useCallback(
    async (xml: string, fileName: string, isNewFile?: boolean) => {
      const meiFriendId = await workspace.openXmlContent(xml, fileName, isNewFile)
      dispatch({ type: 'openFile', meiFriendId })
      return meiFriendId
    },
    [workspace, dispatch],
  )

  const closeFile = useCallback(
    async (meiFriendId: string) => {
      dispatch({ type: 'closeFile', meiFriendId })
      await workspace.closeMeiFriend(meiFriendId)
    },
    [workspace, dispatch],
  )

  const openFolder = useCallback(
    async (askPersistenceMode?: () => Promise<'browser' | 'local' | 'cancel'>) => {
      if (workspace.isAnyDirty()) {
        if (!window.confirm('The current workspace has unsaved changes. Discard them?')) return
      }
      const newWs = createWorkspace(settings.workspaceStorageMode === 'local')
      const success = await openFolderInWorkspace(
        newWs,
        (enabled) => updateSettings({ workspaceStorageMode: enabled ? 'local' : 'browser' }),
        askPersistenceMode,
        settings.workspaceStorageMode,
      )
      if (success) {
        replaceWorkspace(newWs)
      } else {
        newWs.destroy()
      }
    },
    [workspace, replaceWorkspace, settings.workspaceStorageMode, updateSettings],
  )

  return {
    workspace,
    workspaceState,
    isAnyDirty: () => workspace.isAnyDirty(),
    saveMei,
    openFile,
    openXmlContent,
    closeFile,
    openFolder,
  }
}
