import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Panel,
  Group as PanelGroup,
  type PanelImperativeHandle,
  Separator as PanelResizeHandle,
  type PanelSize,
} from 'react-resizable-panels'
import ActivityBar from './components/ActivityBar/ActivityBar'
import SettingsPanel from './components/ActivityBar/settings/SettingsPanel'
import WorkspacePanel from './components/ActivityBar/workspace/WorkspacePanel'
import Footer from './components/Footer/Footer'
import Header from './components/Header/Header'
import MainContent from './components/MainContent/MainContent'
import EnableLocalWriteDialog from './components/Modals/EnableLocalWriteDialog'
import NewFileDialog from './components/Modals/NewFileDialog'
import { AppProvider } from './features/app/AppProvider'
import { useApplication } from './features/app/application/useApplication'
import { useLayout } from './features/app/layout/useLayout'
import { useMeiFriendWorkspace } from './features/app/workspace/useMeiFriendWorkspace'
import { useKeyBindings } from './features/keybindings/useKeyBindings'
import { ActiveStatusManager } from './features/status/ActiveStatusManager'
import { StatusProvider } from './features/status/StatusProvider'
import './App.css'

// ── Internal Components ─────────────────────────────────────────────────────────

function AppContent() {
  const { settings, updateSettings } = useApplication()
  const { workspace, openFile, openXmlContent, openFolder } = useMeiFriendWorkspace()
  const layout = useLayout()

  const [isNewFileDialogOpen, setIsNewFileDialogOpen] = useState(false)
  const [modeDialogState, setModeDialogState] = useState<{
    resolve: (val: 'browser' | 'local' | 'cancel') => void
  } | null>(null)
  const explorerRef = useRef<PanelImperativeHandle>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleOpenNewFileDialog = useCallback(() => setIsNewFileDialogOpen(true), [])
  const handleCloseNewFileDialog = useCallback(() => setIsNewFileDialogOpen(false), [])

  const toggleSidebar = useCallback(
    (panel: 'workspace' | 'notation' | 'settings') => {
      if (layout.activeSidebar === panel) {
        explorerRef.current?.collapse()
        layout.setActiveSidebar(null)
      } else {
        layout.setActiveSidebar(panel)
        explorerRef.current?.expand()
      }
    },
    [layout],
  )

  useKeyBindings({
    onNewFile: handleOpenNewFileDialog,
    onToggleSettings: () => toggleSidebar('settings'),
  })

  // Save confirmation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (workspace.isAnyDirty()) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [workspace])

  // ── File Processing ────────────────────────────────────────────────────────────

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files)
      for (const file of fileArray) {
        await workspace.runApi((api) => api.fileIO.addFile(file))
        const xml = await workspace.runApi((api) => api.fileIO.readFile(file.name))
        await openFile(file.name, xml)
      }
    },
    [workspace, openFile],
  )

  const handleOpenFile = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleOpenWorkspace = useCallback(async () => {
    const askPersistenceMode = () =>
      new Promise<'browser' | 'local' | 'cancel'>((resolve) => {
        setModeDialogState({ resolve })
      })

    await openFolder(askPersistenceMode)
  }, [openFolder])

  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) return
      await processFiles(files)
      e.target.value = ''
    },
    [processFiles],
  )

  const handleOpenUrl = useCallback(async () => {
    const url = window.prompt('Enter MEI/MusicXML file URL:')
    if (!url?.trim()) return
    try {
      const response = await fetch(url.trim())
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const xml = await response.text()
      const fileName = url.split('/').pop() || 'url-file.mei'
      await openXmlContent(xml, fileName)
    } catch (err) {
      window.alert(`Failed to load URL: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [openXmlContent])

  return (
    <>
      <Header
        onToggleSplash={() => layout.setActiveSidebar(layout.activeSidebar)}
        onNewFile={handleOpenNewFileDialog}
        onOpenFile={handleOpenFile}
        onOpenWorkspace={handleOpenWorkspace}
        onOpenUrl={handleOpenUrl}
      />

      <div className="workArea">
        <ActivityBar
          activeSidebar={layout.activeSidebar}
          onToggleSidebar={toggleSidebar}
          onToggleSettings={() => toggleSidebar('settings')}
        />
        <PanelGroup orientation="horizontal" className="workAreaPanels">
          <Panel
            panelRef={explorerRef}
            collapsible
            defaultSize="20%"
            minSize="15%"
            maxSize="40%"
            onResize={(size: PanelSize) => {
              if (!size.asPercentage || size.asPercentage <= 0) {
                layout.setActiveSidebar(null)
              }
            }}
          >
            {layout.activeSidebar === 'workspace' && <WorkspacePanel />}
            {layout.activeSidebar === 'settings' && <SettingsPanel />}
          </Panel>
          <PanelResizeHandle
            className={`resizeHandle resizeHandle-horizontal explorerResizeHandle${
              layout.activeSidebar !== null ? '' : ' hidden'
            }`}
          />
          <Panel>
            <MainContent
              showSplash={settings.showSplash}
              onDismissSplash={(alwaysShow) => {
                if (!alwaysShow) updateSettings({ showSplash: false })
              }}
            />
          </Panel>
        </PanelGroup>
      </div>

      <Footer />

      {isNewFileDialogOpen && (
        <NewFileDialog
          onCancel={handleCloseNewFileDialog}
          onCreate={(meiFriendId) => {
            layout.openFileInLayout(meiFriendId)
            setIsNewFileDialogOpen(false)
          }}
          openFileInManager={(xml, name, isNew) => workspace.openXmlContent(xml, name, isNew)}
        />
      )}

      {modeDialogState && (
        <EnableLocalWriteDialog
          onConfirm={(mode) => {
            modeDialogState.resolve(mode)
            setModeDialogState(null)
          }}
          onCancel={() => {
            modeDialogState.resolve('cancel')
            setModeDialogState(null)
          }}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".mei,.xml,.musicxml"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />
    </>
  )
}

// ── Root Component ───────────────────────────────────────────────────────

export default function App() {
  return (
    <AppProvider>
      <StatusProvider>
        <ActiveStatusManager />
        <AppContent />
      </StatusProvider>
    </AppProvider>
  )
}
