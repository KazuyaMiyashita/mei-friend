import { MeiFriend } from './MeiFriend'
import { type AnyPluginDef, type PluginApiMap, PluginDAG, type PluginStateMap } from './PluginDAG'
import { workspaceCorePlugin } from './WorkspaceCorePlugin'

// ── WorkspaceTypes ────────────────────────────────────────────────────────────

/** File types (used in Explorer view) */
export type WorkspaceFileKind = 'mei' | 'image' | 'annotation' | 'other'

/**
 * Utility for resolving relative paths in the workspace.
 */
export function resolveWorkspacePath(basePath: string, relative: string): string {
  if (/^https?:\/\//.test(relative)) return relative
  const baseDir = basePath.includes('/') ? basePath.split('/').slice(0, -1).join('/') : ''
  return new URL(relative, `x:/${baseDir ? `${baseDir}/` : ''}`).pathname.replace(/^\//, '')
}

/** Determines file type from name */
export function classifyWorkspaceFile(name: string): WorkspaceFileKind {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['mei', 'xml', 'musicxml'].includes(ext)) return 'mei'
  if (['png', 'jpg', 'jpeg', 'tif', 'tiff', 'svg', 'gif', 'webp'].includes(ext)) return 'image'
  if (ext === 'json') return 'annotation'
  return 'other'
}

// ── MfWorkspaceJson ───────────────────────────────────────────────────────────

export interface MfWorkspaceConfig {
  name?: string
}

export function parseMfWorkspaceJson(text: string): MfWorkspaceConfig {
  try {
    const data = JSON.parse(text)
    return {
      name: typeof data.name === 'string' ? data.name : undefined,
    }
  } catch {
    return {}
  }
}

// ── MeiFriendWorkspace ────────────────────────────────────────────────────────

export type WorkspacePlugins<T extends readonly AnyPluginDef[]> = readonly [
  typeof workspaceCorePlugin,
  ...T,
]

/**
 * MeiFriendWorkspace handles a series of musical scores and resources.
 * Uses a type-safe DAG-based plugin system.
 */
export class MeiFriendWorkspace<
  TWorkspacePlugins extends readonly AnyPluginDef[],
  TMeiFriendPlugins extends readonly AnyPluginDef[],
> {
  readonly id: string
  private dag: PluginDAG<WorkspacePlugins<TWorkspacePlugins>, boolean>
  private state: PluginStateMap<WorkspacePlugins<TWorkspacePlugins>>
  private listeners = new Set<() => void>()

  private _instances = new Map<
    string,
    { instance: MeiFriend<TMeiFriendPlugins>; path: string | null }
  >()
  private _instanceCounter = 0
  private _meiFriendPluginFactory: () => TMeiFriendPlugins

  constructor(
    id: string,
    workspacePlugins: TWorkspacePlugins,
    meiFriendPluginFactory: () => TMeiFriendPlugins,
    initialName = 'New Workspace',
  ) {
    this.id = id
    this._meiFriendPluginFactory = meiFriendPluginFactory
    const allPlugins = [workspaceCorePlugin, ...workspacePlugins] as const
    this.dag = new PluginDAG(allPlugins, (fn, triggerUpdate) => this.runApi(fn, triggerUpdate))
    this.state = this.dag.getInitialStates({ core: { name: initialName } } as Partial<
      PluginStateMap<WorkspacePlugins<TWorkspacePlugins>>
    >)
  }

  async initialize(): Promise<void> {
    this.state = await this.dag.init(this.state)
    this.notifyListeners()
  }

  async runApi<R>(
    fn: (api: PluginApiMap<WorkspacePlugins<TWorkspacePlugins>>) => R | Promise<R>,
    triggerUpdate = false,
    filesChanged = false,
  ): Promise<R> {
    if (!this.state) throw new Error('Workspace not initialized')

    const { states, result } = await this.dag.run(this.state, fn)
    this.state = states

    if (triggerUpdate) {
      this.state = await this.dag.update(this.state, filesChanged)
    }

    this.notifyListeners()
    return result
  }

  // --- Convenience Wrappers ---

  async setFiles(paths: string[], name?: string): Promise<void> {
    const prev = this.state?.core?.files
    const filesChanged =
      !prev || prev.length !== paths.length || paths.some((p, i) => p !== prev[i])

    await this.runApi((api) => api.core.setFiles(paths, name), true, filesChanged)
  }

  async setName(name: string): Promise<void> {
    await this.runApi((api) => api.core.setName(name))
  }

  async markAsSaved(): Promise<void> {
    await this.runApi((api) => api.core.markAsSaved())
  }

  // --- MeiFriend Instance Management ---

  async openMeiFile(path: string, xml: string): Promise<string> {
    for (const [id, entry] of this._instances.entries()) {
      if (entry.path === path) return id
    }
    return this._createInstance(xml, path)
  }

  async openXmlContent(xml: string, fileName: string, isNewFile?: boolean): Promise<string> {
    // If it's a new file, we might need to add it via a plugin API if available
    // But in "Strict" mode, the caller should probably use runApi to call the relevant plugin.
    // For now, we'll keep the logic but wrap it.
    const instanceId = await this._createInstance(xml, isNewFile ? fileName : null)

    // Example of using runApi to interact with a potentially present 'fileIO' plugin
    await this.runApi(async (api) => {
      const fileIoApi = (api as Record<string, unknown>).fileIO as
        | { addFile?: (f: File) => void }
        | undefined
      if (isNewFile && fileIoApi?.addFile) {
        const file = new File([xml], fileName, { type: 'application/xml' })
        fileIoApi.addFile(file)
      }
    })

    return instanceId
  }

  private async _createInstance(xml: string, pathOrFileName: string | null): Promise<string> {
    const fileName = pathOrFileName?.split('/').pop() ?? 'untitled.mei'
    const id = `mf-${++this._instanceCounter}`
    const instance = new MeiFriend(id, this._meiFriendPluginFactory())

    await instance.initialize()
    await instance.updateXml(xml, fileName)

    const path = pathOrFileName ?? null
    this._instances.set(id, { instance, path })

    await this._updateInstanceIds()
    return id
  }

  async closeMeiFriend(meiFriendId: string): Promise<void> {
    const entry = this._instances.get(meiFriendId)
    if (entry) {
      await entry.instance.destroy()
      this._instances.delete(meiFriendId)
      await this._updateInstanceIds()
    }
  }

  private async _updateInstanceIds(): Promise<void> {
    const ids = Array.from(this._instances.keys())
    await this.runApi((api) => api.core.updateInstanceIds(ids))
  }

  getMeiFriendInstance(id: string): MeiFriend<TMeiFriendPlugins> | undefined {
    return this._instances.get(id)?.instance
  }

  getMeiFriendPath(id: string): string | null {
    return this._instances.get(id)?.path ?? null
  }

  getInstanceIds(): readonly string[] {
    return this.state?.core?.instanceIds ?? []
  }

  isAnyDirty(): boolean {
    if (this.state?.core?.isNameDirty) return true
    for (const entry of this._instances.values()) {
      if (entry.instance.getSnapshot().core.isDirty) return true
    }
    return false
  }

  // --- React Integration ---

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot(): PluginStateMap<WorkspacePlugins<TWorkspacePlugins>> {
    return this.state
  }

  private notifyListeners() {
    this.listeners.forEach((l) => {
      l()
    })
  }

  async destroy(): Promise<void> {
    if (this.state) {
      await this.dag.destroy(this.state)
    }
    for (const entry of this._instances.values()) {
      await entry.instance.destroy()
    }
    this._instances.clear()
    this.listeners.clear()
  }
}
