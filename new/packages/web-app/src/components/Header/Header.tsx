import logoUrl from "../../assets/menu-logo.svg";
import FileStatus from "./FileStatus";
import styles from "./Header.module.css";
import MenuBar from "./MenuBar";

interface HeaderProps {
  onToggleSplash?: () => void;
  onNewFile?: () => void;
  onOpenFile?: () => void;
  onOpenWorkspace?: () => void;
  onOpenUrl?: () => void;
}

export default function Header({
  onNewFile,
  onOpenFile,
  onOpenWorkspace,
  onOpenUrl,
}: HeaderProps) {
  const fileName = "sample.mei";
  const isDirty = true;

  return (
    <header className={styles.header}>
      <div className={styles.title}>
        <img src={logoUrl} alt="mei-friend" id="mei-friend-logo" />
      </div>
      <MenuBar
        onNewFile={onNewFile}
        onOpenFile={onOpenFile}
        onOpenWorkspace={onOpenWorkspace}
        onOpenUrl={onOpenUrl}
      />
      <FileStatus schemaStatus="MEI" fileName={fileName} isDirty={isDirty} />
    </header>
  );
}
