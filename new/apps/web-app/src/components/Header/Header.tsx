import logoUrl from '../../assets/menu-logo.svg'
import { useFocusedMeiFriend } from '../../features/app/layout/useFocusedMeiFriend'
import FileStatus from './FileStatus'
import MenuBar from './MenuBar'
import './Header.css'

interface HeaderProps {
  onToggleSplash: () => void
  onNewFile: () => void
  onOpenFile: () => void
  onOpenWorkspace: () => void
  onOpenUrl: () => void
}

export default function Header({
  onToggleSplash,
  onNewFile,
  onOpenFile,
  onOpenWorkspace,
  onOpenUrl,
}: HeaderProps) {
  const { snapshot: mf } = useFocusedMeiFriend()

  return (
    <header className="header">
      <div className="title">
        <img src={logoUrl} alt="mei-friend" id="mei-friend-logo" />
      </div>
      <MenuBar
        onToggleSplash={onToggleSplash}
        onNewFile={onNewFile}
        onOpenFile={onOpenFile}
        onOpenWorkspace={onOpenWorkspace}
        onOpenUrl={onOpenUrl}
      />
      <FileStatus
        schemaStatus="MEI"
        fileName={mf?.core?.fileName ?? null}
        isDirty={mf?.core?.isDirty ?? false}
      />
    </header>
  )
}
