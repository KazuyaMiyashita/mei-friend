import type { StoreApi } from 'zustand/vanilla'
import { MeiFriend, type Service, type ServiceCreator } from './MeiFriend'
import type { SliceCreator } from './store/types'
import { createWorkspaceStore, type WorkspaceCoreSlice } from './store/workspaceStore'

// ── WorkspaceTypes ────────────────────────────────────────────────────────────

export type WorkspaceFileKind = 'mei' | 'image' | 'annotation' | 'other'

export type WorkspaceServiceCreator<TWorkspaceSlices> = (
  store: StoreApi<WorkspaceCoreSlice & TWorkspaceSlices>,
) => Service

export function resolveWorkspacePath(basePath: string, relative: string): string {
  if (/^https?:\/\//.test(relative)) return relative
  const baseDir = basePath.includes('/') ? basePath.split('/').slice(0, -1).join('/') : ''
  return new URL(relative, `x:/${baseDir ? `${baseDir}/` : ''}`).pathname.replace(/^\//, '')
}

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

/**
 * MeiFriendWorkspace handles a series of musical scores and resources.
 * Replaced DAG-based plugin system with Zustand-based architecture.
 */
export class MeiFriendWorkspace<TWorkspaceSlices = unknown, TMeiFriendSlices = unknown> {
  readonly id: string
  private store: StoreApi<WorkspaceCoreSlice & TWorkspaceSlices>
  private listeners = new Set<() => void>()
  private services: Service[] = []

  private _instances = new Map<
    string,
    { instance: MeiFriend<TMeiFriendSlices>; path: string | null }
  >()
  private _instanceCounter = 0
  // biome-ignore lint/suspicious/noExplicitAny: factory pattern
  private _meiFriendSliceFactory: () => SliceCreator<any>[]
  // biome-ignore lint/suspicious/noExplicitAny: factory pattern
  private _meiFriendServiceFactory: () => ServiceCreator<any>[]

  constructor(
    id: string,
    // biome-ignore lint/suspicious/noExplicitAny: slice pattern
    workspaceSlices: SliceCreator<any>[],
    // biome-ignore lint/suspicious/noExplicitAny: factory pattern
    meiFriendSliceFactory: () => SliceCreator<any>[],
    workspaceServiceCreators: WorkspaceServiceCreator<TWorkspaceSlices>[] = [],
    // biome-ignore lint/suspicious/noExplicitAny: factory pattern
    meiFriendServiceFactory: () => ServiceCreator<any>[] = () => [],
    initialName = 'New Workspace',
  ) {
    this.id = id
    this._meiFriendSliceFactory = meiFriendSliceFactory
    this._meiFriendServiceFactory = meiFriendServiceFactory
    this.store = createWorkspaceStore<TWorkspaceSlices>({ name: initialName }, workspaceSlices)
    this.services = workspaceServiceCreators.map((create) => create(this.store))
  }

  async initialize(): Promise<void> {
    this.notifyListeners()
  }

  async runApi<R>(fn: (api: WorkspaceCoreSlice & TWorkspaceSlices) => R | Promise<R>): Promise<R> {
    const result = await fn(this.store.getState())
    this.notifyListeners()
    return result
  }

  // --- Convenience Wrappers ---

  async setFiles(paths: string[], name?: string): Promise<void> {
    this.store.getState().setFiles(paths, name)
    this.notifyListeners()
  }

  async setName(name: string): Promise<void> {
    this.store.getState().setName(name)
    this.notifyListeners()
  }

  async markAsSaved(): Promise<void> {
    this.store.getState().markAsSaved()
    this.notifyListeners()
  }

  // --- MeiFriend Instance Management ---

  async openMeiFile(path: string, xml: string): Promise<string> {
    for (const [id, entry] of this._instances.entries()) {
      if (entry.path === path) return id
    }
    return this._createInstance(xml, path)
  }

  async openXmlContent(xml: string, fileName: string, isNewFile?: boolean): Promise<string> {
    const instanceId = await this._createInstance(xml, isNewFile ? fileName : null)

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
    const instance = new MeiFriend<TMeiFriendSlices>(
      id,
      this._meiFriendSliceFactory(),
      this._meiFriendServiceFactory(),
    )

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
    this.store.getState().updateInstanceIds(ids)
  }

  getMeiFriendInstance(id: string): MeiFriend<TMeiFriendSlices> | undefined {
    return this._instances.get(id)?.instance
  }

  getMeiFriendPath(id: string): string | null {
    return this._instances.get(id)?.path ?? null
  }

  getInstanceIds(): readonly string[] {
    return this.store.getState().instanceIds
  }

  isAnyDirty(): boolean {
    if (this.store.getState().isNameDirty) return true
    for (const entry of this._instances.values()) {
      if (entry.instance.getSnapshot().isDirty) return true
    }
    return false
  }

  // --- React Integration ---

  subscribe(listener: () => void): () => void {
    return this.store.subscribe(() => {
      listener()
      this.notifyListeners()
    })
  }

  getSnapshot(): WorkspaceCoreSlice & TWorkspaceSlices {
    return this.store.getState()
  }

  private notifyListeners() {
    this.listeners.forEach((l) => {
      l()
    })
  }

  async destroy(): Promise<void> {
    for (const service of this.services) {
      service.destroy()
    }
    for (const entry of this._instances.values()) {
      await entry.instance.destroy()
    }
    this._instances.clear()
    this.listeners.clear()
  }
}
