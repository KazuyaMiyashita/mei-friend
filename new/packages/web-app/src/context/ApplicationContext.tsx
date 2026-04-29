import { createContext, useCallback, useContext } from "react";
import { type PanelContent, useFocusedPanel } from "./FocusedPanelContext";
import { useLiveShare } from "./LiveShareContext";
import { useFocusedMeiFriend } from "./MeiFriendRegistryContext";
import { useWorkspaceContext } from "./WorkspaceContext";

export interface ApplicationContextValue {
  openFilePicker: () => Promise<void>;
  openWorkspace: () => Promise<void>;
  saveWorkspace: () => Promise<void>;
  openContent: (content: PanelContent) => Promise<void>;
  pitchUp: () => void;
  pitchDown: () => void;
  sendToLiveShare: () => Promise<void>;
  addToWorkspace: () => Promise<void>;
}

const ApplicationContext = createContext<ApplicationContextValue | null>(null);

export function ApplicationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspace = useWorkspaceContext();
  const liveShare = useLiveShare();
  const focusedPanel = useFocusedPanel();
  const { meiFriend: focusedMeiFriend, state: focusedState } =
    useFocusedMeiFriend();

  const focusedContent = focusedPanel.focusedPanelId
    ? focusedPanel.panels[focusedPanel.focusedPanelId]
    : null;

  const openContent = useCallback(
    async (content: PanelContent) => {
      focusedPanel.openContentInPanel(content);
    },
    [focusedPanel],
  );

  const openFilePicker = useCallback(async () => {
    const addedEntries = await workspace.addFilesFromPicker();
    if (addedEntries && addedEntries.length > 0) {
      const firstMei = addedEntries.find((e) => e.type === "MEI");
      if (firstMei?.meiFriendId) {
        openContent({ type: "mei", id: firstMei.meiFriendId });
      }
    }
  }, [workspace, openContent]);

  const openWorkspace = useCallback(async () => {
    const addedEntries = await workspace.openWorkspaceFromDirectory();
    if (addedEntries && addedEntries.length > 0) {
      const firstMei = addedEntries.find((e) => e.type === "MEI");
      if (firstMei?.meiFriendId) {
        openContent({ type: "mei", id: firstMei.meiFriendId });
      }
    }
  }, [workspace, openContent]);

  const pitchUp = useCallback(() => {
    const selectionId = focusedState?.selectionId;
    if (!focusedMeiFriend || !selectionId) return;
    try {
      const result = focusedMeiFriend.api.editor.pitchUp(selectionId);
      focusedMeiFriend.updateBatch([
        result.note,
        ...result.accidentalCorrections.map((c) => c.element),
      ]);
    } catch {
      // Ignore if element is not pitchable
    }
  }, [focusedMeiFriend, focusedState?.selectionId]);

  const pitchDown = useCallback(() => {
    const selectionId = focusedState?.selectionId;
    if (!focusedMeiFriend || !selectionId) return;
    try {
      const result = focusedMeiFriend.api.editor.pitchDown(selectionId);
      focusedMeiFriend.updateBatch([
        result.note,
        ...result.accidentalCorrections.map((c) => c.element),
      ]);
    } catch {
      // Ignore if element is not pitchable
    }
  }, [focusedMeiFriend, focusedState?.selectionId]);

  const sendToLiveShare = useCallback(async () => {
    if (focusedMeiFriend && focusedContent?.id) {
      const entry = workspace.workspace.entries.find(
        (e) => e.meiFriendId === focusedContent.id,
      );
      if (entry) {
        const name = entry.path.split("/").pop() ?? "Untitled";
        const roomId = await liveShare.sendToLiveShare(focusedMeiFriend, name);
        alert(
          `Shared! Room ID: ${roomId}\nURL: ${window.location.origin}${window.location.pathname}?share=${roomId}`,
        );
      }
    }
  }, [focusedMeiFriend, focusedContent, liveShare, workspace]);

  const addToWorkspace = useCallback(async () => {
    if (focusedContent?.id) {
      const isShared = liveShare.sharedMeiFriends.has(focusedContent.id);
      if (isShared) {
        await liveShare.addToWorkspace(focusedContent.id);
        alert("Added to workspace!");
      }
    }
  }, [focusedContent, liveShare]);

  return (
    <ApplicationContext.Provider
      value={{
        openFilePicker,
        openWorkspace,
        saveWorkspace: workspace.saveWorkspace,
        openContent,
        pitchUp,
        pitchDown,
        sendToLiveShare,
        addToWorkspace,
      }}
    >
      {children}
    </ApplicationContext.Provider>
  );
}

export function useApplication() {
  const context = useContext(ApplicationContext);
  if (!context) {
    throw new Error("useApplication must be used within ApplicationProvider");
  }
  return context;
}
