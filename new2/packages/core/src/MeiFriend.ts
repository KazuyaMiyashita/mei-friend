import type { StoreApi } from 'zustand/vanilla'
import { type CoreSlice, createMeiFriendStore } from './store/meiFriendStore'
import type { SliceCreator } from './store/types'

export interface Service {
  destroy(): void
}

export type ServiceCreator<TSlices> = (store: StoreApi<CoreSlice & TSlices>) => Service

/**
 * MeiFriend manages a single musical score using a Zustand-based state management system.
 */
export class MeiFriend<TSlices = unknown> {
  readonly id: string
  private store: StoreApi<CoreSlice & TSlices>
  private listeners = new Set<() => void>()
  private services: Service[] = []

  constructor(
    id: string,
    userSlices: SliceCreator<TSlices>[] = [],
    serviceCreators: ServiceCreator<TSlices>[] = [],
  ) {
    this.id = id
    this.store = createMeiFriendStore<TSlices>({}, userSlices)
    this.services = serviceCreators.map((create) => create(this.store))
  }

  async initialize() {
    this.notifyListeners()
  }

  /**
   * Runs a function with access to the store's API (state and actions).
   */
  async runApi<R>(fn: (api: CoreSlice & TSlices) => R | Promise<R>): Promise<R> {
    const result = await fn(this.store.getState())
    this.notifyListeners()
    return result
  }

  // --- Convenience Wrappers ---

  async updateXml(xml: string, fileName?: string): Promise<void> {
    this.store.getState().updateXml(xml, fileName)
    this.notifyListeners()
  }

  async edit(fn: (doc: Document) => void): Promise<void> {
    this.store.getState().edit(fn)
    this.notifyListeners()
  }

  async markAsSaved(): Promise<void> {
    this.store.getState().markAsSaved()
    this.notifyListeners()
  }

  getXml(): string | null {
    return this.store.getState().xmlContent
  }

  getFileName(): string | null {
    return this.store.getState().fileName
  }

  // --- React Integration ---

  subscribe(listener: () => void): () => void {
    return this.store.subscribe(() => {
      listener()
      this.notifyListeners()
    })
  }

  getSnapshot(): CoreSlice & TSlices {
    return this.store.getState()
  }

  private notifyListeners() {
    this.listeners.forEach((l) => {
      l()
    })
  }

  async destroy() {
    for (const service of this.services) {
      service.destroy()
    }
    this.listeners.clear()
  }
}
