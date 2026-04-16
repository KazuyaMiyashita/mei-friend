import { useCallback, useState } from "react";
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
import SplashOverlay from "./components/Modals/SplashOverlay";

function AppContent() {
  const [activeSidebar, setActiveSidebar] = useState<SidebarPanel | null>(
    "workspace",
  );
  const [showSplash, setShowSplash] = useState(true);

  const toggleSidebar = useCallback(
    (panel: SidebarPanel) => {
      if (activeSidebar === panel) {
        setActiveSidebar(null);
      } else {
        setActiveSidebar(panel);
      }
    },
    [activeSidebar],
  );

  const handleDismissSplash = useCallback((_alwaysShow: boolean) => {
    setShowSplash(false);
    // TODO: Persist alwaysShow preference if needed
  }, []);

  return (
    <>
      {showSplash && <SplashOverlay onDismiss={handleDismissSplash} />}

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
                {activeSidebar === "workspace" && <WorkspacePanel />}
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
  return <AppContent />;
}
