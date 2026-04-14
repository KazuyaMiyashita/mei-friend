import { describe, expect, it, vi } from 'vitest'
import { type AnyPluginDef, definePlugin, PluginDAG } from '../src/PluginDAG'

// ---------------------------------------------------------------------------
// Fixtures — reusable plugin definitions
// ---------------------------------------------------------------------------

const counterPlugin = definePlugin({
  name: 'counter',
  deps: [],
  initialState: { n: 0 },
  api: (ctx) => ({
    increment: () => ctx.setState({ n: ctx.getState().n + 1 }),
    get: () => ctx.getState().n,
  }),
})

const selectionPlugin = definePlugin({
  name: 'selection',
  deps: [],
  initialState: { selectedId: null as string | null },
  api: (ctx) => ({
    select: (id: string | null) => ctx.setState({ selectedId: id }),
    getSelected: () => ctx.getState().selectedId,
  }),
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PluginDAG — topological ordering', () => {
  it('single plugin (no deps): runs onInit once', async () => {
    const init = vi.fn()
    const dag = new PluginDAG([definePlugin({ name: 'solo', deps: [], onInit: init })])
    await dag.init()
    expect(init).toHaveBeenCalledOnce()
  })

  it('dependent runs after its dependency, regardless of registration order', async () => {
    const order: string[] = []
    const a = definePlugin({ name: 'a', deps: [], onInit: () => order.push('a') })
    const b = definePlugin({ name: 'b', deps: [a], onInit: () => order.push('b') })

    // Register b before a — the DAG must reorder them.
    const dag = new PluginDAG([b, a])
    await dag.init()

    expect(order).toEqual(['a', 'b'])
  })

  it('three-level chain: a → b → c', async () => {
    const order: string[] = []
    const a = definePlugin({ name: 'a', deps: [], onInit: () => order.push('a') })
    const b = definePlugin({ name: 'b', deps: [a], onInit: () => order.push('b') })
    const c = definePlugin({ name: 'c', deps: [b], onInit: () => order.push('c') })

    await new PluginDAG([c, a, b]).init()
    expect(order).toEqual(['a', 'b', 'c'])
  })

  it('diamond: a → {b, c} → d — a first, d last', async () => {
    const order: string[] = []
    const a = definePlugin({ name: 'a', deps: [], onInit: () => order.push('a') })
    const b = definePlugin({ name: 'b', deps: [a], onInit: () => order.push('b') })
    const c = definePlugin({ name: 'c', deps: [a], onInit: () => order.push('c') })
    const d = definePlugin({ name: 'd', deps: [b, c], onInit: () => order.push('d') })

    await new PluginDAG([d, c, b, a]).init()

    expect(order[0]).toBe('a')
    expect(order[3]).toBe('d')
    expect(new Set(order)).toEqual(new Set(['a', 'b', 'c', 'd']))
  })

  it('getExecutionOrder() exposes the resolved order', () => {
    const a = definePlugin({ name: 'a', deps: [] })
    const b = definePlugin({ name: 'b', deps: [a] })
    const dag = new PluginDAG([b, a])
    expect(dag.getExecutionOrder()).toEqual(['a', 'b'])
  })
})

// ---------------------------------------------------------------------------

describe('PluginDAG — validation', () => {
  it('throws when a dependency is not registered', () => {
    const ghost = definePlugin({ name: 'ghost', deps: [] })
    const plugin = definePlugin({ name: 'plugin', deps: [ghost] })

    expect(() => new PluginDAG([plugin])).toThrow(
      'Plugin "plugin" depends on "ghost" which is not registered in this DAG.',
    )
  })

  it('throws on a direct cycle: a → b → a', () => {
    // Inject cycle at runtime (bypasses TS structural typing).
    type MutablePlugin = { name: string; deps: AnyPluginDef[] }
    const a = { name: 'a', deps: [] } as unknown as MutablePlugin
    const b = { name: 'b', deps: [a as unknown as AnyPluginDef] } as unknown as MutablePlugin
    a.deps = [b as unknown as AnyPluginDef] // a now depends on b — intentional cycle

    expect(
      () => new PluginDAG([a as unknown as AnyPluginDef, b as unknown as AnyPluginDef]),
    ).toThrow('Circular dependency detected in plugin graph.')
  })

  it('throws on a self-referencing plugin', () => {
    type MutablePlugin = { name: string; deps: AnyPluginDef[] }
    const self = { name: 'self', deps: [] } as unknown as MutablePlugin
    self.deps = [self as unknown as AnyPluginDef]

    expect(() => new PluginDAG([self as unknown as AnyPluginDef])).toThrow(
      'Circular dependency detected in plugin graph.',
    )
  })
})

// ---------------------------------------------------------------------------

describe('PluginDAG — state management', () => {
  it('initialises state from initialState', async () => {
    const dag = new PluginDAG([counterPlugin])
    const states = await dag.init()
    expect(states.counter).toEqual({ n: 0 })
  })

  it('setState merges partial updates (does not overwrite unrelated fields)', async () => {
    const plugin = definePlugin({
      name: 'mixed',
      deps: [],
      initialState: { count: 0, label: 'test' },
      onInit: (ctx) => ctx.setState({ count: 5 }),
    })
    const dag = new PluginDAG([plugin])
    const states = await dag.init()
    expect(states.mixed).toEqual({ count: 5, label: 'test' })
  })

  it('each plugin has isolated state', async () => {
    const a = definePlugin({ name: 'a', deps: [], initialState: { x: 1 } })
    const b = definePlugin({ name: 'b', deps: [], initialState: { x: 2 } })
    const dag = new PluginDAG([a, b])
    const states = await dag.init()
    expect(states.a).toEqual({ x: 1 })
    expect(states.b).toEqual({ x: 2 })
  })

  it('initialState is shallow-copied — mutations inside onInit do not alias the def', async () => {
    const initial = { items: [1, 2, 3] }
    const plugin = definePlugin({
      name: 'list',
      deps: [],
      initialState: initial,
      onInit: (ctx) => {
        // Mutate through the context — should not affect the original def.
        ;(ctx.getState() as typeof initial).items.push(4)
      },
    })
    await new PluginDAG([plugin]).init()
    // Original def's initialState must be unchanged.
    expect(initial.items).toEqual([1, 2, 3])
  })

  it('onInit can return a new state to replace initialState', async () => {
    const plugin = definePlugin({
      name: 'p',
      deps: [],
      initialState: { n: 0 },
      onInit: () => ({ n: 42 }),
    })
    const dag = new PluginDAG([plugin])
    const states = await dag.init()
    expect(states.p).toEqual({ n: 42 })
  })
})

// ---------------------------------------------------------------------------
// PluginDAG — ctx.depApi & ctx.depState (type-safe dependency access)
// ---------------------------------------------------------------------------

describe('PluginDAG — ctx.depApi & ctx.depState (type-safe dependency access)', () => {
  it('dependent can call depApi in onInit', async () => {
    const results: (string | null)[] = []

    const reader = definePlugin({
      name: 'reader',
      deps: [selectionPlugin],
      onInit: (ctx) => {
        // ctx.depApi.selection is inferred as the selection API — no cast needed.
        results.push(ctx.depApi.selection.getSelected())
      },
    })

    await new PluginDAG([selectionPlugin, reader]).init()
    expect(results).toEqual([null])
  })

  it('depState reflects updated dependency state during onUpdate', async () => {
    const doubleCounter = definePlugin({
      name: 'doubleCounter',
      deps: [counterPlugin],
      initialState: { doubled: 0 },
      onUpdate: (ctx) => {
        // We can only read ctx.depState here, not ctx.depApi!
        ctx.setState({ doubled: ctx.depState.counter.n * 2 })
      },
    })

    const dag = new PluginDAG([counterPlugin, doubleCounter])
    let states = await dag.init()

    const runRes = await dag.run(states, (api) => {
      api.counter.increment()
    })
    states = runRes.states

    // Dispatching an event triggers onUpdate. Since doubleCounter depends on counter,
    // its onUpdate will receive the fresh state of counter.
    states = await dag.update(states, 'SYNC')

    expect(states.doubleCounter.doubled).toBe(2)
  })

  it('ctx only exposes declared deps', async () => {
    let apiKeys: string[] = []
    let stateKeys: string[] = []
    const spy = definePlugin({
      name: 'spy',
      deps: [counterPlugin],
      onInit: (ctx) => {
        apiKeys = Object.keys(ctx.depApi)
        stateKeys = Object.keys(ctx.depState)
      },
    })

    await new PluginDAG([selectionPlugin, counterPlugin, spy]).init()
    expect(apiKeys).toEqual(['counter'])
    expect(stateKeys).toEqual(['counter'])
    expect(apiKeys).not.toContain('selection')
  })
})

// ---------------------------------------------------------------------------

describe('PluginDAG — onUpdate', () => {
  it('calls onUpdate for all plugins in topological order', async () => {
    const order: string[] = []
    const a = definePlugin({ name: 'a', deps: [], onUpdate: () => order.push('a') })
    const b = definePlugin({ name: 'b', deps: [a], onUpdate: () => order.push('b') })

    const dag = new PluginDAG([b, a])
    const states = await dag.init()
    await dag.update(states, { type: 'T' })
    expect(order).toEqual(['a', 'b'])
  })

  it('passes abstracted event through correctly', async () => {
    const received: unknown[] = []
    const plugin = definePlugin({
      name: 'p',
      deps: [],
      onUpdate: (_ctx, event) => received.push(event),
    })
    const dag = new PluginDAG([plugin])
    const states = await dag.init()
    await dag.update(states, { type: 'XML_CHANGED', diff: '...' })
    await dag.update(states, { type: 'SELECTION_CHANGED', id: 'n1' })

    expect(received).toEqual([
      { type: 'XML_CHANGED', diff: '...' },
      { type: 'SELECTION_CHANGED', id: 'n1' },
    ])
  })

  it('onUpdate can return a new state', async () => {
    const plugin = definePlugin({
      name: 'p',
      deps: [],
      initialState: { n: 0 },
      onUpdate: (_ctx, event: { n: number }) => event,
    })
    const dag = new PluginDAG([plugin])
    let states = await dag.init()
    states = await dag.update(states, { n: 100 })
    expect(states.p).toEqual({ n: 100 })
  })
})

// ---------------------------------------------------------------------------

describe('PluginDAG — run() helper', () => {
  it('allows calling APIs with specific state and returns updated state', async () => {
    const dag = new PluginDAG([counterPlugin])
    const states = await dag.init()

    const result = await dag.run(states, (api) => {
      api.counter.increment()
      api.counter.increment()
      return 'done'
    })

    expect(result.result).toBe('done')
    expect(result.states.counter.n).toBe(2)
    // Original states should be untouched (PluginDAG.run clones or returns new object)
    expect(states.counter.n).toBe(0)
  })

  it('throws if API called outside of run/update', async () => {
    const dag = new PluginDAG([counterPlugin])
    await dag.init()
    expect(() => dag.api.counter.get()).toThrow(/outside of an active DAG pass/)
  })
})

// ---------------------------------------------------------------------------

describe('PluginDAG — destroy', () => {
  it('calls onDestroy in reverse topological order', async () => {
    const order: string[] = []
    const a = definePlugin({
      name: 'a',
      deps: [],
      onDestroy: () => {
        order.push('a')
      },
    })
    const b = definePlugin({
      name: 'b',
      deps: [a],
      onDestroy: () => {
        order.push('b')
      },
    })

    const dag = new PluginDAG([a, b])
    const states = await dag.init()
    await dag.destroy(states)

    expect(order).toEqual(['b', 'a'])
  })
})

// ---------------------------------------------------------------------------

describe('PluginDAG — realistic mei-friend scenario', () => {
  it('selection → editor → history: init order and update propagation', async () => {
    const editLog: string[] = []
    const initOrder: string[] = []

    const localSelection = definePlugin({
      name: 'selection',
      deps: [],
      initialState: { selectedId: null as string | null },
      onInit: () => {
        initOrder.push('selection')
      },
      api: (ctx) => ({
        select: (id: string | null) => ctx.setState({ selectedId: id }),
        getSelected: () => ctx.getState().selectedId,
      }),
    })

    const localEditor = definePlugin({
      name: 'editor',
      deps: [localSelection],
      onInit: () => {
        initOrder.push('editor')
      },
      api: (ctx) => ({
        pitchUp: () => {
          const id = ctx.depApi.selection.getSelected()
          if (id) editLog.push(`pitchUp:${id}`)
        },
      }),
    })

    const localHistory = definePlugin({
      name: 'history',
      deps: [localEditor],
      initialState: { snapshots: [] as string[] },
      onInit: () => {
        initOrder.push('history')
      },
      onUpdate: (ctx, event) => {
        if (event === 'SAVE') {
          ctx.setState({ snapshots: [...ctx.getState().snapshots, 'snapshot'] })
        }
      },
    })

    const dag = new PluginDAG([localHistory, localEditor, localSelection])
    let states = await dag.init()

    expect(initOrder).toEqual(['selection', 'editor', 'history'])

    // Use run() to simulate UI interaction
    const runRes = await dag.run(states, (api) => {
      api.selection.select('note-42')
      api.editor.pitchUp()
    })
    states = runRes.states

    states = await dag.update(states, 'SAVE')
    states = await dag.update(states, 'SAVE')

    expect(editLog).toEqual(['pitchUp:note-42'])
    expect(states.history.snapshots).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------

describe('PluginDAG — Concurrency', () => {
  it('runs independent plugins concurrently during init', async () => {
    const active = new Set<string>()
    let maxConcurrent = 0

    const makePlugin = (name: string, deps: readonly AnyPluginDef[] = []) =>
      definePlugin({
        name,
        deps,
        onInit: async () => {
          active.add(name)
          maxConcurrent = Math.max(maxConcurrent, active.size)
          // Simulate async work
          await new Promise((r) => setTimeout(r, 20))
          active.delete(name)
        },
      })

    // a and b are independent
    const a = makePlugin('a')
    const b = makePlugin('b')
    // c depends on both, so it must wait
    const c = makePlugin('c', [a, b])

    const dag = new PluginDAG([c, b, a])
    await dag.init()

    expect(maxConcurrent).toBe(2) // a and b were running at the same time
  })

  it('executes concurrent passes sequentially via queue', async () => {
    let activePasses = 0
    const plugin = definePlugin({
      name: 'p',
      deps: [],
      onUpdate: async () => {
        activePasses++
        await new Promise((r) => setTimeout(r, 10))
        expect(activePasses).toBe(1) // Should always be 1 if queued
        activePasses--
      },
    })
    const dag = new PluginDAG([plugin])
    const states = await dag.init()

    // Fire two updates concurrently without awaiting the first
    const p1 = dag.update(states, 'E1')
    const p2 = dag.update(states, 'E2')

    await Promise.all([p1, p2])
    expect(activePasses).toBe(0)
  })
})
