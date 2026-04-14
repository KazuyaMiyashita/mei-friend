import { enableLog, enableLogToBuffer, LOG_WARNING, VerovioToolkit } from 'verovio/esm'
import type { VrvCommand, VrvResponse } from '../verovio-protocol'

type Tk = InstanceType<typeof VerovioToolkit> & {
  getLog(): string
  getVersion(): string
  redoLayout(options?: Record<string, unknown>): void
  getMEI(options?: Record<string, unknown>): string
}

let tk: Tk | null = null

function flushLog(context: string): void {
  if (!tk) return
  const log = tk.getLog()
  if (log?.trim()) {
    console.warn(`[worker:verovio] ${context}:`, log)
  }
}

self.onmessage = async (e: MessageEvent<VrvCommand>) => {
  const msg = e.data
  console.log('[worker] received:', msg.cmd)

  if (msg.cmd === 'loadVerovio') {
    try {
      const { default: createModule } = await import('verovio/wasm')
      const vrvModule = await createModule()
      tk = new VerovioToolkit(vrvModule) as Tk
      // Enable the mode to accumulate logs in a buffer (console.warn may not be available within a Worker)
      enableLogToBuffer(true, vrvModule)
      enableLog(LOG_WARNING, vrvModule)
      console.log('[worker] VerovioToolkit ready, version:', tk.getVersion())
      self.postMessage({ cmd: 'vrvLoaded' } satisfies VrvResponse)
    } catch (err) {
      console.error('[worker] loadVerovio failed:', err)
      self.postMessage({ cmd: 'error', message: String(err) } satisfies VrvResponse)
    }
    return
  }

  if (!tk) {
    console.warn('[worker] tk not ready, ignoring', msg.cmd)
    return
  }

  try {
    if (msg.cmd === 'updateAll') {
      tk.setOptions(msg.options as unknown as Parameters<Tk['setOptions']>[0])
      const loaded = tk.loadData(msg.mei)
      flushLog('updateAll/loadData')
      if (!loaded) {
        console.error('[worker] loadData returned false for updateAll')
        self.postMessage({
          cmd: 'error',
          message: 'Verovio: loadData failed',
        } satisfies VrvResponse)
        return
      }
      console.log('[worker] updateAll: pageCount=', tk.getPageCount())
      self.postMessage({
        cmd: 'updated',
        svg: tk.renderToSVG(msg.pageNo),
        pageCount: tk.getPageCount(),
        pageNo: msg.pageNo,
      } satisfies VrvResponse)
      flushLog('updateAll/render')
    } else if (msg.cmd === 'updateData') {
      const loaded = tk.loadData(msg.mei)
      flushLog('updateData/loadData')
      if (!loaded) {
        console.error('[worker] loadData returned false for updateData')
        self.postMessage({
          cmd: 'error',
          message: 'Verovio: loadData failed on updateData',
        } satisfies VrvResponse)
        return
      }
      console.log('[worker] updateData: pageCount=', tk.getPageCount())
      self.postMessage({
        cmd: 'updated',
        svg: tk.renderToSVG(msg.pageNo),
        pageCount: tk.getPageCount(),
        pageNo: msg.pageNo,
      } satisfies VrvResponse)
      flushLog('updateData/render')
    } else if (msg.cmd === 'changePage') {
      self.postMessage({
        cmd: 'updated',
        svg: tk.renderToSVG(msg.pageNo),
        pageCount: tk.getPageCount(),
        pageNo: msg.pageNo,
      } satisfies VrvResponse)
    } else if (msg.cmd === 'setOptions') {
      tk.setOptions(msg.options as unknown as Parameters<Tk['setOptions']>[0])
      tk.redoLayout()
      flushLog('setOptions')
      self.postMessage({
        cmd: 'updated',
        svg: tk.renderToSVG(msg.pageNo),
        pageCount: tk.getPageCount(),
        pageNo: msg.pageNo,
      } satisfies VrvResponse)
    }
  } catch (err) {
    console.error('[worker] error processing', msg.cmd, err)
    self.postMessage({ cmd: 'error', message: String(err) } satisfies VrvResponse)
  }
}
