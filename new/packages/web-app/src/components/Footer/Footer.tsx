import styles from "./Footer.module.css";

const VERSION = "6.0.0-beta";
const VERSION_DATE = "April 2026";
const VEROVIO_VERSION = "6.1.0";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      {/* Left: hosting info */}
      <div className={styles.leftfoot}>Hosting info.</div>

      {/* Middle: status bar */}
      <div className={styles.middlefoot}>
        <div className={styles.statusBar}>Ready.</div>
      </div>

      {/* Right: version info */}
      <div className={styles.rightfoot} id="rightFooter">
        <a
          href="https://github.com/mei-friend/mei-friend"
          target="_blank"
          rel="noreferrer"
        >
          mei-friend {VERSION}
        </a>{" "}
        ({VERSION_DATE}).{" "}
        <a
          href={`https://github.com/rism-digital/verovio/releases/tag/version-${VEROVIO_VERSION}`}
          target="_blank"
          rel="noreferrer"
        >
          Verovio {VEROVIO_VERSION}
        </a>
        .
      </div>
    </footer>
  );
}
