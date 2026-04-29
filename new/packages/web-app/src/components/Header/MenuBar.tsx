import { useCallback, useEffect, useState } from "react";
import { useApplication } from "../../context/ApplicationContext";
import { useAppSettings } from "../../context/AppSettingsContext";
import { useFocusedMeiFriend } from "../../context/MeiFriendRegistryContext";
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

export default function MenuBar() {
  const { openId, handleClick, handleHover, close } = useDropdownState();
  const {
    meiFriend: focusedMeiFriend,
    state: focusedState,
    canUndo,
    canRedo,
  } = useFocusedMeiFriend();
  const { navigateEnabled, setNavigateEnabled } = useAppSettings();

  const {
    openFilePicker,
    openWorkspace,
    saveWorkspace,
    undo,
    redo,
    pitchUp,
    pitchDown,
    pitchOctaveUp,
    pitchOctaveDown,
    pitchChromaticUp,
    pitchChromaticDown,
    nextBeat,
    nextEvent,
    prevBeat,
    prevEvent,
    staffUpSnapToBeat,
    staffUpSnapToEvent,
    staffDownSnapToBeat,
    staffDownSnapToEvent,
    sendToLiveShare,
    addToWorkspace,
  } = useApplication();

  const focusedSelectionId = focusedState?.selectionId;
  const hasFocusedNote = !!(focusedMeiFriend && focusedSelectionId);
  const hasCursor = !!(focusedMeiFriend && focusedState?.cursor);

  const isWorkspaceFile = focusedState?.source === "workspace";
  const isSharedFile = focusedState?.source === "live-share";

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
        {item("Open files…", "⌘O", openFilePicker)}
        {item("Open Workspace…", undefined, openWorkspace)}
        {item("Open URL…", undefined, () => {}, true)}
        <MenuLine />
        {item("Save Workspace", "⌘S", saveWorkspace)}
        <MenuLine />
        {item("Public repertoire", undefined, () => {}, true)}
      </Dropdown>

      <Dropdown
        id="editMenuTitle"
        label="Edit"
        isOpen={openId === "editMenuTitle"}
        onClick={handleClick}
        onHover={handleHover}
        onClose={close}
      >
        {item("Undo", "⌘Z", undo, !canUndo)}
        {item("Redo", "⇧⌘Z", redo, !canRedo)}
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
        {item("Pitch Up", "⌥ ↑", pitchUp, !hasFocusedNote)}
        {item("Pitch Down", "⌥ ↓", pitchDown, !hasFocusedNote)}
        {item("Pitch Octave Up", "⌥ ⌘ ↑", pitchOctaveUp, !hasFocusedNote)}
        {item("Pitch Octave Down", "⌥ ⌘ ↓", pitchOctaveDown, !hasFocusedNote)}
        {item("Pitch Chromatic Up", "⌥ ⇧ ↑", pitchChromaticUp, !hasFocusedNote)}
        {item(
          "Pitch Chromatic Down",
          "⌥ ⇧ ↓",
          pitchChromaticDown,
          !hasFocusedNote,
        )}
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
        <MenuLine />
        {item("Next Beat", "⇧→", nextBeat, !hasCursor)}
        {item("Next Event", "→", nextEvent, !hasCursor)}
        {item("Previous Beat", "⇧←", prevBeat, !hasCursor)}
        {item("Previous Event", "←", prevEvent, !hasCursor)}
        <MenuLine />
        {item("Staff Up (Snap to Beat)", "⇧↑", staffUpSnapToBeat, !hasCursor)}
        {item("Staff Up (Snap to Event)", "↑", staffUpSnapToEvent, !hasCursor)}
        {item(
          "Staff Down (Snap to Beat)",
          "⇧↓",
          staffDownSnapToBeat,
          !hasCursor,
        )}
        {item(
          "Staff Down (Snap to Event)",
          "↓",
          staffDownSnapToEvent,
          !hasCursor,
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
          sendToLiveShare,
          !isWorkspaceFile,
        )}
        {item("Add to Workspace", undefined, addToWorkspace, !isSharedFile)}
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
