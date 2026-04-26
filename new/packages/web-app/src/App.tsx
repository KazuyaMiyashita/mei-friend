import { useCallback, useEffect, useRef, useState } from "react";
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import styles from "./App.module.css";
import Footer from "./components/Footer/Footer";
import Header from "./components/Header/Header";
import LeftSideBar, {
  type SidebarPanel,
} from "./components/LeftSideBar/LeftSideBar";
import SettingsPanel from "./components/LeftSideBar/settings/SettingsPanel";
import WorkspacePanel from "./components/LeftSideBar/workspace/WorkspacePanel";
import MainContent from "./components/MainContent/MainContent";
import DragOverlay from "./components/Modals/DragOverlay";
import SplashOverlay from "./components/Modals/SplashOverlay";
import { AppStateProvider, useAppState } from "./context/AppStateContext";
import {
  useWorkspaceContext,
  WorkspaceProvider,
} from "./context/WorkspaceContext";

function AppContent() {
  const [activeSidebar, setActiveSidebar] = useState<SidebarPanel | null>(
    "workspace",
  );
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  const { openFileInPanel } = useAppState();
  const { addFilesFromFileList, settings } = useWorkspaceContext();
  const [showSplash, setShowSplash] = useState(() => settings.showSplash);

  const toggleSidebar = useCallback((panel: SidebarPanel) => {
    setActiveSidebar((prev) => (prev === panel ? null : panel));
  }, []);

  const handleDismissSplash = useCallback(() => {
    setShowSplash(false);
  }, []);

  const handleOpenFile = useCallback(
    (path: string) => {
      openFileInPanel(path);
    },
    [openFileInPanel],
  );

  // Global file drag-and-drop via window listeners
  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        dragCounterRef.current++;
        setIsDragOver(true);
      }
    };
    const onDragLeave = () => {
      dragCounterRef.current--;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDragOver(false);
      }
    };
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        e.preventDefault();
      }
    };
    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragOver(false);
      const files = e.dataTransfer ? Array.from(e.dataTransfer.files) : [];
      if (files.length === 0) return;
      await addFilesFromFileList(files);
      const meiFile = files.find((f) => /\.(mei|xml|musicxml)$/i.test(f.name));
      if (meiFile) openFileInPanel(meiFile.name);
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop as unknown as EventListener);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop as unknown as EventListener);
    };
  }, [addFilesFromFileList, openFileInPanel]);

  return (
    <>
      {showSplash && <SplashOverlay onDismiss={handleDismissSplash} />}
      <DragOverlay visible={isDragOver} />

      <Header />

      <div className={styles.workArea}>
        <LeftSideBar
          activeSidebar={activeSidebar}
          onToggleSidebar={toggleSidebar}
          onToggleSettings={() => toggleSidebar("settings")}
        />
        <PanelGroup orientation="horizontal" className={styles.workAreaPanels}>
          {activeSidebar !== null && (
            <>
              <Panel
                collapsible
                defaultSize={"20%"}
                minSize={"10%"}
                maxSize={"40%"}
              >
                {activeSidebar === "workspace" && (
                  <WorkspacePanel onOpenFile={handleOpenFile} />
                )}
                {activeSidebar === "settings" && <SettingsPanel />}
              </Panel>
              <PanelResizeHandle className="resizeHandle resizeHandle-horizontal" />
            </>
          )}
          <Panel>
            <MainContent />
          </Panel>
        </PanelGroup>
      </div>

      <Footer />
    </>
  );
}

export default function App() {
  return (
    // WorkspaceProvider must be the outer wrapper: AppStateProvider depends on
    // WorkspaceContext.loadFileIfNeeded to implement openFileInPanel.
    <WorkspaceProvider>
      <AppStateProvider>
        <AppContent />
      </AppStateProvider>
    </WorkspaceProvider>
  );
}
