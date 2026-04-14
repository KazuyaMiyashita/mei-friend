import { definePlugin, type PluginCtx } from './PluginDAG'

export interface WorkspaceCoreState {
  name: string
  /** Flat path list (S3 style). null when not loaded. */
  files: readonly string[] | null
  /** IDs of open MeiFriend instances */
  instanceIds: readonly string[]
  /** Whether the workspace name has been changed */
  isNameDirty: boolean
}

export interface WorkspaceCoreApi {
  setName: (name: string) => void
  setFiles: (paths: string[], name?: string) => void
  markAsSaved: () => void
  updateInstanceIds: (ids: string[]) => void
}

export const workspaceCorePlugin = definePlugin({
  name: 'core' as const,
  deps: [],
  initialState: {
    name: 'New Workspace',
    files: null,
    instanceIds: [],
    isNameDirty: false,
  } as WorkspaceCoreState,

  api: (ctx: PluginCtx<WorkspaceCoreState>): WorkspaceCoreApi => ({
    setName: (name: string) => {
      if (ctx.getState().name === name) return
      ctx.setState({ name, isNameDirty: true })
    },

    setFiles: (paths: string[], name?: string) => {
      const state = ctx.getState()
      ctx.setState({
        files: paths,
        name: name ?? state.name,
        isNameDirty: name ? false : state.isNameDirty,
      })
    },

    markAsSaved: () => {
      ctx.setState({ isNameDirty: false })
    },

    updateInstanceIds: (ids: string[]) => {
      ctx.setState({ instanceIds: ids })
    },
  }),
})
