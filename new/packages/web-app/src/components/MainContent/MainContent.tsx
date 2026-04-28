import { DragDropProvider } from "@dnd-kit/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFocus } from "../../context/FocusContext";
import { useWorkspaceContext } from "../../context/WorkspaceContext";
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
  const { registerPanelOpener, setFocusedLocation, setFocusedPanelId } =
    useFocus();
  const { registerResetHandler } = useWorkspaceContext();

  const {
    layoutState,
    setLayoutState,
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
    const unregister = registerPanelOpener((location) => {
      openOrActivateFile(location);
      setFocusedLocation(location);
    });
    return () => unregister();
  }, [registerPanelOpener, openOrActivateFile, setFocusedLocation]);

  // When the workspace is replaced (Open Workspace), reset all panels and
  // clear the focus so the UI starts from a clean slate.
  useEffect(() => {
    const unregister = registerResetHandler(() => {
      setLayoutState(INITIAL_STATE);
      setFocusedLocation(null);
    });
    return () => unregister();
  }, [registerResetHandler, setLayoutState, setFocusedLocation]);

  // Synchronously update on render to prevent stale closures in DnD handlers
  const layoutStateRef = useRef(layoutState);
  layoutStateRef.current = layoutState;

  useEffect(() => {
    setFocusedPanelId(layoutState.focusedPanelId);
  }, [layoutState.focusedPanelId, setFocusedPanelId]);

  // ── Panel DnD ────────────────────────────────────────────────────────────

  const { draggingInfo, handleDragStart, handleDragEnd, handleDragOver } =
    usePanelDnD(layoutStateRef, {
      movePanelToContainer,
      splitContainer,
      reorderPanelInContainer,
    });

  // ── Panel activation ─────────────────────────────────────────────────────

  const handleActivate = useCallback(
    (panelId: string, containerId: string) => {
      setActivePanel(panelId, containerId);
      const panel = layoutState.panels[panelId];
      if (panel?.meiFriendId) {
        setFocusedLocation(panel.meiFriendId);
      }
    },
    [setActivePanel, layoutState.panels, setFocusedLocation],
  );

  // ── Callbacks ────────────────────────────────────────────────────────

  const callbacks = useMemo(
    () => ({
      onActivate: handleActivate,
      onClose: closePanel,
      onFocusContainer: (_containerId: string) => {},
      onNewPanel: addNewPanelToContainer,
      onOpenCodeMirror: openCodeMirrorForPanel,
    }),
    [
      handleActivate,
      closePanel,
      addNewPanelToContainer,
      openCodeMirrorForPanel,
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
            <WelcomeScreen />
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
