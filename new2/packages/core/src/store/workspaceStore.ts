import { createStore } from 'zustand/vanilla'
import type { SliceCreator } from './types'

export interface WorkspaceCoreState {
  name: string
  /** Flat path list (S3 style). null when not loaded. */
  files: readonly string[] | null
  /** IDs of open MeiFriend instances */
  instanceIds: readonly string[]
  /** Whether the workspace name has been changed */
  isNameDirty: boolean
}

export interface WorkspaceCoreActions {
  setName: (name: string) => void
  setFiles: (paths: string[], name?: string) => void
  markAsSaved: () => void
  updateInstanceIds: (ids: string[]) => void
}

export type WorkspaceCoreSlice = WorkspaceCoreState & WorkspaceCoreActions

export const createWorkspaceCoreSlice = (
  // biome-ignore lint/suspicious/noExplicitAny: slice pattern
  set: (partial: any, replace?: boolean) => void,
  get: () => WorkspaceCoreState,
): WorkspaceCoreSlice => ({
  name: 'New Workspace',
  files: null,
  instanceIds: [],
  isNameDirty: false,

  setName: (name: string) => {
    if (get().name === name) return
    set({ name, isNameDirty: true })
  },

  setFiles: (paths: string[], name?: string) => {
    const state = get()
    set({
      files: paths,
      name: name ?? state.name,
      isNameDirty: name ? false : state.isNameDirty,
    })
  },

  markAsSaved: () => {
    set({ isNameDirty: false })
  },

  updateInstanceIds: (ids: string[]) => {
    set({ instanceIds: ids })
  },
})

export function createWorkspaceStore<TSlices>(
  initialState?: Partial<WorkspaceCoreState>,
  // biome-ignore lint/suspicious/noExplicitAny: slice pattern
  sliceCreators: SliceCreator<any>[] = [],
) {
  return createStore<WorkspaceCoreSlice & TSlices>((set, get, api) => {
    // biome-ignore lint/suspicious/noExplicitAny: slice pattern
    const core = createWorkspaceCoreSlice(set as any, get as any)
    const mergedInitialState = { ...core, ...initialState }

    const slices = sliceCreators.reduce((acc, creator) => {
      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      // biome-ignore lint/performance/noAccumulatingSpread: necessary for merging slices
      return { ...acc, ...creator(set as any, get as any, api) }
      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
    }, {} as any)

    return {
      ...mergedInitialState,
      ...slices,
    }
  })
}
