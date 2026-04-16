import { useDropzone } from "react-dropzone";
import styles from "./WelcomeScreen.module.css";

interface WelcomeScreenProps {
  onFileDrop: (file: File) => void;
}

export default function WelcomeScreen({ onFileDrop }: WelcomeScreenProps) {
  const { getRootProps, isDragActive } = useDropzone({
    onDrop: (files) => {
      if (files[0]) onFileDrop(files[0]);
    },
    accept: { "application/xml": [".mei", ".xml", ".musicxml"] },
    noClick: true,
    noKeyboard: true,
  });

  return (
    <div
      {...getRootProps()}
      className={`${styles.welcomeScreen}${isDragActive ? ` ${styles.fileDragging}` : ""}`}
    >
      <div className={styles.welcomeContent}>
        <p className={styles.welcomeHint}>Drop files here</p>
        <p className={styles.welcomeOr}>or</p>
        <p className={styles.welcomeMenu}>
          Select a file from File → Open file
        </p>
      </div>
    </div>
  );
}
