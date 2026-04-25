import { DragDropProvider } from "@dnd-kit/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAppState } from "../../context/AppStateContext";
import styles from "./MainContent.module.css";
import SplitLayout from "./SplitLayout";
import type { LayoutState } from "./types";
import { useLayout } from "./useLayout";
import { usePanelDnD } from "./usePanelDnD";
import WelcomeScreen from "./WelcomeScreen";

const INITIAL_STATE: LayoutState = {
  layout: null,
  panels: {},
  focusedPanelId: null,
};

export default function MainContent() {
  const {
    registerPanelOpener,
    setActiveMeiFriendPath,
    setActiveSelectedId,
    addFilesFromFileList,
  } = useAppState();

  const {
    layoutState,
    setActivePanel,
    closePanel,
    reorderPanelInContainer,
    movePanelToContainer,
    splitContainer,
    addNewPanelToContainer,
    openOrActivateFile,
    openCodeMirrorForPanel,
  } = useLayout(INITIAL_STATE);

  // Register the panel opener so WorkspacePanel can trigger it via context
  useEffect(() => {
    const unregister = registerPanelOpener((path) => {
      openOrActivateFile(path);
      setActiveMeiFriendPath(path);
    });
    return () => unregister();
  }, [registerPanelOpener, openOrActivateFile, setActiveMeiFriendPath]);

  // Synchronously update on render to prevent stale closures in DnD handlers
  const layoutStateRef = useRef(layoutState);
  layoutStateRef.current = layoutState;

  // ── Panel DnD ────────────────────────────────────────────────────────────

  const { draggingInfo, handleDragStart, handleDragEnd, handleDragOver } =
    usePanelDnD(layoutStateRef, {
      movePanelToContainer,
      splitContainer,
      reorderPanelInContainer,
    });

  // ── File Drop ──────────────────────────────────────────────────────

  const handleFileDrop = useCallback(
    async (file: File, _containerId: string | null) => {
      await addFilesFromFileList([file]);
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (ext === "mei" || ext === "xml" || ext === "musicxml") {
        openOrActivateFile(file.name);
        setActiveMeiFriendPath(file.name);
        setActiveSelectedId(null);
      }
    },
    [
      addFilesFromFileList,
      openOrActivateFile,
      setActiveMeiFriendPath,
      setActiveSelectedId,
    ],
  );

  // ── Panel activation ─────────────────────────────────────────────────────

  const handleActivate = useCallback(
    (panelId: string, containerId: string) => {
      setActivePanel(panelId, containerId);
      const panel = layoutState.panels[panelId];
      setActiveMeiFriendPath(panel?.meiFriendId ?? null);
      setActiveSelectedId(null);
    },
    [
      setActivePanel,
      layoutState.panels,
      setActiveMeiFriendPath,
      setActiveSelectedId,
    ],
  );

  // ── Callbacks ────────────────────────────────────────────────────────

  const callbacks = useMemo(
    () => ({
      onActivate: handleActivate,
      onClose: closePanel,
      onFocusContainer: (_containerId: string) => {},
      onNewPanel: addNewPanelToContainer,
      onOpenCodeMirror: openCodeMirrorForPanel,
      onFileDrop: handleFileDrop,
    }),
    [
      handleActivate,
      closePanel,
      addNewPanelToContainer,
      openCodeMirrorForPanel,
      handleFileDrop,
    ],
  );

  return (
    <div className={styles.dragContainer}>
      <DragDropProvider
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <main
          className={styles.friendContainer}
          id="friendContainer"
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files")) e.preventDefault();
          }}
        >
          {layoutState.layout === null ? (
            <WelcomeScreen onFileDrop={(file) => handleFileDrop(file, null)} />
          ) : (
            <SplitLayout
              node={layoutState.layout}
              panels={layoutState.panels}
              focusedPanelId={layoutState.focusedPanelId}
              draggingInfo={draggingInfo}
              callbacks={callbacks}
            />
          )}
        </main>
      </DragDropProvider>
    </div>
  );
}
