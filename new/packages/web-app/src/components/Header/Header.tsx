import logoUrl from "../../assets/menu-logo.svg";
import { useWorkspaceContext } from "../../context/WorkspaceContext";
import FileStatus from "./FileStatus";
import styles from "./Header.module.css";
import MenuBar from "./MenuBar";

export default function Header() {
  const { addFilesFromPicker, openWorkspaceFromDirectory, saveWorkspace } =
    useWorkspaceContext();

  return (
    <header className={styles.header}>
      <div className={styles.title}>
        <img src={logoUrl} alt="mei-friend" id="mei-friend-logo" />
      </div>
      <MenuBar
        onOpenFile={addFilesFromPicker}
        onOpenWorkspace={openWorkspaceFromDirectory}
        onSaveWorkspace={saveWorkspace}
      />
      <FileStatus schemaStatus="MEI" fileName="" isDirty={false} />
    </header>
  );
}
