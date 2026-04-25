import { useCallback, useEffect, useState } from "react";
import { useActiveMeiFriend, useAppState } from "../../context/AppStateContext";
import styles from "./Header.module.css";

function useDropdownState() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const handleClick = useCallback((id: string) => {
    setIsNavOpen(true);
    setOpenId(id);
  }, []);
  const handleHover = useCallback(
    (id: string) => {
      if (isNavOpen) setOpenId(id);
    },
    [isNavOpen],
  );
  const close = useCallback(() => {
    setIsNavOpen(false);
    setOpenId(null);
  }, []);
  useEffect(() => {
    if (!isNavOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest("#menuBar")) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isNavOpen, close]);
  return { openId: isNavOpen ? openId : null, handleClick, handleHover, close };
}

interface DropdownProps {
  id: string;
  label: React.ReactNode;
  isOpen: boolean;
  onClick: (id: string) => void;
  onHover: (id: string) => void;
  onClose: () => void;
  children: React.ReactNode;
}

function Dropdown({
  id,
  label,
  isOpen,
  onClick,
  onHover,
  children,
}: DropdownProps) {
  return (
    <div className={styles.dropdown}>
      <button
        type="button"
        className={`${styles.dropbtn}${isOpen ? ` ${styles.active}` : ""}`}
        id={id}
        onClick={() => onClick(id)}
        onMouseEnter={() => onHover(id)}
      >
        {label}
      </button>
      <div
        className={`${styles.dropdownContent}${isOpen ? ` ${styles.open}` : ""}`}
      >
        {children}
      </div>
    </div>
  );
}

interface MenuItemProps {
  href?: string;
  shortcut?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  onClose: () => void;
  disabled?: boolean;
}

function MenuItem({
  href = "#",
  shortcut,
  children,
  onClick,
  onClose,
  disabled,
}: MenuItemProps) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        if (!disabled) {
          onClick?.();
          onClose();
        }
      }}
      style={disabled ? { opacity: 0.4, cursor: "default" } : undefined}
      aria-disabled={disabled}
    >
      <span>{children}</span>
      {shortcut && <span className={styles.keyShortCut}>{shortcut}</span>}
    </a>
  );
}

function MenuLine() {
  return <hr className={styles.dropdownLine} />;
}

interface MenuBarProps {
  onNewFile?: () => void;
  onOpenFile?: () => void;
  onOpenWorkspace?: () => void;
  onOpenUrl?: () => void;
}

export default function MenuBar({
  onNewFile,
  onOpenFile,
  onOpenWorkspace,
  onOpenUrl,
}: MenuBarProps) {
  const { openId, handleClick, handleHover, close } = useDropdownState();
  const { activeMeiFriend, activeSelectedId } = useActiveMeiFriend();
  const { workspace, activeMeiFriendPath } = useAppState();

  const hasActiveNote = !!(activeMeiFriend && activeSelectedId);

  const handlePitchUp = useCallback(() => {
    if (!activeMeiFriendPath || !activeSelectedId) return;
    const meiFriend = workspace.getMeiFriend(activeMeiFriendPath);
    if (!meiFriend) return;
    try {
      const result = meiFriend.api.editor.pitchUp(activeSelectedId);
      meiFriend.updateBatch([
        result.note,
        ...result.accidentalCorrections.map((c) => c.element),
      ]);
    } catch {
      // ignore if element is not a note
    }
  }, [activeMeiFriendPath, activeSelectedId, workspace]);

  const handlePitchDown = useCallback(() => {
    if (!activeMeiFriendPath || !activeSelectedId) return;
    const mf = workspace.getMeiFriend(activeMeiFriendPath);
    if (!mf) return;
    try {
      const result = mf.api.editor.pitchDown(activeSelectedId);
      mf.updateBatch([
        result.note,
        ...result.accidentalCorrections.map((c) => c.element),
      ]);
    } catch {
      // ignore if element is not a note
    }
  }, [activeMeiFriendPath, activeSelectedId, workspace]);

  const item = (
    label: React.ReactNode,
    shortcut?: React.ReactNode,
    action?: () => void,
    disabled?: boolean,
  ) => (
    <MenuItem
      shortcut={shortcut}
      onClose={close}
      onClick={action}
      disabled={disabled}
    >
      {label}
    </MenuItem>
  );

  return (
    <nav className={styles.navbar} id="menuBar">
      <Dropdown
        id="fileMenuTitle"
        label="File"
        isOpen={openId === "fileMenuTitle"}
        onClick={handleClick}
        onHover={handleHover}
        onClose={close}
      >
        {item("New file", "⌃N", onNewFile)}
        {item("Open files…", "⌘O", onOpenFile)}
        {item("Open Workspace…", undefined, onOpenWorkspace)}
        {item("Open URL…", undefined, onOpenUrl)}
        <MenuLine />
        {item("Rename Workspace…", undefined)}
        {item("Save Workspace", undefined)}
        <MenuLine />
        {item("Public repertoire")}
      </Dropdown>

      <Dropdown
        id="editMenuTitle"
        label="Code"
        isOpen={openId === "editMenuTitle"}
        onClick={handleClick}
        onHover={handleHover}
        onClose={close}
      >
        {item("Undo", undefined)}
        {item("Redo", undefined)}
        <MenuLine />
        {item("Search", "⌘F")}
        {item("Replace", "⌥⌘F")}
      </Dropdown>

      <Dropdown
        id="viewMenuTitle"
        label="View"
        isOpen={openId === "viewMenuTitle"}
        onClick={handleClick}
        onHover={handleHover}
        onClose={close}
      >
        {item("Open Score", undefined)}
        {item("Open XML code", undefined)}
      </Dropdown>

      <Dropdown
        id="manipulateMenuTitle"
        label="Manipulate"
        isOpen={openId === "manipulateMenuTitle"}
        onClick={handleClick}
        onHover={handleHover}
        onClose={close}
      >
        {item("Pitch Up", "↑", handlePitchUp, !hasActiveNote)}
        {item("Pitch Down", "↓", handlePitchDown, !hasActiveNote)}
        <MenuLine />
        {item("Delete element", "⌫", undefined)}
      </Dropdown>

      <Dropdown
        id="helpMenuTitle"
        label="Help"
        isOpen={openId === "helpMenuTitle"}
        onClick={handleClick}
        onHover={handleHover}
        onClose={close}
      >
        {item("Preferences", undefined)}
        {item("About mei-friend", undefined)}
      </Dropdown>
    </nav>
  );
}
