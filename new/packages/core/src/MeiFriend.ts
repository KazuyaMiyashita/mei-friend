import { meiFriendCorePlugin } from './MeiFriendCorePlugin'
import { type AnyPluginDef, type PluginApiMap, PluginDAG, type PluginStateMap } from './PluginDAG'

export type MeiFriendPlugins<T extends readonly AnyPluginDef[]> = readonly [
  typeof meiFriendCorePlugin,
  ...T,
]

/**
 * MeiFriend manages a single musical score using a type-safe DAG-based plugin system.
 */
export class MeiFriend<TPlugins extends readonly AnyPluginDef[]> {
  readonly id: string
  private dag: PluginDAG<MeiFriendPlugins<TPlugins>, boolean>
  private state: PluginStateMap<MeiFriendPlugins<TPlugins>>
  private listeners = new Set<() => void>()

  constructor(id: string, userPlugins: TPlugins) {
    this.id = id
    const allPlugins = [meiFriendCorePlugin, ...userPlugins] as const
    this.dag = new PluginDAG(allPlugins, (fn, triggerUpdate) => this.runApi(fn, triggerUpdate))
    this.state = this.dag.getInitialStates()
  }

  async initialize() {
    this.state = await this.dag.init()
    this.notifyListeners()
  }

  /**
   * Runs a function with access to all plugin APIs.
   * This is the primary way to interact with MeiFriend in "Strict" mode.
   * Automatically notifies listeners after the transaction completes.
   */
  async runApi<R>(
    fn: (api: PluginApiMap<MeiFriendPlugins<TPlugins>>) => R | Promise<R>,
    triggerUpdate = false,
    xmlChanged = false,
  ): Promise<R> {
    if (!this.state) throw new Error('MeiFriend not initialized')

    const { states, result } = await this.dag.run(this.state, fn)
    this.state = states

    if (triggerUpdate) {
      this.state = await this.dag.update(this.state, xmlChanged)
    }

    this.notifyListeners()
    return result
  }

  // --- Convenience Wrappers (Strictly using runApi internally) ---

  async updateXml(xml: string, fileName?: string): Promise<void> {
    await this.runApi((api) => api.core.updateXml(xml, fileName), true, true)
  }

  async edit(fn: (doc: Document) => void): Promise<void> {
    await this.runApi((api) => api.core.edit(fn), true, true)
  }

  async markAsSaved(): Promise<void> {
    await this.runApi((api) => api.core.markAsSaved(), true, false)
  }

  getXml(): string | null {
    return this.state?.core?.xmlContent ?? null
  }

  getFileName(): string | null {
    return this.state?.core?.fileName ?? null
  }

  // --- React Integration ---

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot(): PluginStateMap<MeiFriendPlugins<TPlugins>> {
    return this.state
  }

  private notifyListeners() {
    this.listeners.forEach((l) => {
      l()
    })
  }

  async destroy() {
    if (this.state) {
      await this.dag.destroy(this.state)
    }
    this.listeners.clear()
  }
}
