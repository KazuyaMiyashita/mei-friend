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

export function LiveShareProvider({ children }: { children: React.ReactNode }) {
  const { workspace } = useWorkspaceContext();
  const { registerMeiFriend, registry } = useMeiFriendRegistry();
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [sharedMeiFriends, setSharedMeiFriends] = useState<
    Map<string, SharedMeiFriendInfo>
  >(new Map());

  const joinRoom = useCallback(
    async (roomId: string) => {
      console.log(`Mock: Joining room ${roomId}`);
      setCurrentRoomId(roomId);

      // Mock: if it's a specific mock ID, add a sample MeiFriend
      if (roomId.startsWith("mock-")) {
        const mf = MeiFriend.fromXmlString(
          '<mei xmlns="http://www.music-encoding.org/ns/mei"></mei>',
        );
        registerMeiFriend(mf, { name: "Shared Score", source: "live-share" });
        setSharedMeiFriends(
          new Map([
            [roomId, { meiFriendId: mf.meiFriendId, name: "Shared Score" }],
          ]),
        );
      }
    },
    [registerMeiFriend],
  );

  // Mock: join room from URL parameter on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get("share");
    if (shareId) {
      joinRoom(shareId);
    }
  }, [joinRoom]);

  const leaveRoom = useCallback(() => {
    setCurrentRoomId(null);
    setSharedMeiFriends(new Map());
  }, []);

  const sendToLiveShare = useCallback(
    async (meiFriend: MeiFriend, name: string): Promise<string> => {
      const roomId = `mock-${Math.random().toString(36).substring(7)}`;
      console.log(
        `Mock: Sending ${name} to Live Share. New Room ID: ${roomId}`,
      );

      // In a real implementation, we would sync with y-websocket here.
      // For now, just add to local mock state.
      const copy = MeiFriend.fromXmlString(meiFriend.toXmlString());
      registerMeiFriend(copy, { name, source: "live-share" });
      setSharedMeiFriends((prev) =>
        new Map(prev).set(roomId, {
          meiFriendId: copy.meiFriendId,
          name,
        }),
      );
      setCurrentRoomId(roomId);

      return roomId;
    },
    [registerMeiFriend],
  );

  const addToWorkspace = useCallback(
    async (id: string) => {
      const shared = sharedMeiFriends.get(id);
      if (!shared) return;

      const sharedMf = registry.get(shared.meiFriendId);
      if (!sharedMf) return;

      console.log(`Mock: Adding ${shared.name} to workspace`);
      const path = `shared/${shared.name}.mei`;
      workspace.addFile(path, "memory");

      // Create a local copy for the workspace
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
      {children}
    </LiveShareContext.Provider>
  );
}

export function useLiveShare() {
  const context = useContext(LiveShareContext);
  if (!context)
    throw new Error("useLiveShare must be used within LiveShareProvider");
  return context;
}
