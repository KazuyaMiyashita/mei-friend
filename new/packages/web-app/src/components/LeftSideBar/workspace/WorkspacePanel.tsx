import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useAppState, useWorkspace } from "../../../context/AppStateContext";
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
      className={`${styles.explorerPanel}${isDragActive ? ` ${styles["explorerPanel--dropTarget"]}` : ""}`}
      aria-label="Workspace Explorer"
    >
      {isDragActive && (
        <div className={styles.explorerDropOverlay}>
          <div className={styles.explorerDropOverlayText}>Drop files here</div>
        </div>
      )}

      <div className={styles.explorerTitle}>
        {name ? name.toUpperCase() : "WORKSPACE"}
      </div>

      <div className={styles.explorerSection}>
        <div className={styles.explorerSectionHeader}>FILES</div>
        <div className={styles.explorerSectionContent}>
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
