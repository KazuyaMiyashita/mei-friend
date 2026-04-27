import { useCallback, useEffect, useState } from "react";
import { useActiveMeiFriend } from "../../context/AppStateContext";
import { useWorkspaceContext } from "../../context/WorkspaceContext";
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
  onOpenFile?: () => void;
  onOpenWorkspace?: () => void;
  onSaveWorkspace?: () => void;
}

export default function MenuBar({
  onOpenFile,
  onOpenWorkspace,
  onSaveWorkspace,
}: MenuBarProps) {
  const { openId, handleClick, handleHover, close } = useDropdownState();
  const {
    activeMeiFriend,
    activeSelectedId,
    activeMeiFriendPath,
    canUndo,
    canRedo,
  } = useActiveMeiFriend();
  // workspace is needed for pitch operations — sourced from WorkspaceContext
  // rather than AppStateContext since it is part of the data layer.
  const { workspace } = useWorkspaceContext();

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
        {item("New file", "⌃N", () => {}, true)}
        {item("Open files…", "⌘O", onOpenFile)}
        {item("Open Workspace…", undefined, onOpenWorkspace)}
        {item("Open URL…", undefined, () => {}, true)}
        <MenuLine />
        {item("Save Workspace", "⌘S", onSaveWorkspace)}
        <MenuLine />
        {item("Public repertoire", undefined, () => {}, true)}
      </Dropdown>

      <Dropdown
        id="editMenuTitle"
        label="Code"
        isOpen={openId === "editMenuTitle"}
        onClick={handleClick}
        onHover={handleHover}
        onClose={close}
      >
        {item("Undo", "⌘Z", () => activeMeiFriend?.undo(), !canUndo)}
        {item("Redo", "⇧⌘Z", () => activeMeiFriend?.redo(), !canRedo)}
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
      </Dropdown>

      <Dropdown
        id="helpMenuTitle"
        label="Help"
        isOpen={openId === "helpMenuTitle"}
        onClick={handleClick}
        onHover={handleHover}
        onClose={close}
      >
        {item("Preferences", undefined, () => {}, true)}
        {item("About mei-friend", undefined, () => {}, true)}
      </Dropdown>
    </nav>
  );
}
