import type { Cursor } from "@mei-friend/core";
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
  undo: () => void;
  redo: () => void;
  pitchUp: () => void;
  pitchDown: () => void;
  pitchOctaveUp: () => void;
  pitchOctaveDown: () => void;
  pitchChromaticUp: () => void;
  pitchChromaticDown: () => void;
  nextBeat: () => void;
  nextEvent: () => void;
  prevBeat: () => void;
  prevEvent: () => void;
  staffUpSnapToBeat: () => void;
  staffUpSnapToEvent: () => void;
  staffDownSnapToBeat: () => void;
  staffDownSnapToEvent: () => void;
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
  const {
    meiFriend: focusedMeiFriend,
    state: focusedState,
    setSelection: setFocusedSelection,
    setCursor: setFocusedCursor,
  } = useFocusedMeiFriend();

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

  const undo = useCallback(() => {
    focusedMeiFriend?.undo();
  }, [focusedMeiFriend]);

  const redo = useCallback(() => {
    focusedMeiFriend?.redo();
  }, [focusedMeiFriend]);

  const pitchUp = useCallback(() => {
    const selectionId = focusedState?.selectionId;
    if (!focusedMeiFriend || !selectionId) return;
    try {
      const elements = focusedMeiFriend.api.editor.pitchUp(selectionId);
      focusedMeiFriend.updateBatch(elements);
    } catch {
      // Ignore if element is not pitchable
    }
  }, [focusedMeiFriend, focusedState?.selectionId]);

  const pitchDown = useCallback(() => {
    const selectionId = focusedState?.selectionId;
    if (!focusedMeiFriend || !selectionId) return;
    try {
      const elements = focusedMeiFriend.api.editor.pitchDown(selectionId);
      focusedMeiFriend.updateBatch(elements);
    } catch {
      // Ignore if element is not pitchable
    }
  }, [focusedMeiFriend, focusedState?.selectionId]);

  const pitchOctaveUp = useCallback(() => {
    const selectionId = focusedState?.selectionId;
    if (!focusedMeiFriend || !selectionId) return;
    try {
      const elements = focusedMeiFriend.api.editor.pitchOctaveUp(selectionId);
      focusedMeiFriend.updateBatch(elements);
    } catch {
      // Ignore if element is not pitchable
    }
  }, [focusedMeiFriend, focusedState?.selectionId]);

  const pitchOctaveDown = useCallback(() => {
    const selectionId = focusedState?.selectionId;
    if (!focusedMeiFriend || !selectionId) return;
    try {
      const elements = focusedMeiFriend.api.editor.pitchOctaveDown(selectionId);
      focusedMeiFriend.updateBatch(elements);
    } catch {
      // Ignore if element is not pitchable
    }
  }, [focusedMeiFriend, focusedState?.selectionId]);

  const pitchChromaticUp = useCallback(() => {
    const selectionId = focusedState?.selectionId;
    if (!focusedMeiFriend || !selectionId) return;
    try {
      const elements =
        focusedMeiFriend.api.editor.pitchChromaticUp(selectionId);
      focusedMeiFriend.updateBatch(elements);
    } catch {
      // Ignore if element is not pitchable
    }
  }, [focusedMeiFriend, focusedState?.selectionId]);

  const pitchChromaticDown = useCallback(() => {
    const selectionId = focusedState?.selectionId;
    if (!focusedMeiFriend || !selectionId) return;
    try {
      const elements =
        focusedMeiFriend.api.editor.pitchChromaticDown(selectionId);
      focusedMeiFriend.updateBatch(elements);
    } catch {
      // Ignore if element is not pitchable
    }
  }, [focusedMeiFriend, focusedState?.selectionId]);

  const moveCursor = useCallback(
    (nextCursor: Cursor | undefined) => {
      if (nextCursor && nextCursor !== focusedState?.cursor) {
        setFocusedCursor(nextCursor);
        const eventId = nextCursor.getEvent()?.id ?? null;
        setFocusedSelection(eventId, "verovio");
      }
    },
    [focusedState?.cursor, setFocusedCursor, setFocusedSelection],
  );

  const nextBeat = useCallback(() => {
    moveCursor(focusedState?.cursor?.nextBeat());
  }, [focusedState?.cursor, moveCursor]);

  const nextEvent = useCallback(() => {
    moveCursor(focusedState?.cursor?.nextEvent());
  }, [focusedState?.cursor, moveCursor]);

  const prevBeat = useCallback(() => {
    moveCursor(focusedState?.cursor?.prevBeat());
  }, [focusedState?.cursor, moveCursor]);

  const prevEvent = useCallback(() => {
    moveCursor(focusedState?.cursor?.prevEvent());
  }, [focusedState?.cursor, moveCursor]);

  const staffUpSnapToBeat = useCallback(() => {
    moveCursor(focusedState?.cursor?.staffUp().snapToBeat());
  }, [focusedState?.cursor, moveCursor]);

  const staffUpSnapToEvent = useCallback(() => {
    moveCursor(focusedState?.cursor?.staffUp().snapToEvent());
  }, [focusedState?.cursor, moveCursor]);

  const staffDownSnapToBeat = useCallback(() => {
    moveCursor(focusedState?.cursor?.staffDown().snapToBeat());
  }, [focusedState?.cursor, moveCursor]);

  const staffDownSnapToEvent = useCallback(() => {
    moveCursor(focusedState?.cursor?.staffDown().snapToEvent());
  }, [focusedState?.cursor, moveCursor]);

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
