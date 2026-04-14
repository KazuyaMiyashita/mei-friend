import { useCallback, useEffect, useState } from 'react'
import { useFocusedGroup } from '../../features/app/layout/LayoutProvider'
import { useFocusedMeiFriend } from '../../features/app/layout/useFocusedMeiFriend'
import { useLayout } from '../../features/app/layout/useLayout'
import { useMeiFriendWorkspace } from '../../features/app/workspace/useMeiFriendWorkspace'
import { useWorkspaceSnapshot } from '../../features/app/workspace/WorkspaceProvider'
import { SHORTCUTS } from '../../features/keybindings/shortcuts'

interface MenuBarProps {
  onToggleSplash: () => void
  onNewFile: () => void
  onOpenFile: () => void
  onOpenWorkspace: () => void
  onOpenUrl: () => void
}

function useDropdownState() {
  const [openId, setOpenId] = useState<string | null>(null)
  const [isNavOpen, setIsNavOpen] = useState(false)
  const handleClick = useCallback((id: string) => {
    setIsNavOpen(true)
    setOpenId(id)
  }, [])
  const handleHover = useCallback(
    (id: string) => {
      if (isNavOpen) setOpenId(id)
    },
    [isNavOpen],
  )
  const close = useCallback(() => {
    setIsNavOpen(false)
    setOpenId(null)
  }, [])
  useEffect(() => {
    if (!isNavOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Element
      if (!target.closest('.navbar')) close()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isNavOpen, close])
  return { openId: isNavOpen ? openId : null, handleClick, handleHover, close }
}

interface DropdownProps {
  id: string
  label: React.ReactNode
  isOpen: boolean
  onClick: (id: string) => void
  onHover: (id: string) => void
  onClose: () => void
  children: React.ReactNode
}

function Dropdown({ id, label, isOpen, onClick, onHover, children }: DropdownProps) {
  return (
    <div className="dropdown">
      <button
        type="button"
        className={`dropbtn${isOpen ? ' active' : ''}`}
        id={id}
        onClick={() => onClick(id)}
        onMouseEnter={() => onHover(id)}
      >
        {label}
      </button>
      <div className={`dropdownContent${isOpen ? ' open' : ''}`}>{children}</div>
    </div>
  )
}

interface MenuItemProps {
  href?: string
  shortcut?: React.ReactNode
  children: React.ReactNode
  onClick?: () => void
  onClose: () => void
}

function MenuItem({ href = '#', shortcut, children, onClick, onClose }: MenuItemProps) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault()
        onClick?.()
        onClose()
      }}
    >
      <span>{children}</span>
      {shortcut && <span className="keyShortCut">{shortcut}</span>}
    </a>
  )
}

function MenuLine() {
  return <hr className="dropdownLine" />
}

export default function MenuBar({
  onToggleSplash,
  onNewFile,
  onOpenFile,
  onOpenWorkspace,
  onOpenUrl,
}: MenuBarProps) {
  const { openId, handleClick, handleHover, close } = useDropdownState()
  const layout = useLayout()
  const focusedGroup = useFocusedGroup()
  const { id: meiFriendId, instance: focusedInstance } = useFocusedMeiFriend()
  const { workspace, saveMei } = useMeiFriendWorkspace()
  const snapshot = useWorkspaceSnapshot()

  const getShortcut = (id: string) => {
    const raw = SHORTCUTS[id]?.defaultShortcut
    if (!raw) return undefined
    return raw.replace('Mod', '⌘').replace('Shift', '⇧').replace('Alt', '⌥')
  }

  const item = (label: React.ReactNode, shortcut?: React.ReactNode, action?: () => void) => (
    <MenuItem shortcut={shortcut} onClose={close} onClick={action}>
      {label}
    </MenuItem>
  )

  const handleRenameWorkspace = async () => {
    const newName = window.prompt('Enter new workspace name:', snapshot.name)
    if (newName !== null) {
      await workspace.setName(newName)
      // biome-ignore lint/suspicious/noExplicitAny: API types are complex
      const success = await workspace.runApi((api: any) =>
        api.localPersistence.saveWorkspaceConfig(),
      )
      if (success) {
        await workspace.markAsSaved()
      }
    }
  }

  const handleSaveAll = async () => {
    for (const id of workspace.getInstanceIds()) {
      await saveMei(id)
    }
  }

  const handleSaveMei = async () => {
    if (meiFriendId) await saveMei(meiFriendId)
  }

  return (
    <nav className="navbar" id="menuBar">
      <Dropdown
        id="fileMenuTitle"
        label="File"
        isOpen={openId === 'fileMenuTitle'}
        onClick={handleClick}
        onHover={handleHover}
        onClose={close}
      >
        {item('New file', '⌃N', onNewFile)}
        {item('Open files...', '⌘O', onOpenFile)}
        {item('Open Workspace...', undefined, onOpenWorkspace)}
        {item('Open URL...', undefined, onOpenUrl)}
        <MenuLine />
        {item('Rename Workspace...', undefined, handleRenameWorkspace)}
        {item('Save Workspace', undefined, handleSaveAll)}
        <MenuLine />
        {item('Public repertoire')}
        <MenuLine />
        {item('Save MEI', getShortcut('document.save'), handleSaveMei)}
        {item(
          'Save SVG',
          undefined,
          focusedInstance
            ? () =>
                // biome-ignore lint/suspicious/noExplicitAny: API types are complex
                focusedInstance.runApi((api: any) => api.fileIO.saveSvg())
            : undefined,
        )}
      </Dropdown>

      <Dropdown
        id="editMenuTitle"
        label="Code"
        isOpen={openId === 'editMenuTitle'}
        onClick={handleClick}
        onHover={handleHover}
        onClose={close}
      >
        {item(
          'Undo',
          getShortcut('document.undo'),
          focusedInstance
            ? () =>
                // biome-ignore lint/suspicious/noExplicitAny: API types are complex
                focusedInstance.runApi((api: any) => api.history.undo())
            : undefined,
        )}
        {item(
          'Redo',
          getShortcut('document.redo'),
          focusedInstance
            ? () =>
                // biome-ignore lint/suspicious/noExplicitAny: API types are complex
                focusedInstance.runApi((api: any) => api.history.redo())
            : undefined,
        )}
        <MenuLine />
        {item('Search', '⌘F')}
        {item('Replace', '⌥⌘F')}
      </Dropdown>

      <Dropdown
        id="viewMenuTitle"
        label="View"
        isOpen={openId === 'viewMenuTitle'}
        onClick={handleClick}
        onHover={handleHover}
        onClose={close}
      >
        {item('Playback controls', 'SPACE')}
        <MenuLine />
        {item(
          'Zoom In',
          getShortcut('document.zoomIn'),
          focusedInstance
            ? () =>
                // biome-ignore lint/suspicious/noExplicitAny: API types are complex
                focusedInstance.runApi((api: any) => {
                  const currentOpts = focusedInstance.getSnapshot().verovio.vrvOptions
                  if (currentOpts) api.verovio.setVrvOptions({ scale: currentOpts.scale + 5 })
                })
            : undefined,
        )}
        {item(
          'Zoom Out',
          getShortcut('document.zoomOut'),
          focusedInstance
            ? () =>
                // biome-ignore lint/suspicious/noExplicitAny: API types are complex
                focusedInstance.runApi((api: any) => {
                  const currentOpts = focusedInstance.getSnapshot().verovio.vrvOptions
                  if (currentOpts)
                    api.verovio.setVrvOptions({ scale: Math.max(10, currentOpts.scale - 5) })
                })
            : undefined,
        )}
        <MenuLine />
        {item(
          'Open XML code',
          undefined,
          focusedGroup && meiFriendId
            ? () => layout.openPanel('xmlcode', focusedGroup.id, meiFriendId)
            : undefined,
        )}
      </Dropdown>

      <Dropdown
        id="manipulateMenuTitle"
        label="Manipulate"
        isOpen={openId === 'manipulateMenuTitle'}
        onClick={handleClick}
        onHover={handleHover}
        onClose={close}
      >
        {item(
          'Delete element',
          '⌫',
          focusedInstance
            ? () =>
                // biome-ignore lint/suspicious/noExplicitAny: API types are complex
                focusedInstance.runApi((api: any) => api.meiEditor.deleteSelectedElements())
            : undefined,
        )}
      </Dropdown>

      <Dropdown
        id="helpMenuTitle"
        label="Help"
        isOpen={openId === 'helpMenuTitle'}
        onClick={handleClick}
        onHover={handleHover}
        onClose={close}
      >
        {item('Preferences', getShortcut('app.showSettings'), () =>
          layout.setActiveSidebar('settings'),
        )}
        {item('About mei-friend', undefined, onToggleSplash)}
      </Dropdown>
    </nav>
  )
}
