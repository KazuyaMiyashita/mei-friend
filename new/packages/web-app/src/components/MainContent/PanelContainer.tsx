import { pointerIntersection } from "@dnd-kit/collision";
import { useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import ContextMenu, { type ContextMenuItem } from "../ui/ContextMenu";
import styles from "./PanelContainer.module.css";
import DummyPanel from "./panels/DummyPanel";
import type { Panel, PanelContainerNode } from "./types";

export type Zone = "top" | "bottom" | "left" | "right" | "center";

// ── panel content renderer ─────────────────────────────────────────────────

function renderPanelContent(panel: Panel) {
  return <DummyPanel title={`${panel.type} Panel (${panel.id})`} />;
}

// ── PanelTabLabel ─────────────────────────────────────────────────────────

function PanelTabLabel({ panel }: { panel: Panel }) {
  const fileName = panel.meiFriendId ?? "—";

  if (panel.type === "notation")
    return (
      <>
        <span className={styles.tabTypeIcon}>𝄞</span>
        {fileName}
      </>
    );
  if (panel.type === "xmlcode")
    return (
      <>
        <span className={styles.tabTypeIcon}>&lt;/&gt;</span>
        {fileName}
      </>
    );
  if (panel.type === "annotation") return <>Annotations</>;
  if (panel.type === "facsimile")
    return (
      <>
        <span className={styles.tabTypeIcon}>🖼</span>
        {fileName}
      </>
    );
  if (panel.type === "image") {
    const imgName = panel.imagePath?.split("/").pop() ?? "—";
    return (
      <>
        <span className={styles.tabTypeIcon}>🖼</span>
        {imgName}
      </>
    );
  }
  return <>{panel.type}</>;
}

// ── DraggingInfo ───────────────────────────────────────────────────────────

export interface DraggingInfo {
  panelId: string;
  sourceContainerId: string;
  sourceTabCount: number;
}

// ── SortablePanelTab ───────────────────────────────────────────────────────

interface SortablePanelTabProps {
  panelId: string;
  index: number;
  containerId: string;
  panel: Panel;
  isActive: boolean;
  isFocused: boolean;
  onActivate: () => void;
  onClose: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function SortablePanelTab({
  panelId,
  index,
  containerId,
  panel,
  isActive,
  isFocused,
  onActivate,
  onClose,
  onContextMenu,
}: SortablePanelTabProps) {
  const isDirty = false;

  const { ref, isDragging } = useSortable({
    id: panelId,
    index,
    type: "tab",
    accept: "tab",
    group: containerId,
    data: { panelId, containerId },
  });

  return (
    // biome-ignore lint/a11y/useSemanticElements: Contains a close button
    <div
      ref={ref}
      className={`${styles.tab}${isActive ? ` ${styles.active}` : ""}${isFocused ? ` ${styles.focused}` : ""}${isDragging ? ` ${styles.dragging}` : ""}${isDirty ? ` ${styles.dirty}` : ""}`}
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate();
        }
      }}
      onContextMenu={onContextMenu}
    >
      <span className={styles.tabLabel}>
        <PanelTabLabel panel={panel} />
      </span>
      <div className={styles.tabActionArea}>
        {isDirty && <span className={styles.dirtyDot}>•</span>}
        <button
          type="button"
          className={styles.tabCloseBtn}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          title="Close"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ── DropZone ───────────────────────────────────────────────────────────────

interface DropZoneProps {
  id: string;
  zone: Zone;
  containerId: string;
  disabled: boolean;
}

function DropZone({ id, zone, containerId, disabled }: DropZoneProps) {
  const { ref, isDropTarget } = useDroppable({
    id,
    data: { containerId, zone },
    accept: "tab",
    collisionDetector: pointerIntersection,
    collisionPriority: zone === "center" ? 1 : 2,
    disabled,
  });

  const zoneClass =
    zone === "top"
      ? styles.dropZoneTop
      : zone === "bottom"
        ? styles.dropZoneBottom
        : zone === "left"
          ? styles.dropZoneLeft
          : zone === "right"
            ? styles.dropZoneRight
            : styles.dropZoneCenter;

  return (
    <div
      ref={ref}
      className={`${styles.dropZone} ${zoneClass}${
        isDropTarget && !disabled ? ` ${styles.active}` : ""
      }`}
    />
  );
}

// ── PanelContainer ─────────────────────────────────────────────────────────

interface PanelContainerProps {
  node: PanelContainerNode;
  panels: Record<string, Panel>;
  focusedPanelId: string | null;
  draggingInfo: DraggingInfo | null;
  onActivate: (panelId: string, containerId: string) => void;
  onClose: (panelId: string, containerId: string) => void;
  onFocusContainer: (containerId: string) => void;
  onNewPanel: (containerId: string) => void;
  onFileDrop: (file: File, containerId: string) => void;
}

export default function PanelContainer({
  node,
  panels,
  focusedPanelId,
  draggingInfo,
  onActivate,
  onClose,
  onFocusContainer,
  onNewPanel,
  onFileDrop,
}: PanelContainerProps) {
  const { id: containerId, tabs, activeTab } = node;
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    panelId: string;
  } | null>(null);

  const { getRootProps, isDragActive: isFileDragging } = useDropzone({
    onDrop: useCallback(
      (files: File[]) => {
        if (files[0]) onFileDrop(files[0], containerId);
      },
      [onFileDrop, containerId],
    ),
    accept: { "application/xml": [".mei", ".xml", ".musicxml"] },
    noClick: true,
    noKeyboard: true,
  });

  const handleTabContextMenu = useCallback(
    (e: React.MouseEvent, panelId: string) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, panelId });
    },
    [],
  );

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const contextMenuItems = useCallback((): ContextMenuItem[] => {
    if (!contextMenu) return [];
    return [
      {
        label: "New Tab",
        onClick: () => onNewPanel(containerId),
      },
      {
        label: "Close tab",
        onClick: () => onClose(contextMenu.panelId, containerId),
      },
    ];
  }, [contextMenu, containerId, onClose, onNewPanel]);

  const isSameContainer = draggingInfo?.sourceContainerId === containerId;
  const centerDisabled = isSameContainer ?? false;
  const edgeDisabled = isSameContainer
    ? (draggingInfo?.sourceTabCount ?? 0) <= 1
    : false;

  const { ref: tabBarRef, isDropTarget: isTabBarTarget } = useDroppable({
    id: `tabbar-${containerId}`,
    data: { containerId, zone: "center" as Zone },
    accept: "tab",
    collisionDetector: pointerIntersection,
    collisionPriority: 3,
    disabled: centerDisabled,
  });

  const activePanel = activeTab ? panels[activeTab] : null;

  return (
    <section
      {...getRootProps()}
      className={styles.panelContainer}
      onClick={() => onFocusContainer(containerId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onFocusContainer(containerId);
        }
      }}
      aria-label="Panel Container"
    >
      <div
        ref={tabBarRef}
        className={`${styles.tabBar}${isTabBarTarget && !centerDisabled ? ` ${styles.dropTarget}` : ""}`}
      >
        {tabs.map((panelId: string, index: number) => {
          const panel = panels[panelId];
          if (!panel) return null;
          return (
            <SortablePanelTab
              key={panelId}
              panelId={panelId}
              index={index}
              containerId={containerId}
              panel={panel}
              isActive={panelId === activeTab}
              isFocused={panelId === focusedPanelId}
              onActivate={() => onActivate(panelId, containerId)}
              onClose={() => onClose(panelId, containerId)}
              onContextMenu={(e) => handleTabContextMenu(e, panelId)}
            />
          );
        })}
      </div>
      <div
        className={`${styles.panelContentArea}${draggingInfo ? ` ${styles.dragging}` : ""}`}
      >
        {activePanel ? (
          <div className={styles.panelContent}>
            {renderPanelContent(activePanel)}
          </div>
        ) : (
          <div className={styles.emptyPanel}>
            <span>Drop a tab here</span>
          </div>
        )}
        <DropZone
          id={`drop-top-${containerId}`}
          zone="top"
          containerId={containerId}
          disabled={edgeDisabled}
        />
        <DropZone
          id={`drop-bottom-${containerId}`}
          zone="bottom"
          containerId={containerId}
          disabled={edgeDisabled}
        />
        <DropZone
          id={`drop-left-${containerId}`}
          zone="left"
          containerId={containerId}
          disabled={edgeDisabled}
        />
        <DropZone
          id={`drop-right-${containerId}`}
          zone="right"
          containerId={containerId}
          disabled={edgeDisabled}
        />
        <DropZone
          id={`drop-center-${containerId}`}
          zone="center"
          containerId={containerId}
          disabled={centerDisabled}
        />
      </div>
      {isFileDragging && <div className={styles.fileDropOverlay} />}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems()}
          onClose={closeContextMenu}
        />
      )}
    </section>
  );
}
