import type { ReactNode } from 'react'
import { ApplicationProvider } from './application/ApplicationProvider'
import { LayoutProvider } from './layout/LayoutProvider'
import { WorkspaceProvider } from './workspace/WorkspaceProvider'

/**
 * Wraps the application, workspace, and layout providers together.
 * Used in the root component of App.tsx.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <ApplicationProvider>
      <WorkspaceProvider>
        <LayoutProvider>{children}</LayoutProvider>
      </WorkspaceProvider>
    </ApplicationProvider>
  )
}
