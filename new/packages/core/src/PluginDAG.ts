/**
 * Type-safe DAG-based plugin system
 *
 * Core idea:
 *   - Plugins declare `deps` as an array of *PluginDef references* (not strings).
 *   - TypeScript infers dep API types from those references at definition time.
 *   - PluginDAG builds a topological execution order via Kahn's algorithm.
 *   - Each plugin's context gives access only to its declared dependencies (via ctx.dep).
 *   - All state mutations happen within serialised "passes" (transactions).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A plugin definition — the unit of composition. */
export interface PluginDef<
  TName extends string = string,
  // biome-ignore lint/suspicious/noExplicitAny: Dependencies can be any for generic definition
  TDeps extends readonly AnyPluginDef[] = any[],
  // biome-ignore lint/suspicious/noExplicitAny: State can be any for generic definition
  TState = any,
  // biome-ignore lint/suspicious/noExplicitAny: API can be any for generic definition
  TApi = any,
  /** Type of events/actions this plugin can react to in onUpdate. */
  // biome-ignore lint/suspicious/noExplicitAny: Event can be any for generic definition
  TEvent = any,
> {
  readonly name: TName
  /** References to other PluginDefs this plugin depends on. */
  readonly deps: TDeps
  readonly initialState?: TState
  readonly onInit?: (
    ctx: PluginCtx<TState, DepsStateMap<TDeps>, DepsApiMap<TDeps>>,
    // biome-ignore lint/suspicious/noConfusingVoidType: void is needed here as plugins may return nothing
  ) => TState | Promise<TState | undefined | void> | undefined | void
  onUpdate?: (
    ctx: PluginCtx<TState, DepsStateMap<TDeps>, DepsApiMap<TDeps>>,
    event: TEvent,
    // biome-ignore lint/suspicious/noConfusingVoidType: void is needed here as plugins may return nothing
  ) => TState | Promise<TState | undefined | void> | undefined | void
  readonly onDestroy?: (
    ctx: PluginCtx<TState, DepsStateMap<TDeps>, DepsApiMap<TDeps>>,
  ) => void | Promise<void>
  /** Factory that produces the plugin's public API. Called once during init. */
  readonly api?: (ctx: PluginCtx<TState, DepsStateMap<TDeps>, DepsApiMap<TDeps>>) => TApi
}

/** Catch-all for use in `extends` constraints without introducing circularity. */
// biome-ignore lint/suspicious/noExplicitAny: Necessary for generic plugin definition without circularity
export type AnyPluginDef = PluginDef<string, any, any, any, any>

/** Extracts the public API type from a PluginDef. */
export type ApiOf<T extends AnyPluginDef> =
  T extends PluginDef<infer _N, infer _D, infer _S, infer A, infer _E> ? A : never

/** Extracts the State type from a PluginDef. */
export type StateOf<T extends AnyPluginDef> =
  T extends PluginDef<infer _N, infer _D, infer S, infer _A, infer _E> ? S : never

/** Builds { depName: depApi } from a tuple of PluginDefs. */
export type DepsApiMap<TDeps extends readonly AnyPluginDef[]> = {
  [K in TDeps[number] as K['name']]: ApiOf<K>
}

/** Builds { depName: depState } from a tuple of PluginDefs. */
export type DepsStateMap<TDeps extends readonly AnyPluginDef[]> = {
  [K in TDeps[number] as K['name']]: StateOf<K>
}

/** Context available inside onUpdate hooks (API access is intentionally omitted). */
export interface UpdateCtx<
  TState,
  TDepsState extends Record<string, unknown> = Record<string, never>,
> {
  /** Returns the current state snapshot of this plugin. */
  getState: () => TState
  /** Merges a partial patch into this plugin's state (shallow). */
  setState: (patch: Partial<TState>) => void
  /** Type-safe, read-only access to declared dependencies' states. */
  depState: Readonly<TDepsState>
  /**
   * Dispatches a new transaction (pass) to the DAG.
   * Safe to call from asynchronous callbacks (e.g. Worker.onmessage).
   */
  dispatch: (
    // biome-ignore lint/suspicious/noExplicitAny: API map can be any for generic dispatch
    fn: (api: PluginApiMap<any>) => void | Promise<void>,
    triggerUpdate?: boolean,
  ) => Promise<void>
}

/** Context available inside lifecycle hooks that allow API access (e.g. onInit, api). */
export interface PluginCtx<
  TState,
  TDepsState extends Record<string, unknown> = Record<string, never>,
  TDepsApi extends Record<string, unknown> = Record<string, never>,
> extends UpdateCtx<TState, TDepsState> {
  /** Type-safe access to declared dependencies' public APIs. */
  depApi: TDepsApi
}

/** Helper for defining plugins with full type inference (identity function). */
export function definePlugin<
  TName extends string,
  TDeps extends readonly AnyPluginDef[],
  TState,
  TApi,
  TEvent,
>(
  def: PluginDef<TName, TDeps, TState, TApi, TEvent>,
): PluginDef<TName, TDeps, TState, TApi, TEvent> {
  return def
}

// ---------------------------------------------------------------------------
// PluginDAG — builds a topological execution graph from plugin definitions
// ---------------------------------------------------------------------------

export type PluginApiMap<TPlugins extends readonly AnyPluginDef[]> = {
  [K in TPlugins[number] as K['name']]: ApiOf<K>
  // biome-ignore lint/suspicious/noExplicitAny: Allow arbitrary string keys for flexibility
} & { [key: string]: any }

export type PluginStateMap<TPlugins extends readonly AnyPluginDef[]> = {
  [K in TPlugins[number] as K['name']]: StateOf<K>
  // biome-ignore lint/suspicious/noExplicitAny: Allow arbitrary string keys for flexibility
} & { [key: string]: any }

export class PluginDAG<TPlugins extends readonly AnyPluginDef[], TEvent = unknown> {
  private readonly apis = new Map<string, unknown>()
  private readonly order: readonly AnyPluginDef[]
  private readonly nameToPlugin: ReadonlyMap<string, AnyPluginDef>
  private _currentStates: Record<string, unknown> | null = null
  private _taskQueue: Promise<unknown> = Promise.resolve()

  constructor(
    readonly plugins: TPlugins,
    private readonly dispatcher?: (
      fn: (api: PluginApiMap<TPlugins>) => void | Promise<void>,
      triggerUpdate?: boolean,
    ) => Promise<void>,
  ) {
    this.nameToPlugin = new Map(plugins.map((p) => [p.name, p]))
    this.validateDeps()
    this.order = topologicalSort(plugins)
  }

  // -------------------------------------------------------------------------
  // Lifecycle

  /**
   * Serialises execution of DAG passes using a simple promise queue.
   */
  private async enqueue<T>(states: Record<string, unknown>, fn: () => Promise<T>): Promise<T> {
    const nextTask = this._taskQueue.then(async () => {
      this._currentStates = states
      try {
        return await fn()
      } finally {
        this._currentStates = null
      }
    })
    this._taskQueue = nextTask.catch(() => {}) // Prevent queue breakage on error
    return nextTask as Promise<T>
  }

  /** Computes the initial state map synchronously from all plugins. */
  getInitialStates(overrides?: Partial<PluginStateMap<TPlugins>>): PluginStateMap<TPlugins> {
    const states: Record<string, unknown> = {}
    for (const p of this.plugins) {
      const initial = p.initialState
      states[p.name] =
        initial !== null && typeof initial === 'object' ? structuredClone(initial) : initial
      if (overrides) {
        const override = (overrides as Record<string, unknown>)[p.name]
        if (override !== undefined) {
          if (
            override !== null &&
            typeof override === 'object' &&
            states[p.name] !== null &&
            typeof states[p.name] === 'object'
          ) {
            states[p.name] = { ...(states[p.name] as object), ...(override as object) }
          } else {
            states[p.name] = override
          }
        }
      }
    }
    return states as PluginStateMap<TPlugins>
  }

  /** Initialise all plugins concurrently (respecting deps) and return the initial global state. */
  async init(overrides?: Partial<PluginStateMap<TPlugins>>): Promise<PluginStateMap<TPlugins>> {
    const states = this.getInitialStates(overrides)

    return this.enqueue(states, async () => {
      await this.traverseGraph(async (plugin) => {
        const ctx = this.buildCtx(plugin)
        if (plugin.api) {
          this.apis.set(plugin.name, plugin.api(ctx))
        }
        if (plugin.onInit) {
          const result = await plugin.onInit(ctx)
          if (result !== undefined && this._currentStates) {
            this._currentStates[plugin.name] = result
          }
        }
      })
      return { ...this._currentStates } as PluginStateMap<TPlugins>
    })
  }

  /** Notify all plugins of an event concurrently and return the updated global state. */
  async update(states: PluginStateMap<TPlugins>, event: TEvent): Promise<PluginStateMap<TPlugins>> {
    return this.enqueue({ ...states }, async () => {
      await this.traverseGraph(async (plugin) => {
        if (plugin.onUpdate) {
          const result = await plugin.onUpdate(this.buildCtx(plugin), event)
          if (result !== undefined && this._currentStates) {
            this._currentStates[plugin.name] = result
          }
        }
      })
      return { ...this._currentStates } as PluginStateMap<TPlugins>
    })
  }

  /** Run a callback with access to APIs against a specific state, returning new state. */
  async run<R>(
    states: PluginStateMap<TPlugins>,
    fn: (api: PluginApiMap<TPlugins>) => R | Promise<R>,
  ): Promise<{ states: PluginStateMap<TPlugins>; result: R }> {
    return this.enqueue({ ...states }, async () => {
      const result = await fn(this.api)
      return {
        states: { ...this._currentStates } as PluginStateMap<TPlugins>,
        result,
      }
    })
  }

  /** Notify all plugins of destruction concurrently (in reverse dep order). */
  async destroy(states: PluginStateMap<TPlugins>): Promise<void> {
    return this.enqueue({ ...states }, async () => {
      await this.traverseGraph(async (plugin) => {
        if (plugin.onDestroy) {
          await plugin.onDestroy(this.buildCtx(plugin))
        }
      }, true)
    })
  }

  // -------------------------------------------------------------------------
  // Accessors

  /**
   * Type-safe map of all plugin public APIs.
   * Note: Calling these requires being inside a `run()` or `update()` pass.
   */
  get api(): PluginApiMap<TPlugins> {
    const result: Record<string, unknown> = {}
    for (const [name, api] of this.apis) result[name] = api
    return result as PluginApiMap<TPlugins>
  }

  /** Returns the resolved execution order (useful for tests / debugging). */
  getExecutionOrder(): readonly string[] {
    return this.order.map((p) => p.name)
  }

  // -------------------------------------------------------------------------
  // Private helpers

  /**
   * Dynamically constructs a Promise tree based on the dependency graph and executes it.
   * This guarantees maximum concurrency: independent plugins execute in parallel immediately,
   * while dependent plugins wait strictly for their prerequisites to resolve.
   */
  private async traverseGraph(
    action: (plugin: AnyPluginDef) => Promise<void> | void,
    reverse = false,
  ): Promise<void> {
    const promises = new Map<string, Promise<void>>()

    const dependents = new Map<string, string[]>()
    if (reverse) {
      for (const p of this.plugins) dependents.set(p.name, [])
      for (const p of this.plugins) {
        for (const d of p.deps) {
          dependents.get(d.name)?.push(p.name)
        }
      }
    }

    const getPromise = (pluginName: string): Promise<void> => {
      const existing = promises.get(pluginName)
      if (existing) return existing

      const plugin = this.nameToPlugin.get(pluginName)
      if (!plugin) throw new Error(`Plugin ${pluginName} not found`)

      const depsToWaitFor = reverse
        ? (dependents.get(pluginName) ?? [])
        : plugin.deps.map((d: AnyPluginDef) => d.name)

      const promise = (async () => {
        if (depsToWaitFor.length > 0) {
          await Promise.all(depsToWaitFor.map((dep: string) => getPromise(dep)))
        }
        await action(plugin)
      })()

      promises.set(pluginName, promise)
      return promise
    }

    await Promise.all(this.plugins.map((p) => getPromise(p.name)))
  }

  private validateDeps(): void {
    for (const plugin of this.plugins) {
      for (const dep of plugin.deps) {
        if (!this.nameToPlugin.has(dep.name)) {
          throw new Error(
            `Plugin "${plugin.name}" depends on "${dep.name}" which is not registered in this DAG.`,
          )
        }
      }
    }
  }

  private buildCtx(
    plugin: AnyPluginDef,
  ): PluginCtx<unknown, Record<string, unknown>, Record<string, unknown>> {
    const depApi: Record<string, unknown> = {}
    const depState: Record<string, unknown> = {}

    for (const depDef of plugin.deps) {
      depApi[depDef.name] = this.apis.get(depDef.name)
      Object.defineProperty(depState, depDef.name, {
        get: () => {
          if (!this._currentStates) {
            throw new Error(
              `Plugin "${plugin.name}" attempted to access depState outside of an active DAG pass.`,
            )
          }
          return this._currentStates[depDef.name]
        },
        enumerable: true,
      })
    }

    return {
      getState: () => {
        if (!this._currentStates) {
          throw new Error(
            `Plugin "${plugin.name}" attempted to getState() outside of an active DAG pass.`,
          )
        }
        return this._currentStates[plugin.name]
      },
      setState: (patch) => {
        if (!this._currentStates) {
          throw new Error(
            `Plugin "${plugin.name}" attempted to setState() outside of an active DAG pass.`,
          )
        }
        const current = this._currentStates[plugin.name]
        this._currentStates[plugin.name] = { ...(current as object), ...(patch as object) }
      },
      dispatch: (fn, triggerUpdate) => {
        if (!this.dispatcher) {
          throw new Error(
            `Plugin "${plugin.name}" attempted to dispatch, but no dispatcher was provided to PluginDAG.`,
          )
        }
        return this.dispatcher(
          fn as (api: PluginApiMap<TPlugins>) => void | Promise<void>,
          triggerUpdate,
        )
      },
      depApi,
      depState,
    }
  }
}

// ---------------------------------------------------------------------------
// Topological sort (Kahn's algorithm — O(V+E))
// ---------------------------------------------------------------------------

function topologicalSort(plugins: readonly AnyPluginDef[]): AnyPluginDef[] {
  const nameToPlugin = new Map(plugins.map((p) => [p.name, p]))
  /** inDegree[p] = number of declared deps that are still unprocessed */
  const inDegree = new Map<string, number>(plugins.map((p) => [p.name, 0]))
  /** adjacency[dep] = list of plugins that depend on dep */
  const adjacency = new Map<string, string[]>()

  for (const p of plugins) {
    for (const dep of p.deps) {
      if (!adjacency.has(dep.name)) adjacency.set(dep.name, [])
      adjacency.get(dep.name)?.push(p.name)
      inDegree.set(p.name, (inDegree.get(p.name) ?? 0) + 1)
    }
  }

  // Start with plugins that have no dependencies.
  const queue: string[] = []
  for (const [name, deg] of inDegree) {
    if (deg === 0) queue.push(name)
  }

  const result: AnyPluginDef[] = []
  while (queue.length > 0) {
    const name = queue.shift()
    if (name === undefined) break
    const plugin = nameToPlugin.get(name)
    if (plugin) {
      result.push(plugin)
      for (const dependent of adjacency.get(name) ?? []) {
        const newDeg = (inDegree.get(dependent) ?? 0) - 1
        inDegree.set(dependent, newDeg)
        if (newDeg === 0) queue.push(dependent)
      }
    }
  }

  if (result.length !== plugins.length) {
    throw new Error('Circular dependency detected in plugin graph.')
  }

  return result
}
