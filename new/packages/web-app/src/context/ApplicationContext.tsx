import type { Cursor } from "@mei-friend/core";
import { MeiFriend } from "@mei-friend/core";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
} from "react";
import type { SidebarPanel } from "../components/LeftSideBar/LeftSideBar";
import { type PanelContent, useFocusedPanel } from "./FocusedPanelContext";
import { useLiveShare } from "./LiveShareContext";
import {
  useFocusedMeiFriend,
  useMeiFriendRegistry,
} from "./MeiFriendRegistryContext";
import { useWorkspaceContext } from "./WorkspaceContext";

export interface ApplicationContextValue {
  activeSidebar: SidebarPanel | null;
  setActiveSidebar: (panel: SidebarPanel | null) => void;
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
  activeSidebar,
  setActiveSidebar,
  children,
}: {
  activeSidebar: SidebarPanel | null;
  setActiveSidebar: (panel: SidebarPanel | null) => void;
  children: React.ReactNode;
}) {
  const workspace = useWorkspaceContext();
  const liveShare = useLiveShare();
  const focusedPanel = useFocusedPanel();
  const { registerMeiFriend } = useMeiFriendRegistry();
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

        // Clone the document to prevent syncing with the original workspace copy
        const clone = MeiFriend.fromXmlString(focusedMeiFriend.toXmlString());

        // Register the clone
        registerMeiFriend(clone, {
          name: `Shared ${name}`,
          source: "live-share",
        });

        // Start Live Share with the clone
        await liveShare.sendToLiveShare(clone, `Shared ${name}`);

        // Open the clone in a new panel
        openContent({ type: "mei", id: clone.meiFriendId });

        alert("Live Share room created.");
        setActiveSidebar("live-share");
      }
    }
  }, [
    focusedMeiFriend,
    focusedContent,
    liveShare,
    workspace,
    setActiveSidebar,
    registerMeiFriend,
    openContent,
  ]);

  const addToWorkspace = useCallback(async () => {
    if (focusedContent?.id && focusedMeiFriend) {
      const isShared = Array.from(liveShare.sharedMeiFriends.values()).some(
        (info) => info.meiFriendId === focusedContent.id,
      );
      if (isShared) {
        // Find the room ID this document belongs to
        let roomId = "unknown";
        for (const [id, info] of liveShare.sharedMeiFriends.entries()) {
          if (info.meiFriendId === focusedContent.id) {
            roomId = id;
            break;
          }
        }

        const name = `shared_${roomId}.mei`;

        // Add to workspace first to get an entry with an ID
        const path = `shared/${name}`;
        const entry = workspace.workspace.addFile(path, "memory");
        if (!entry) {
          alert("Failed to add to workspace");
          return;
        }

        // Clone the document using the ID generated by the workspace
        const clone = MeiFriend.fromXmlString(
          focusedMeiFriend.toXmlString(),
          undefined,
          entry.meiFriendId,
        );
        registerMeiFriend(clone, { name, source: "workspace" });

        workspace.workspace.updateEntry(path, {
          meiFriendId: clone.meiFriendId,
        });

        clone.onUpdate(() => {
          workspace.workspace.updateEntry(path, { isDirty: true });
        });

        alert("Added to workspace!");
      }
    }
  }, [
    focusedContent,
    focusedMeiFriend,
    liveShare,
    workspace,
    registerMeiFriend,
  ]);
  // Automatically handle joining from URL on startup
  const hasInitializedFromUrl = React.useRef(false);
  useEffect(() => {
    if (hasInitializedFromUrl.current) return;

    const params = new URLSearchParams(window.location.search);
    const shareId = params.get("share");

    if (shareId) {
      hasInitializedFromUrl.current = true;
      setActiveSidebar("live-share");
      // The MeiFriend instance created by LiveShareContext uses this ID format
      openContent({ type: "mei", id: `shared-${shareId}` });
    }
  }, [openContent, setActiveSidebar]);
  return (
    <ApplicationContext.Provider
      value={{
        activeSidebar,
        setActiveSidebar,
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
