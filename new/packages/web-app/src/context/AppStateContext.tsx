import type { WorkspaceSnapshot } from "@mei-friend/core";
import { MeiFriendWorkspace } from "@mei-friend/core";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

interface AppState {
  workspace: MeiFriendWorkspace;
  activeMeiFriendPath: string | null;
  setActiveMeiFriendPath: (path: string | null) => void;
  activeSelectedId: string | null;
  setActiveSelectedId: (id: string | null) => void;
  /** Opens a file in the main content panel (delegates to registered MainContent handler). */
  openFileInPanel: (path: string) => void;
  /** Used by MainContent to register its openOrActivateFile function. */
  registerPanelOpener: (fn: (path: string) => void) => () => void;
  openWorkspaceFromDirectory: () => Promise<void>;
  addFilesFromPicker: () => Promise<void>;
  addFilesFromFileList: (files: File[]) => Promise<void>;
}

const AppStateContext = createContext<AppState | null>(null);


export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const workspaceRef = useRef(new MeiFriendWorkspace());
  const fileHandlesRef = useRef(new Map<string, FileSystemFileHandle>());
  const [activeMeiFriendPath, setActiveMeiFriendPath] = useState<string | null>(
    null,
  );
  const [activeSelectedId, setActiveSelectedId] = useState<string | null>(null);
  const panelOpenerRef = useRef<((path: string) => void) | null>(null);

  // Prevent accidental navigation away when workspace has unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (workspaceRef.current.isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const registerPanelOpener = useCallback(
    (fn: (path: string) => void): (() => void) => {
      panelOpenerRef.current = fn;
      return () => {
        if (panelOpenerRef.current === fn) panelOpenerRef.current = null;
      };
    },
    [],
  );

  const openFileInPanel = useCallback(async (path: string): Promise<void> => {
    const workspace = workspaceRef.current;
    if (!workspace.getMeiFriend(path)) {
      const handle = fileHandlesRef.current.get(path);
      if (handle) {
        try {
          const file = await handle.getFile();
          const content = await file.text();
          workspace.loadMeiContent(path, content);
        } catch (err) {
          console.error(`Failed to lazy-load ${path}:`, err);
        }
      }
    }
    panelOpenerRef.current?.(path);
  }, []);

  const addFilesFromFileList = useCallback(
    async (files: File[]): Promise<void> => {
      const workspace = workspaceRef.current;
      for (const file of files) {
        const entry = workspace.addFile(file.name);
        if (entry?.type === "MEI") {
          try {
            const content = await file.text();
            workspace.loadMeiContent(file.name, content);
          } catch (err) {
            console.error(`Failed to load ${file.name}:`, err);
          }
        }
      }
    },
    [],
  );

  const openWorkspaceFromDirectory = useCallback(async (): Promise<void> => {
    if (!("showDirectoryPicker" in window)) {
      alert("File System Access API is not supported in this browser.");
      return;
    }
    try {
      // biome-ignore lint/suspicious/noExplicitAny: File System Access API
      const dirHandle = await (window as any).showDirectoryPicker();
      const workspace = workspaceRef.current;
      workspace.name = dirHandle.name;

      const handles = fileHandlesRef.current;
      handles.clear();

      async function collectFiles(
        handle: FileSystemDirectoryHandle,
        prefix: string,
      ) {
        for await (const [name, entry] of handle.entries()) {
          if (name.startsWith(".")) continue;
          const filePath = prefix ? `${prefix}/${name}` : name;
          if (entry.kind === "file") {
            const fileHandle = entry as FileSystemFileHandle;
            workspace.addFile(filePath);
            handles.set(filePath, fileHandle);
          } else if (entry.kind === "directory") {
            await collectFiles(entry as FileSystemDirectoryHandle, filePath);
          }
        }
      }

      await collectFiles(dirHandle, "");
    } catch (err) {
      if ((err as DOMException).name !== "AbortError") {
        console.error("Failed to open workspace directory:", err);
      }
    }
  }, []);

  const addFilesFromPicker = useCallback(async (): Promise<void> => {
    if (!("showOpenFilePicker" in window)) {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.accept = ".mei,.xml,.musicxml,.jpg,.jpeg,.png,.svg";
      input.onchange = async () => {
        if (input.files) {
          await addFilesFromFileList(Array.from(input.files));
        }
      };
      input.click();
      return;
    }
    try {
      // biome-ignore lint/suspicious/noExplicitAny: File System Access API
      const win = window as any;
      const fileHandles: FileSystemFileHandle[] = await win.showOpenFilePicker({
        multiple: true,
        types: [
          {
            description: "MEI Files",
            accept: { "application/xml": [".mei", ".xml", ".musicxml"] },
          },
          {
            description: "Images",
            accept: {
              "image/*": [".jpg", ".jpeg", ".png", ".svg", ".gif"],
            },
          },
        ],
      });
      const files = await Promise.all(fileHandles.map((h) => h.getFile()));
      await addFilesFromFileList(files);
    } catch (err) {
      if ((err as DOMException).name !== "AbortError") {
        console.error("Failed to open files:", err);
      }
    }
  }, [addFilesFromFileList]);

  const value: AppState = {
    workspace: workspaceRef.current,
    activeMeiFriendPath,
    setActiveMeiFriendPath,
    activeSelectedId,
    setActiveSelectedId,
    openFileInPanel,
    registerPanelOpener,
    openWorkspaceFromDirectory,
    addFilesFromPicker,
    addFilesFromFileList,
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}

/** Subscribes to workspace changes via useSyncExternalStore. */
export function useWorkspace(): WorkspaceSnapshot & {
  workspace: MeiFriendWorkspace;
} {
  const { workspace } = useAppState();
  const snapshot = useSyncExternalStore(
    workspace.subscribe,
    workspace.getSnapshot,
  );
  return { workspace, ...snapshot };
}

export function useActiveMeiFriend() {
  const {
    workspace,
    activeMeiFriendPath,
    setActiveMeiFriendPath,
    activeSelectedId,
    setActiveSelectedId,
  } = useAppState();
  return {
    activeMeiFriend: activeMeiFriendPath
      ? (workspace.getMeiFriend(activeMeiFriendPath) ?? null)
      : null,
    activeMeiFriendPath,
    setActiveMeiFriendPath,
    activeSelectedId,
    setActiveSelectedId,
  };
}
