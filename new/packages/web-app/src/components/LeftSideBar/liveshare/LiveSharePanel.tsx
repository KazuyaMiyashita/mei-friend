import { useCallback, useState } from "react";
import { useFocusedContent } from "../../../context/FocusedPanelContext";
import { useLiveShare } from "../../../context/LiveShareContext";
import panelStyles from "../Panel.module.css";
import workspaceStyles from "../workspace/WorkspaceTree.module.css";
import styles from "./LiveSharePanel.module.css";

interface LiveSharePanelProps {
  onOpenFile: (id: string) => void;
}

export default function LiveSharePanel({ onOpenFile }: LiveSharePanelProps) {
  const { currentRoomId, sharedMeiFriends, leaveRoom } = useLiveShare();
  const focusedContent = useFocusedContent();
  const [copied, setCopied] = useState(false);

  const roomUrl = currentRoomId
    ? `${window.location.origin}${window.location.pathname}?share=${currentRoomId}`
    : "";

  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(roomUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [roomUrl]);

  return (
    <section className={panelStyles.panelContaioner} aria-label="Live Share">
      <div className={panelStyles.panelTitle}>LIVE SHARE</div>

      {!currentRoomId ? (
        <div className={panelStyles.panelSection}>
          <div className={panelStyles.panelSectionContent}>
            <p className={styles.emptyText}>
              You are not in a Live Share room.
            </p>
            <p className={styles.emptyText}>
              Open a file from your workspace and click "Share" to start.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className={panelStyles.panelSection}>
            <div className={panelStyles.panelSectionHeader}>Room Info:</div>
            <div className={panelStyles.panelSectionContent}>
              <div className={styles.roomInfo}>
                <span className={styles.roomId}>ID: {currentRoomId}</span>
                <button
                  type="button"
                  onClick={leaveRoom}
                  className={styles.leaveBtn}
                >
                  Leave
                </button>
              </div>
              <div className={styles.roomUrlContainer}>
                <div className={styles.roomUrlLabel}>Room URL:</div>
                <div className={styles.roomUrlInputGroup}>
                  <input
                    type="text"
                    readOnly
                    value={roomUrl}
                    className={styles.roomUrlInput}
                    onClick={(e) => e.currentTarget.select()}
                  />
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className={styles.copyBtn}
                    title="Copy URL"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div
            className={`${panelStyles.panelSection} ${panelStyles.panelSectionGrow}`}
          >
            <div className={panelStyles.panelSectionHeader}>Shared Files:</div>
            <div className={panelStyles.panelSectionContent}>
              <div className={workspaceStyles.workspaceTree}>
                {Array.from(sharedMeiFriends.entries()).map(
                  ([roomId, shared]) => {
                    const isActive = focusedContent?.id === shared.meiFriendId;
                    return (
                      <button
                        type="button"
                        key={roomId}
                        className={`${workspaceStyles.fileNode}${isActive ? ` ${workspaceStyles.active}` : ""}`}
                        style={{ paddingLeft: "8px", width: "100%" }}
                        onClick={() => onOpenFile(shared.meiFriendId)}
                        title={shared.name}
                      >
                        <span className={workspaceStyles.icon}>🎼</span>
                        <span className={workspaceStyles.name}>
                          {shared.name}
                        </span>
                        <span
                          className={workspaceStyles.openIndicator}
                          style={{ color: "var(--warningColor)" }}
                          title="Shared"
                        >
                          ●
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
