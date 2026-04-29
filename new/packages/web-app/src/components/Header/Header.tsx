import logoUrl from "../../assets/menu-logo.svg";
import FileStatus from "./FileStatus";
import styles from "./Header.module.css";
import MenuBar from "./MenuBar";

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.title}>
        <img src={logoUrl} alt="mei-friend" id="mei-friend-logo" />
      </div>
      <MenuBar />
      <FileStatus schemaStatus="MEI" fileName="" isDirty={false} />
    </header>
  );
}
