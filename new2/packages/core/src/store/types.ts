import type { StoreApi } from 'zustand/vanilla'

export type SliceCreator<T> = (
  // biome-ignore lint/suspicious/noExplicitAny: fundamental to Zustand slice pattern
  set: (partial: any, replace?: boolean) => void,
  // biome-ignore lint/suspicious/noExplicitAny: fundamental to Zustand slice pattern
  get: () => any,
  // biome-ignore lint/suspicious/noExplicitAny: fundamental to Zustand slice pattern
  api: StoreApi<any>,
) => T
