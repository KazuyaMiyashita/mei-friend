import { type AppSettings, useApplicationContext } from './ApplicationProvider'

export type { AppSettings }

export interface UseApplicationReturn {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
}

/** Hook to get and update application-wide settings */
export function useApplication(): UseApplicationReturn {
  return useApplicationContext()
}
