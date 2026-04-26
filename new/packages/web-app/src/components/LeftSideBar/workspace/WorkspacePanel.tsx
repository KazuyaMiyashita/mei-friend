import { useCallback } from "react";
import { useAppState, useWorkspace } from "../../../context/AppStateContext";
import panelStyles from "../Panel.module.css";
import styles from "./WorkspacePanel.module.css";
import WorkspaceTree from "./WorkspaceTree";

interface WorkspacePanelProps {
  onOpenFile: (path: string) => void;
}

export default function WorkspacePanel({ onOpenFile }: WorkspacePanelProps) {
  const { name, entries } = useWorkspace();
  const { activeMeiFriendPath } = useAppState();

  const handleFileClick = useCallback(
    (path: string) => {
      onOpenFile(path);
    },
    [onOpenFile],
  );

  return (
    <section
      className={panelStyles.panelContaioner}
      aria-label="Workspace Explorer"
    >
      <div className={panelStyles.panelTitle}>WORKSPACE</div>

      <div className={panelStyles.panelSection}>
        <div className={panelStyles.panelSectionHeader}>Workspace Name:</div>
        <div className={panelStyles.panelSectionContent}>
          {name ? name.toUpperCase() : ""}
        </div>
      </div>

      <div
        className={`${panelStyles.panelSection} ${panelStyles.panelSectionGrow}`}
      >
        <div className={panelStyles.panelSectionHeader}>Files:</div>
        <div className={panelStyles.panelSectionContent}>
          {entries.length === 0 ? (
            <div className={styles.explorerEmpty}>
              No files open. Use File → Open files… or drop files here.
            </div>
          ) : (
            <div className={styles.explorerFileList}>
              <WorkspaceTree
                entries={entries}
                activePath={activeMeiFriendPath}
                onFileClick={handleFileClick}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
