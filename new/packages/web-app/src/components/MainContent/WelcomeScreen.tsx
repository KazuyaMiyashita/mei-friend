import styles from "./WelcomeScreen.module.css";

export default function WelcomeScreen() {
  return (
    <div className={styles.welcomeScreen}>
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
