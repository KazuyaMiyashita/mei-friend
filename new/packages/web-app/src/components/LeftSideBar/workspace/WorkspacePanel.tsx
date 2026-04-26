import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useAppState, useWorkspace } from "../../../context/AppStateContext";
import panelStyles from "../Panel.module.css";
import styles from "./WorkspacePanel.module.css";
import WorkspaceTree from "./WorkspaceTree";

interface WorkspacePanelProps {
  onOpenFile: (path: string) => void;
}

export default function WorkspacePanel({ onOpenFile }: WorkspacePanelProps) {
  const { name, entries } = useWorkspace();
  const {
    activeMeiFriendPath,

    addFilesFromFileList,
  } = useAppState();

  const { getRootProps, isDragActive } = useDropzone({
    onDrop: useCallback(
      async (files: File[]) => {
        await addFilesFromFileList(files);
        const meiFile = files.find((f) =>
          /\.(mei|xml|musicxml)$/i.test(f.name),
        );
        if (meiFile) onOpenFile(meiFile.name);
      },
      [addFilesFromFileList, onOpenFile],
    ),
    accept: {
      "application/xml": [".mei", ".xml", ".musicxml"],
      "image/*": [".jpg", ".jpeg", ".png", ".svg", ".gif"],
    },
    noClick: true,
    noKeyboard: true,
  });

  const handleFileClick = useCallback(
    (path: string) => {
      onOpenFile(path);
    },
    [onOpenFile],
  );

  return (
    <section
      {...getRootProps()}
      className={`${panelStyles.panelContaioner}${isDragActive ? ` ${styles["explorerPanel--dropTarget"]}` : ""}`}
      aria-label="Workspace Explorer"
    >
      {isDragActive && (
        <div className={styles.explorerDropOverlay}>
          <div className={styles.explorerDropOverlayText}>Drop files here</div>
        </div>
      )}

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
