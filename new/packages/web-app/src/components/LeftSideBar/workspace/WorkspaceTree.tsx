import styles from "./WorkspaceTree.module.css";

export default function WorkspaceTree() {
  return (
    <div className={styles.workspaceTree}>
      <div className={styles.workspaceEntry}>sample.mei</div>
      <div className={styles.workspaceEntry}>facsimile.jpg</div>
    </div>
  );
}
