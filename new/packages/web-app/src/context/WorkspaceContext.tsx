/**
 * WorkspaceContext — data layer for the web-app.
 *
 * Owns the MeiFriendWorkspace instance, the FSA root directory handle,
 * all file I/O operations, and persisted app settings. Components that need
 * to read or modify workspace data should use useWorkspaceContext() or the
 * convenience hook useWorkspace().
 *
 * Provider nesting order: <WorkspaceProvider> must wrap <FocusProvider>
 * because FocusContext depends on loadFileIfNeeded from this context.
 */

import type { WorkspaceEntry, WorkspaceSnapshot } from "@mei-friend/core";
import { MeiFriend, MeiFriendWorkspace } from "@mei-friend/core";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useMeiFriendRegistry } from "./MeiFriendRegistryContext";

// ── Context interface ─────────────────────────────────────────────────────────

interface WorkspaceContextValue {
  workspace: MeiFriendWorkspace;
  workspaceStorage: "memory" | "local";
  openWorkspaceFromDirectory: () => Promise<readonly WorkspaceEntry[]>;
  saveWorkspace: () => Promise<void>;
  addFilesFromPicker: () => Promise<readonly WorkspaceEntry[]>;
  addFilesFromFileList: (files: File[]) => Promise<readonly WorkspaceEntry[]>;
  registerResetHandler: (handler: () => void) => () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const workspaceRef = useRef(new MeiFriendWorkspace("New Workspace"));
  const { registerMeiFriend, unregisterMeiFriend, registry } =
    useMeiFriendRegistry();

  // The FSA root directory handle. When set, all file reads and writes
  // go through this handle instead of individual file handles.
  const [rootDirHandle, setRootDirHandle] =
    useState<FileSystemDirectoryHandle | null>(null);

  // Tracks whether a local directory is backing the workspace so that
  // components can react (e.g. show "LOCAL" badge, enable Save Workspace).
  const workspaceStorage = rootDirHandle ? "local" : "memory";

  // Callback registered by MainContent to reset the panel layout when the
  // workspace is replaced. Ref so it never triggers a re-render.
  const resetHandlerRef = useRef<(() => void) | null>(null);

  const registerResetHandler = useCallback((fn: () => void): (() => void) => {
    resetHandlerRef.current = fn;
    return () => {
      if (resetHandlerRef.current === fn) resetHandlerRef.current = null;
    };
  }, []);

  // Warn before closing the tab when there are unsaved changes.
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

  // ── File add helpers ───────────────────────────────────────────────────────

  const addFilesFromFileList = useCallback(
    async (files: File[]): Promise<readonly WorkspaceEntry[]> => {
      const workspace = workspaceRef.current;
      const addedEntries: WorkspaceEntry[] = [];
      for (const file of files) {
        // Register as "loose" — these files are not part of an open directory.
        const entry = workspace.addFile(file.name, "loose");
        if (entry) {
          addedEntries.push(entry);
          if (entry.type === "MEI") {
            try {
              const mf = MeiFriend.fromXmlString(
                await file.text(),
                undefined,
                entry.meiFriendId,
              );
              registerMeiFriend(mf, { name: file.name, source: "workspace" });
              workspace.updateEntry(entry.path, {
                meiFriendId: mf.meiFriendId,
              });

              mf.onUpdate(() => {
                workspace.updateEntry(entry.path, { isDirty: true });
              });
            } catch (err) {
              console.error(`Failed to load "${file.name}":`, err);
            }
          }
        }
      }
      return addedEntries;
    },
    [registerMeiFriend],
  );

  const addFilesFromPicker = useCallback(async (): Promise<
    readonly WorkspaceEntry[]
  > => {
    if (!("showOpenFilePicker" in window)) {
      // Fallback for browsers that do not support the File System Access API.
      return new Promise<readonly WorkspaceEntry[]>((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = true;
        input.accept = ".mei,.xml,.musicxml,.jpg,.jpeg,.png,.svg";
        input.onchange = async () => {
          if (input.files) {
            resolve(await addFilesFromFileList(Array.from(input.files)));
          } else {
            resolve([]);
          }
        };
        input.click();
      });
    }
    try {
      // biome-ignore lint/suspicious/noExplicitAny: File System Access API not yet in TS lib
      const win = window as any;
      const handles: FileSystemFileHandle[] = await win.showOpenFilePicker({
        multiple: true,
        types: [
          {
            description: "MEI Files",
            accept: { "application/xml": [".mei", ".xml", ".musicxml"] },
          },
          {
            description: "Images",
            accept: { "image/*": [".jpg", ".jpeg", ".png", ".svg", ".gif"] },
          },
        ],
      });
      // Intentionally NOT storing individual handles: the original files should
      // never be overwritten. On Save Workspace the content goes to rootDir.
      const files = await Promise.all(handles.map((h) => h.getFile()));
      return await addFilesFromFileList(files);
    } catch (err) {
      if ((err as DOMException).name !== "AbortError") {
        console.error("Failed to open files:", err);
      }
      return [];
    }
  }, [addFilesFromFileList]);

  const openWorkspaceFromDirectory = useCallback(async (): Promise<
    readonly WorkspaceEntry[]
  > => {
    if (!("showDirectoryPicker" in window)) {
      alert("File System Access API is not supported in this browser.");
      return [];
    }

    const currentWorkspace = workspaceRef.current;

    // Guard: if files are already open, ask before discarding.
    if (currentWorkspace.entries.length > 0) {
      if (
        currentWorkspace.isDirty &&
        !window.confirm(
          "The current workspace has unsaved changes. Close it and open a new workspace anyway?",
        )
      ) {
        return [];
      }
    }

    let dirHandle: FileSystemDirectoryHandle;
    try {
      // biome-ignore lint/suspicious/noExplicitAny: File System Access API not yet in TS lib
      dirHandle = await (window as any).showDirectoryPicker();
    } catch (err) {
      if ((err as DOMException).name !== "AbortError") {
        console.error("Failed to open workspace directory:", err);
      }
      return [];
    }

    // Now that we have a new directory, discard the old workspace.
    // Reset the panel layout first, then destroy the workspace data.
    resetHandlerRef.current?.();

    for (const entry of currentWorkspace.entries) {
      if (entry.meiFriendId) unregisterMeiFriend(entry.meiFriendId);
    }

    const newWorkspace = new MeiFriendWorkspace(dirHandle.name);
    workspaceRef.current = newWorkspace;
    setRootDirHandle(dirHandle);

    // Recursively register all non-hidden files as "workspace" origin.
    // Content is loaded immediately.
    async function collectFiles(
      handle: FileSystemDirectoryHandle,
      prefix: string,
    ) {
      const entries: { name: string; handle: FileSystemHandle }[] = [];
      // biome-ignore lint/suspicious/noExplicitAny: File System Access API not yet in TS lib
      for await (const [name, entry] of (handle as any).entries()) {
        if (name.startsWith(".")) continue; // skip hidden files and directories
        entries.push({ name, handle: entry });
      }
      entries.sort((a, b) => a.name.localeCompare(b.name));

      for (const { name, handle: entry } of entries) {
        const filePath = prefix ? `${prefix}/${name}` : name;
        if (entry.kind === "file") {
          const addedEntry = newWorkspace.addFile(filePath, "workspace");
          if (
            addedEntry &&
            addedEntry.type === "MEI" &&
            addedEntry.meiFriendId
          ) {
            try {
              const file = await (entry as FileSystemFileHandle).getFile();
              const mf = MeiFriend.fromXmlString(
                await file.text(),
                undefined,
                addedEntry.meiFriendId,
              );
              registerMeiFriend(mf, { name, source: "workspace" });

              mf.onUpdate(() => {
                newWorkspace.updateEntry(addedEntry.path, { isDirty: true });
              });
            } catch (err) {
              console.error(`Failed to load "${filePath}":`, err);
            }
          }
        } else if (entry.kind === "directory") {
          await collectFiles(entry as FileSystemDirectoryHandle, filePath);
        }
      }
    }

    try {
      await collectFiles(dirHandle, "");
      // Trigger a re-render to reflect the new workspace
      setRootDirHandle((prev) => prev); // force update
      return newWorkspace.entries;
    } catch (err) {
      console.error("Failed to read workspace directory:", err);
      return [];
    }
  }, [unregisterMeiFriend, registerMeiFriend]);

  // ── Save workspace ─────────────────────────────────────────────────────────

  const saveWorkspace = useCallback(async (): Promise<void> => {
    // If no root directory is set, ask the user to pick one first.
    // This handles both pure-memory workspaces and workspaces built from
    // individually-opened files (loose / remote / memory origins).
    let currentRootDir = rootDirHandle;
    if (!currentRootDir) {
      if (!("showDirectoryPicker" in window)) {
        alert("File System Access API is not supported in this browser.");
        return;
      }
      try {
        // biome-ignore lint/suspicious/noExplicitAny: File System Access API not yet in TS lib
        const handle = await (window as any).showDirectoryPicker();
        setRootDirHandle(handle);
        currentRootDir = handle;
        workspaceRef.current.name = handle.name;
      } catch (err) {
        if ((err as DOMException).name !== "AbortError") {
          console.error("Failed to pick save directory:", err);
        }
        return;
      }
    }

    const rootDir = currentRootDir;
    if (!rootDir) return; // should be unreachable — the block above always sets it
    const workspace = workspaceRef.current;

    for (const entry of workspace.entries) {
      if (!entry.isDirty || !entry.meiFriendId) continue; // up to date or no content — skip

      const mf = registry.get(entry.meiFriendId);
      if (!mf) continue; // content not found in registry — skip

      try {
        // Resolve nested path segments, creating intermediate directories if
        // needed (e.g. "scores/bach/bwv1.mei" → ensure "scores/bach/" exists).
        const segments = entry.path.split("/");
        const fileName = segments.pop();
        if (!fileName) continue;

        let dir: FileSystemDirectoryHandle = rootDir;
        for (const seg of segments) {
          dir = await dir.getDirectoryHandle(seg, { create: true });
        }
        const fileHandle = await dir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(mf.toXmlString());
        await writable.close();
        workspace.markSaved(entry.path);
      } catch (err) {
        console.error(`Failed to save "${entry.path}":`, err);
      }
    }
  }, [rootDirHandle, registry.get]);

  // ── Context value ──────────────────────────────────────────────────────────

  const value: WorkspaceContextValue = {
    workspace: workspaceRef.current,
    addFilesFromPicker,
    addFilesFromFileList,
    openWorkspaceFromDirectory,
    saveWorkspace,
    workspaceStorage,
    registerResetHandler,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useWorkspaceContext(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx)
    throw new Error(
      "useWorkspaceContext must be used within WorkspaceProvider",
    );
  return ctx;
}

/**
 * Subscribes to workspace snapshot changes via useSyncExternalStore.
 * Returns the latest snapshot merged with the stable workspace instance.
 */
export function useWorkspace(): WorkspaceSnapshot & {
  workspace: MeiFriendWorkspace;
} {
  const { workspace } = useWorkspaceContext();
  const snapshot = useSyncExternalStore(
    workspace.subscribe,
    workspace.getSnapshot,
  );
  return { workspace, ...snapshot };
}
