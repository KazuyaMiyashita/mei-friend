import styles from "./DummyPanel.module.css";

export default function DummyPanel({
  title = "Dummy Panel",
}: {
  title?: string;
}) {
  return (
    <div className={styles.panel}>
      <div className={styles.welcomeContent}>{title}</div>
    </div>
  );
}
