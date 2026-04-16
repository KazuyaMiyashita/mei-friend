import styles from "./Header.module.css";

interface FileStatusProps {
  schemaStatus: string | null;
  fileName: string | null;
  isDirty: boolean;
}

export default function FileStatus({
  schemaStatus,
  fileName,
  isDirty,
}: FileStatusProps) {
  return (
    <div
      className={`${styles.fileStatus}${isDirty ? ` ${styles.changed}` : ""}`}
    >
      <span className={styles.schemaStatus}>{schemaStatus ?? "?"}</span>
      {isDirty && <span title="File has unsaved changes">*</span>}
      <span className={styles.fileName}>{fileName ?? ""}</span>
    </div>
  );
}
