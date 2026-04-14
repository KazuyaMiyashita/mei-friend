declare module 'verovio/esm' {
  export const LOG_OFF: number
  export const LOG_ERROR: number
  export const LOG_WARNING: number
  export const LOG_INFO: number
  export const LOG_DEBUG: number

  // biome-ignore lint/suspicious/noExplicitAny: third-party typings
  export function enableLog(level: number, VerovioModule: any): void
  // biome-ignore lint/suspicious/noExplicitAny: third-party typings
  export function enableLogToBuffer(value: boolean, VerovioModule: any): void

  export class VerovioToolkit {
    // biome-ignore lint/suspicious/noExplicitAny: third-party typings
    constructor(module?: any)
    // biome-ignore lint/suspicious/noExplicitAny: third-party typings
    setOptions(options: any): boolean
    loadData(data: string): boolean
    getPageCount(): number
    // biome-ignore lint/suspicious/noExplicitAny: third-party typings
    renderToSVG(pageNo: number, options?: any): string
    getLog(): string
    getVersion(): string
    // biome-ignore lint/suspicious/noExplicitAny: third-party typings
    redoLayout(options?: any): void
    // biome-ignore lint/suspicious/noExplicitAny: third-party typings
    getMEI(options?: any): string
    // biome-ignore lint/suspicious/noExplicitAny: third-party typings
    renderToExpansionMap(): any
    renderToMIDI(): string
    // biome-ignore lint/suspicious/noExplicitAny: third-party typings
    renderToTimemap(options?: any): any[]
    // biome-ignore lint/suspicious/noExplicitAny: third-party typings
    getElementAttr(xmlId: string): any
    // biome-ignore lint/suspicious/noExplicitAny: third-party typings
    getElementsAtTime(millisec: number): any
    getTimeForElement(xmlId: string): number
    // Add more as needed
  }
}

declare module 'verovio/wasm' {
  // biome-ignore lint/suspicious/noExplicitAny: third-party typings
  const createModule: () => Promise<any>
  export default createModule
}
