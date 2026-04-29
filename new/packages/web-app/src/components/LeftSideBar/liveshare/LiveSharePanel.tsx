import { useFocusedContent } from "../../../context/FocusedPanelContext";
import { useLiveShare } from "../../../context/LiveShareContext";
import panelStyles from "../Panel.module.css";
import styles from "./LiveSharePanel.module.css";

interface LiveSharePanelProps {
  onOpenFile: (id: string) => void;
}

export default function LiveSharePanel({ onOpenFile }: LiveSharePanelProps) {
  const { currentRoomId, sharedMeiFriends, leaveRoom } = useLiveShare();
  const focusedContent = useFocusedContent();

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
            </div>
          </div>

          <div
            className={`${panelStyles.panelSection} ${panelStyles.panelSectionGrow}`}
          >
            <div className={panelStyles.panelSectionHeader}>Shared Files:</div>
            <div className={panelStyles.panelSectionContent}>
              <ul className={styles.fileList}>
                {Array.from(sharedMeiFriends.entries()).map(([id, shared]) => {
                  const isActive = focusedContent?.id === id;
                  return (
                    // biome-ignore lint/a11y/useKeyWithClickEvents: file selection
                    <li
                      key={id}
                      className={`${styles.fileItem}${isActive ? ` ${styles.active}` : ""}`}
                      onClick={() => onOpenFile(id)}
                    >
                      <span className={styles.fileName}>{shared.name}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
