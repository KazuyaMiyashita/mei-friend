import type { WorkspaceCoreState } from '@mei-friend/core'
import { MeiFriendWorkspace } from '@mei-friend/core'
import type React from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { useApplication } from '../application/useApplication'
import { type AppWorkspace, createAppMeiFriendPlugins, createAppWorkspacePlugins } from './plugins'

// ── Workspace creation ────────────────────────────────────────────────────────

export function createWorkspace(localPersistenceEnabled = false): AppWorkspace {
  const ws = new MeiFriendWorkspace(
    `ws-${Date.now()}`,
    createAppWorkspacePlugins(localPersistenceEnabled),
    createAppMeiFriendPlugins,
  )
  ws.initialize()
  return ws
}

// ── Context ──────────────────────────────────────────────────────────────

interface WorkspaceContextValue {
  workspace: AppWorkspace
  replaceWorkspace: (newWs: AppWorkspace) => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useApplication()
  const [workspace, setWorkspaceState] = useState<AppWorkspace>(() =>
    createWorkspace(settings.workspaceStorageMode === 'local'),
  )
  const workspaceRef = useRef(workspace)
  workspaceRef.current = workspace

  const replaceWorkspace = useCallback((newWs: AppWorkspace) => {
    setWorkspaceState((prev) => {
      prev.destroy()
      return newWs
    })
  }, [])

  // Sync settings with workspace plugin state
  useEffect(() => {
    workspace.runApi((api) =>
      api.localPersistence.setEnabled(settings.workspaceStorageMode === 'local'),
    )
  }, [workspace, settings.workspaceStorageMode])

  // Destroy the latest workspace on unmount
  useEffect(() => {
    return () => {
      workspaceRef.current.destroy()
    }
  }, [])

  return (
    <WorkspaceContext.Provider value={{ workspace, replaceWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

// ── Hooks ────────────────────────────────────────────────────────────────────

export function useWorkspaceContext(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspaceContext must be used within WorkspaceProvider')
  return ctx
}

/** Returns a typed workspace instance */
export function useWorkspace(): AppWorkspace {
  return useWorkspaceContext().workspace
}

/** Subscribes to the workspace's core state */
export function useWorkspaceSnapshot(): WorkspaceCoreState {
  const { workspace } = useWorkspaceContext()
  return useSyncExternalStore(
    (l) => workspace.subscribe(l),
    () => workspace.getSnapshot().core,
  )
}

/** Returns a list of open MeiFriend instance IDs */
export function useMeiFriendIds(): readonly string[] {
  return useWorkspaceSnapshot().instanceIds
}
