import type { HocuspocusProvider } from "@hocuspocus/provider";
import {
  HocuspocusProviderWebsocketComponent,
  HocuspocusRoom,
  useHocuspocusProvider,
} from "@hocuspocus/provider-react";
import { MeiFriend } from "@mei-friend/core";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useMeiFriendRegistry } from "./MeiFriendRegistryContext";
import { useWorkspaceContext } from "./WorkspaceContext";

interface SharedMeiFriendInfo {
  meiFriendId: string;
  name: string;
  provider: HocuspocusProvider;
}

interface LiveShareContextValue {
  currentRoomId: string | null;
  sharedMeiFriends: Map<string, SharedMeiFriendInfo>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => void;
  sendToLiveShare: (meiFriend: MeiFriend, name: string) => Promise<string>;
  addToWorkspace: (id: string) => Promise<void>;
}

const LiveShareContext = createContext<LiveShareContextValue | null>(null);

// Use current host for WebSocket connection to work through proxy/relative paths
const getWsServerUrl = () => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  // The server now directly listens without the /api/share prefix
  return `${protocol}//${window.location.host}/api/share`;
};

// Internal component to manage the room registration via the provider
function RoomRegistrar({
  roomId,
  meiFriendId,
  name,
  isFromUrl,
  onRegister,
  onUnregister,
}: {
  roomId: string;
  meiFriendId: string;
  name: string;
  isFromUrl?: boolean;
  onRegister: (roomId: string, info: SharedMeiFriendInfo) => void;
  onUnregister: (roomId: string) => void;
}) {
  const provider = useHocuspocusProvider();

  useEffect(() => {
    onRegister(roomId, {
      meiFriendId,
      name,
      provider,
    });

    return () => {
      onUnregister(roomId);
    };
  }, [provider, roomId, meiFriendId, name, onRegister, onUnregister]);

  useEffect(() => {
    if (!isFromUrl) return;

    const verifyRoomContent = () => {
      // Use the actual fragment name used by MeiFriend ("mei")
      const isDocumentEmpty =
        provider.document.getXmlFragment("mei").toArray().length === 0;
      const noOtherPeers = (provider.awareness?.getStates().size ?? 0) <= 1;

      if (isDocumentEmpty && noOtherPeers) {
        alert("Live Share: Room not found!");
        // Remove share param and reload to behave like a normal startup
        const url = new URL(window.location.href);
        url.searchParams.delete("share");
        window.location.replace(url.toString());
      }
    };

    const handleSynced = (data: { state: boolean }) => {
      // Only proceed if it is actually fully synced
      if (data && data.state === true) {
        verifyRoomContent();
      }
    };

    provider.on("synced", handleSynced);

    // It's possible it already synced before this effect attached
    if (provider.isSynced) {
      verifyRoomContent();
    }

    return () => {
      provider.off("synced", handleSynced);
    };
  }, [provider, isFromUrl]);
  return null;
}

export function LiveShareProvider({ children }: { children: React.ReactNode }) {
  const { workspace } = useWorkspaceContext();
  const { registerMeiFriend, registry } = useMeiFriendRegistry();
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [sharedMeiFriends, setSharedMeiFriends] = useState<
    Map<string, SharedMeiFriendInfo>
  >(new Map());

  // Store metadata about rooms before they mount
  const [roomMetadata, setRoomMetadata] = useState<
    Map<string, { meiFriendId: string; name: string; isFromUrl?: boolean }>
  >(new Map());

  const joinRoom = useCallback(
    async (roomId: string, isFromUrl = false) => {
      if (roomMetadata.has(roomId)) {
        console.log(`Already in room ${roomId}`);
        setCurrentRoomId(roomId);
        return;
      }

      console.log(`Joining room ${roomId}`);

      const mf = new MeiFriend(undefined, undefined, `shared-${roomId}`);
      registerMeiFriend(mf, { name: "Shared Score", source: "live-share" });

      setRoomMetadata((prev) => {
        const next = new Map(prev);
        next.set(roomId, {
          meiFriendId: mf.meiFriendId,
          name: "Shared Score",
          isFromUrl,
        });
        return next;
      });

      setCurrentRoomId(roomId);

      if (isFromUrl) {
        // To let the app load smoothly, we delay the focus transition slightly
        setTimeout(() => {
          // We just need to signal the UI it's ready, the actual opening is handled by the initial URL load
          // App.tsx had a hardcoded openContent for URL loads that was locking the sidebar.
          // We leave the side bar opening logic and initial document viewing here or in AppContext
        }, 0);
      }
    },
    [registerMeiFriend, roomMetadata],
  );

  // Join room from URL parameter on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get("share");
    if (shareId) {
      joinRoom(shareId, true);
    }
  }, [joinRoom]);

  const leaveRoom = useCallback(() => {
    if (currentRoomId) {
      setRoomMetadata((prev) => {
        const next = new Map(prev);
        next.delete(currentRoomId);
        return next;
      });
    }
    setCurrentRoomId(null);
  }, [currentRoomId]);

  const sendToLiveShare = useCallback(
    async (meiFriend: MeiFriend, name: string): Promise<string> => {
      const roomId = Math.random().toString(36).substring(7);
      console.log(`Sending ${name} to Live Share. Room ID: ${roomId}`);

      setRoomMetadata((prev) => {
        const next = new Map(prev);
        next.set(roomId, {
          meiFriendId: meiFriend.meiFriendId,
          name,
        });
        return next;
      });

      setCurrentRoomId(roomId);

      return roomId;
    },
    [],
  );

  const addToWorkspace = useCallback(
    async (meiFriendId: string) => {
      let shared: SharedMeiFriendInfo | undefined;
      for (const info of sharedMeiFriends.values()) {
        if (info.meiFriendId === meiFriendId) {
          shared = info;
          break;
        }
      }
      if (!shared) return;

      const sharedMf = registry.get(shared.meiFriendId);
      if (!sharedMf) return;

      console.log(`Adding ${shared.name} to workspace`);
      const path = `shared/${shared.name}.mei`;
      workspace.addFile(path, "memory");

      // Create a local copy for the workspace (this breaks sync for the workspace copy, which is intended)
      const localMf = MeiFriend.fromXmlString(sharedMf.toXmlString());
      registerMeiFriend(localMf, { name: shared.name, source: "workspace" });

      workspace.updateEntry(path, {
        meiFriendId: localMf.meiFriendId,
      });

      localMf.onUpdate(() => {
        workspace.updateEntry(path, { isDirty: true });
      });
    },
    [sharedMeiFriends, workspace, registry, registerMeiFriend],
  );

  const handleRegisterRoom = useCallback(
    (roomId: string, info: SharedMeiFriendInfo) => {
      setSharedMeiFriends((prev) => {
        const next = new Map(prev);
        next.set(roomId, info);
        return next;
      });
    },
    [],
  );

  const handleUnregisterRoom = useCallback((roomId: string) => {
    setSharedMeiFriends((prev) => {
      const next = new Map(prev);
      next.delete(roomId);
      return next;
    });
  }, []);

  const value: LiveShareContextValue = {
    currentRoomId,
    sharedMeiFriends,
    joinRoom,
    leaveRoom,
    sendToLiveShare,
    addToWorkspace,
  };

  return (
    <LiveShareContext.Provider value={value}>
      <HocuspocusProviderWebsocketComponent url={getWsServerUrl()}>
        {Array.from(roomMetadata.entries()).map(
          ([roomId, { meiFriendId, name, isFromUrl }]) => {
            const mf = registry.get(meiFriendId);
            if (!mf) return null;

            return (
              <HocuspocusRoom key={roomId} name={roomId} document={mf.yDoc}>
                <RoomRegistrar
                  roomId={roomId}
                  meiFriendId={meiFriendId}
                  name={name}
                  isFromUrl={isFromUrl}
                  onRegister={handleRegisterRoom}
                  onUnregister={handleUnregisterRoom}
                />
              </HocuspocusRoom>
            );
          },
        )}
        {children}
      </HocuspocusProviderWebsocketComponent>
    </LiveShareContext.Provider>
  );
}

export function useLiveShare() {
  const context = useContext(LiveShareContext);
  if (!context)
    throw new Error("useLiveShare must be used within LiveShareProvider");
  return context;
}
