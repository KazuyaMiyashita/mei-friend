import { useCallback, useEffect, useState } from "react";
import { useFocus, useFocusedMeiFriend } from "../../context/FocusContext";
import { useLiveShare } from "../../context/LiveShareContext";
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
    focusedMeiFriend,
    focusedSelectionId,
    focusedLocation,
    canUndo,
    canRedo,
  } = useFocusedMeiFriend();
  const { workspace } = useWorkspaceContext();
  const { navigateEnabled, setNavigateEnabled } = useFocus();

  const { sendToLiveShare, addToWorkspace } = useLiveShare();

  const hasFocusedNote = !!(focusedMeiFriend && focusedSelectionId);

  const handlePitchUp = useCallback(() => {
    if (!focusedMeiFriend || !focusedSelectionId) return;
    try {
      const result = focusedMeiFriend.api.editor.pitchUp(focusedSelectionId);
      focusedMeiFriend.updateBatch([
        result.note,
        ...result.accidentalCorrections.map((c) => c.element),
      ]);
    } catch {
      // ignore if element is not a note
    }
  }, [focusedMeiFriend, focusedSelectionId]);

  const handlePitchDown = useCallback(() => {
    if (!focusedMeiFriend || !focusedSelectionId) return;
    try {
      const result = focusedMeiFriend.api.editor.pitchDown(focusedSelectionId);
      focusedMeiFriend.updateBatch([
        result.note,
        ...result.accidentalCorrections.map((c) => c.element),
      ]);
    } catch {
      // ignore if element is not a note
    }
  }, [focusedMeiFriend, focusedSelectionId]);

  const handleSendToLiveShare = useCallback(async () => {
    if (focusedMeiFriend && focusedLocation?.source === "workspace") {
      const entry = workspace.entries.find((e) => e.id === focusedLocation.id);
      const name = entry?.path.split("/").pop() ?? "Untitled";
      const roomId = await sendToLiveShare(focusedMeiFriend, name);
      alert(
        `Shared! Room ID: ${roomId}\nURL: ${window.location.origin}${window.location.pathname}?share=${roomId}`,
      );
    }
  }, [focusedMeiFriend, focusedLocation, sendToLiveShare, workspace.entries]);

  const handleAddToWorkspace = useCallback(async () => {
    if (focusedLocation?.source === "live-share") {
      await addToWorkspace(focusedLocation.id);
      alert("Added to workspace!");
    }
  }, [focusedLocation, addToWorkspace]);

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
        {item("Undo", "⌘Z", () => focusedMeiFriend?.undo(), !canUndo)}
        {item("Redo", "⇧⌘Z", () => focusedMeiFriend?.redo(), !canRedo)}
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
        {item("Pitch Up", "↑", handlePitchUp, !hasFocusedNote)}
        {item("Pitch Down", "↓", handlePitchDown, !hasFocusedNote)}
      </Dropdown>

      <Dropdown
        id="toolMenuTitle"
        label="Tool"
        isOpen={openId === "toolMenuTitle"}
        onClick={handleClick}
        onHover={handleHover}
        onClose={close}
      >
        {item(
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="checkbox"
              checked={navigateEnabled}
              readOnly
              style={{ pointerEvents: "none" }}
            />
            Navigate
          </div>,
          undefined,
          () => setNavigateEnabled(!navigateEnabled),
        )}
      </Dropdown>

      <Dropdown
        id="shareMenuTitle"
        label="Share"
        isOpen={openId === "shareMenuTitle"}
        onClick={handleClick}
        onHover={handleHover}
        onClose={close}
      >
        {item(
          "Send to Live Share",
          undefined,
          handleSendToLiveShare,
          focusedLocation?.source !== "workspace",
        )}
        {item(
          "Add to Workspace",
          undefined,
          handleAddToWorkspace,
          focusedLocation?.source !== "live-share",
        )}
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
