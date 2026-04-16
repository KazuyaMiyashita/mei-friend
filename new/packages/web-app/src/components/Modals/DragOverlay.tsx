import styles from "./Modals.module.css";

interface DragOverlayProps {
  visible: boolean;
}

export default function DragOverlay({ visible }: DragOverlayProps) {
  if (!visible) return null;
  return (
    <div className={styles.dragOverlay}>
      <div className={styles.dragOverlayText} id="dragOverlayText">
        Drag your input file here.
      </div>
    </div>
  );
}
