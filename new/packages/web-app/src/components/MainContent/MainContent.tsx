import { DragDropProvider } from "@dnd-kit/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFocusedPanel } from "../../context/FocusedPanelContext";
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
  const { registerPanelOpener, setFocusedPanelId, setPanelContent } =
    useFocusedPanel();
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
    openOrActivateContent,
    openCodeMirrorForPanel,
  } = useLayout(INITIAL_STATE);

  // Register the panel opener so Sidebar panels can trigger it via context
  useEffect(() => {
    const unregister = registerPanelOpener((content) => {
      openOrActivateContent(content);
    });
    return () => unregister();
  }, [registerPanelOpener, openOrActivateContent]);

  // Sync FocusedPanelContext with our internal layout state
  useEffect(() => {
    setFocusedPanelId(layoutState.focusedPanelId);

    // Sync all panel contents to context for other hooks (like useFocusedContent)
    for (const [id, panel] of Object.entries(layoutState.panels)) {
      if (panel.type === "verovio" || panel.type === "codemirror") {
        setPanelContent(id, { type: "mei", id: panel.meiFriendId || "" });
      } else if (panel.type === "image") {
        setPanelContent(id, { type: "image", id: panel.imagePath || "" });
      }
    }
  }, [
    layoutState.focusedPanelId,
    layoutState.panels,
    setFocusedPanelId,
    setPanelContent,
  ]);

  // When the workspace is replaced (Open Workspace), reset all panels
  useEffect(() => {
    const unregister = registerResetHandler(() => {
      setLayoutState(INITIAL_STATE);
    });
    return () => unregister();
  }, [registerResetHandler, setLayoutState]);

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

  // ── Panel activation ─────────────────────────────────────────────────────

  const handleActivate = useCallback(
    (panelId: string, containerId: string) => {
      setActivePanel(panelId, containerId);
    },
    [setActivePanel],
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
