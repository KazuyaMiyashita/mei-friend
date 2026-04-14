import type React from 'react'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export interface AppSettings {
  showSplash: boolean
  workspaceStorageMode: 'browser' | 'local' | null
}

export interface ApplicationContextValue {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
}

const SETTINGS_KEY = 'mei-friend:settings'

const DEFAULT_SETTINGS: AppSettings = {
  showSplash: true,
  workspaceStorageMode: null,
}

const ApplicationContext = createContext<ApplicationContextValue | null>(null)

export function ApplicationProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY)
      if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
    } catch {
      /* ignore */
    }
    return DEFAULT_SETTINGS
  })

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      /* quota exceeded を無視 */
    }
  }, [settings])

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  return (
    <ApplicationContext.Provider value={{ settings, updateSettings }}>
      {children}
    </ApplicationContext.Provider>
  )
}

export function useApplicationContext(): ApplicationContextValue {
  const ctx = useContext(ApplicationContext)
  if (!ctx) throw new Error('useApplicationContext must be used within ApplicationProvider')
  return ctx
}
