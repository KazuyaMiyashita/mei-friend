import { DragDropProvider } from "@dnd-kit/react";
import { useCallback, useMemo, useRef } from "react";
import styles from "./MainContent.module.css";
import SplitLayout from "./SplitLayout";
import type { LayoutState } from "./types";
import { useLayout } from "./useLayout";
import { usePanelDnD } from "./usePanelDnD";
import WelcomeScreen from "./WelcomeScreen";

const INITIAL_STATE: LayoutState = {
  layout: {
    type: "container",
    id: "container-1",
    tabs: ["panel-1"],
    activeTab: "panel-1",
  },
  panels: {
    "panel-1": { id: "panel-1", type: "notation", meiFriendId: "sample.mei" },
  },
  focusedPanelId: "panel-1",
};

export default function MainContent() {
  const {
    layoutState,
    setActivePanel,
    closePanel,
    reorderPanelInContainer,
    movePanelToContainer,
    splitContainer,
    addNewPanelToContainer,
  } = useLayout(INITIAL_STATE);

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
    async (_file: File, _containerId: string | null) => {
      // Logic for actual file drop omitted as requested
    },
    [],
  );

  // ── Callbacks ────────────────────────────────────────────────────────

  const callbacks = useMemo(
    () => ({
      onActivate: setActivePanel,
      onClose: closePanel,
      onFocusContainer: (_containerId: string) => {
        /* Not strictly needed for prototype */
      },
      onNewPanel: addNewPanelToContainer,
      onFileDrop: handleFileDrop,
    }),
    [setActivePanel, closePanel, addNewPanelToContainer, handleFileDrop],
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
