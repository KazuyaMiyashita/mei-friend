/**
 * WorkspaceContext — data layer for the web-app.
 *
 * Owns the MeiFriendWorkspace instance, the FSA root directory handle,
 * all file I/O operations, and persisted app settings. Components that need
 * to read or modify workspace data should use useWorkspaceContext() or the
 * convenience hook useWorkspace().
 *
 * Provider nesting order: <WorkspaceProvider> must wrap <AppStateProvider>
 * because AppStateContext depends on loadFileIfNeeded from this context.
 */

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

// ── App settings ─────────────────────────────────────────────────────────────

export type AppSettings = { showSplash: boolean };

const DEFAULT_SETTINGS: AppSettings = { showSplash: true };
const SETTINGS_KEY = "mei-friend:settings";

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw)
      return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as AppSettings) };
  } catch {
    // Ignore malformed JSON — fall back to defaults.
  }
  return DEFAULT_SETTINGS;
}

function persistSettings(s: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// ── Context interface ─────────────────────────────────────────────────────────

interface WorkspaceContextValue {
  workspace: MeiFriendWorkspace;

  /**
   * Ensures MEI content is loaded for the given path.
   * For "workspace" origin files this performs a lazy read from the FSA root
   * directory. All other origins are loaded eagerly at add-time, so this is
   * a no-op for them.
   */
  loadFileIfNeeded: (path: string) => Promise<void>;

  /**
   * Opens a native file picker (FSA showOpenFilePicker or <input> fallback).
   * Files are added as "loose" origin — the originals are never overwritten.
   * Content is loaded immediately since there is no directory handle for later.
   */
  addFilesFromPicker: () => Promise<void>;

  /**
   * Adds an array of File objects (e.g. from drag-drop) to the workspace.
   * Files are registered as "loose" and their content is loaded immediately.
   */
  addFilesFromFileList: (files: File[]) => Promise<void>;

  /**
   * Opens a directory as the workspace via FSA showDirectoryPicker.
   * If a workspace is already open and has unsaved changes, the user is prompted
   * before discarding. On confirmation the existing workspace is closed (panels
   * reset via the registered reset handler) before the new directory is loaded.
   * Files are registered as "workspace" origin without loading content —
   * content is lazy-loaded on first panel access via loadFileIfNeeded().
   */
  openWorkspaceFromDirectory: () => Promise<void>;

  /**
   * Saves all dirty entries to the workspace root directory.
   *
   * - Entries with origin "workspace" that have been edited are overwritten
   *   in their original location within the directory.
   * - Entries with other origins (loose / memory / remote) are written to the
   *   root directory for the first time. After writing they are no longer dirty.
   *
   * If no root directory is set yet, the user is prompted to pick one via
   * showDirectoryPicker before any writes occur.
   */
  saveWorkspace: () => Promise<void>;

  /**
   * Where the workspace is currently stored.
   * - "memory"  No root directory — files live only in browser memory.
   * - "local"   Backed by a FileSystemDirectoryHandle (local disk via FSA).
   * Reserved: "remote" for future URL-workspace support.
   */
  workspaceStorage: "memory" | "local";

  /**
   * Registers a callback that is invoked when the workspace is replaced
   * (Open Workspace on an already-open workspace). Used by MainContent to
   * reset the panel layout. Returns a cleanup function.
   */
  registerResetHandler: (fn: () => void) => () => void;

  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const workspaceRef = useRef(new MeiFriendWorkspace("New Workspace"));

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

  const [settings, setSettings] = useState<AppSettings>(loadSettings);

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

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      persistSettings(next);
      return next;
    });
  }, []);

  // ── Lazy loading ───────────────────────────────────────────────────────────

  const loadFileIfNeeded = useCallback(
    async (path: string): Promise<void> => {
      const workspace = workspaceRef.current;
      if (workspace.getMeiFriend(path)) return; // content already in memory

      // Only "workspace" origin files can be read from the root directory handle.
      // Loose / memory / remote files are always loaded at add-time.
      const rootDir = rootDirHandle;
      if (!rootDir) return;

      try {
        // Re-derive the file handle from the root — no need to store per-file handles.
        const segments = path.split("/");
        const fileName = segments.pop();
        if (!fileName) return;

        let dir: FileSystemDirectoryHandle = rootDir;
        for (const seg of segments) {
          dir = await dir.getDirectoryHandle(seg);
        }
        const fileHandle = await dir.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        workspace.loadMeiContent(path, await file.text());
      } catch (err) {
        console.error(
          `Failed to lazy-load "${path}" from workspace directory:`,
          err,
        );
      }
    },
    [rootDirHandle],
  );

  // ── File add helpers ───────────────────────────────────────────────────────

  const addFilesFromFileList = useCallback(
    async (files: File[]): Promise<void> => {
      const workspace = workspaceRef.current;
      for (const file of files) {
        // Register as "loose" — these files are not part of an open directory.
        const entry = workspace.addFile(file.name, "loose");
        if (entry?.type === "MEI") {
          try {
            workspace.loadMeiContent(file.name, await file.text());
          } catch (err) {
            console.error(`Failed to load "${file.name}":`, err);
          }
        }
      }
    },
    [],
  );

  const addFilesFromPicker = useCallback(async (): Promise<void> => {
    if (!("showOpenFilePicker" in window)) {
      // Fallback for browsers that do not support the File System Access API.
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.accept = ".mei,.xml,.musicxml,.jpg,.jpeg,.png,.svg";
      input.onchange = async () => {
        if (input.files) await addFilesFromFileList(Array.from(input.files));
      };
      input.click();
      return;
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
      await addFilesFromFileList(files);
    } catch (err) {
      if ((err as DOMException).name !== "AbortError") {
        console.error("Failed to open files:", err);
      }
    }
  }, [addFilesFromFileList]);

  const openWorkspaceFromDirectory = useCallback(async (): Promise<void> => {
    if (!("showDirectoryPicker" in window)) {
      alert("File System Access API is not supported in this browser.");
      return;
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
        return;
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
      return;
    }

    // Now that we have a new directory, discard the old workspace.
    // Reset the panel layout first, then destroy the workspace data.
    resetHandlerRef.current?.();
    currentWorkspace.destroy();

    const newWorkspace = new MeiFriendWorkspace(dirHandle.name);
    workspaceRef.current = newWorkspace;
    setRootDirHandle(dirHandle);

    // Recursively register all non-hidden files as "workspace" origin.
    // Content is NOT loaded here — lazy-loaded on first panel access to
    // avoid the cost of loading every file in a large directory upfront.
    async function collectFiles(
      handle: FileSystemDirectoryHandle,
      prefix: string,
    ) {
      for await (const [name, entry] of handle.entries()) {
        if (name.startsWith(".")) continue; // skip hidden files and directories
        const filePath = prefix ? `${prefix}/${name}` : name;
        if (entry.kind === "file") {
          newWorkspace.addFile(filePath, "workspace");
        } else if (entry.kind === "directory") {
          await collectFiles(entry as FileSystemDirectoryHandle, filePath);
        }
      }
    }

    try {
      await collectFiles(dirHandle, "");
    } catch (err) {
      console.error("Failed to read workspace directory:", err);
    }
  }, []);

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
      if (!entry.isDirty) continue; // up to date — skip

      const mf = workspace.getMeiFriend(entry.path);
      if (!mf) continue; // non-MEI or content not yet loaded — skip

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
  }, [rootDirHandle]);

  // ── Context value ──────────────────────────────────────────────────────────

  const value: WorkspaceContextValue = {
    workspace: workspaceRef.current,
    loadFileIfNeeded,
    addFilesFromPicker,
    addFilesFromFileList,
    openWorkspaceFromDirectory,
    saveWorkspace,
    workspaceStorage,
    registerResetHandler,
    settings,
    updateSettings,
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
