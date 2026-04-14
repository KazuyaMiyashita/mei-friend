import { createContext, type ReactNode, useContext, useState } from 'react'

interface StatusContextType {
  statusText: string
  setStatusText: (text: string) => void
}

const StatusContext = createContext<StatusContextType | null>(null)

export function StatusProvider({ children }: { children: ReactNode }) {
  const [statusText, setStatusText] = useState('Ready.')

  return (
    <StatusContext.Provider value={{ statusText, setStatusText }}>
      {children}
    </StatusContext.Provider>
  )
}

export function useStatus() {
  const context = useContext(StatusContext)
  if (!context) {
    throw new Error('useStatus must be used within a StatusProvider')
  }
  return context
}
