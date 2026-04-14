import type { CoreSlice, MeiFriend, MeiFriendWorkspace, ServiceCreator } from '@mei-friend2/core'
import {
  AnnotationService,
  type AnnotationSlice,
  createAnnotationSlice,
  createFacsimileSlice,
  createFileIOSlice,
  createHistorySlice,
  createMeiEditorSlice,
  createSelectionSlice,
  createVerovioSlice,
  createWorkspaceFileIOSlice,
  createWorkspaceLocalPersistenceSlice,
  FacsimileService,
  type FacsimileSlice,
  type FileIOSlice,
  HistoryService,
  type HistorySlice,
  type MeiEditorSlice,
  type SelectionSlice,
  VerovioService,
  type VerovioSlice,
  type WorkspaceFileIOSlice,
  type WorkspaceLocalPersistenceSlice,
} from '@mei-friend2/plugins'
import type { StoreApi } from 'zustand/vanilla'

// ── Slice definitions (pure: no React dependency) ──────────────────────────────────

export const createAppWorkspaceSlices = (initialEnabled = false) => [
  createWorkspaceFileIOSlice,
  createWorkspaceLocalPersistenceSlice(initialEnabled),
]

export const createAppMeiFriendSlices = () => [
  createVerovioSlice,
  createSelectionSlice,
  createMeiEditorSlice,
  createFileIOSlice,
  createHistorySlice(100),
  createFacsimileSlice,
  createAnnotationSlice,
]

export const createAppMeiFriendServices = () =>
  [
    (store: StoreApi<CoreSlice & AppMeiFriendSlices>) => new VerovioService(store),
    (store: StoreApi<CoreSlice & AppMeiFriendSlices>) => new HistoryService(store),
    (store: StoreApi<CoreSlice & AppMeiFriendSlices>) => new FacsimileService(store),
    (store: StoreApi<CoreSlice & AppMeiFriendSlices>) => new AnnotationService(store),
  ] as ServiceCreator<AppMeiFriendSlices>[]

export type AppWorkspaceSlices = WorkspaceFileIOSlice & WorkspaceLocalPersistenceSlice

export type AppMeiFriendSlices = VerovioSlice &
  SelectionSlice &
  MeiEditorSlice &
  FileIOSlice &
  HistorySlice &
  FacsimileSlice &
  AnnotationSlice

export type AppWorkspace = MeiFriendWorkspace<AppWorkspaceSlices, AppMeiFriendSlices>
export type AppMeiFriend = MeiFriend<AppMeiFriendSlices>
