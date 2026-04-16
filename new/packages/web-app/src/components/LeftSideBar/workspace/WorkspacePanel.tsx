import styles from "./WorkspacePanel.module.css";

export default function WorkspacePanel() {
  return (
    <section className={styles.explorerPanel} aria-label="Workspace Explorer">
      <div className={styles.explorerTitle}>WORKSPACE</div>

      <div className={styles.explorerSection}>
        <div className={styles.explorerSectionHeader}>FILES</div>
        <div className={styles.explorerSectionContent}>
          <div className={styles.explorerEmpty}>Mock Workspace Panel</div>
          <ul
            style={{
              listStyle: "none",
              padding: "8px",
              margin: 0,
              color: "#ccc",
              fontSize: "13px",
            }}
          >
            <li style={{ padding: "4px 0" }}>📄 sample.mei</li>
            <li style={{ padding: "4px 0" }}>🖼 facsimile.jpg</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
