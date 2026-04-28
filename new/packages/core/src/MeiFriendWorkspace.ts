import { MeiFriend } from "./MeiFriend.js";

export type WorkspaceFileType = "MEI" | "Image" | "WebAnnotation" | "Other";

/**
 * How a file entered the workspace. This is immutable provenance — it records
 * where the file came from, not where it is currently stored.
 *
 * - "workspace"  Scanned from a local directory (showDirectoryPicker). The
 *                workspace root directory handle can write it back in place.
 * - "loose"      Opened individually (showOpenFilePicker / drag-drop / <input>).
 *                The original file is never overwritten; on Save Workspace the
 *                content is written to the workspace root directory.
 * - "memory"     Created in-app (e.g. New file). Never existed on disk.
 * - "remote"     Fetched from a URL. Reserved for future URL-workspace support.
 */
export type EntryOrigin = "workspace" | "loose" | "memory" | "remote";

export interface WorkspaceEntry {
  readonly id: string;
  readonly path: string;
  readonly type: WorkspaceFileType;
  readonly origin: EntryOrigin;
  /**
   * True when the workspace root directory does not reflect the current state
   * of this file. This covers two cases:
   *   1. The content has been edited since the last save (all origins).
   *   2. The file has never been written to the workspace root directory
   *      ("loose" / "memory" / "remote" files start dirty).
   * Reset to false by markSaved().
   */
  isDirty: boolean;
  meiFriend?: MeiFriend;
}

export interface WorkspaceSnapshot {
  name: string | undefined;
  entries: readonly WorkspaceEntry[];
  isDirty: boolean;
}

/**
 * Manages a workspace — a named collection of file paths with optional MEI
 * content. Does not perform any file I/O; the caller (AppStateContext /
 * WorkspaceContext) is responsible for reading files and calling
 * loadMeiContent(), and for writing files on save.
 *
 * subscribe/getSnapshot follow the useSyncExternalStore convention.
 */
export class MeiFriendWorkspace {
  private _name: string;
  private _entries: WorkspaceEntry[] = [];
  private _listeners: Array<() => void> = [];
  private _unsubscribers = new Map<string, () => void>();
  private _snapshot: WorkspaceSnapshot;

  constructor(name: string) {
    this._name = name;
    this._snapshot = {
      name: this._name,
      entries: [],
      isDirty: false,
    };
  }

  get name(): string {
    return this._name;
  }
  set name(v: string) {
    this._name = v;
    this._notify();
  }

  public get entries(): readonly WorkspaceEntry[] {
    return this._entries;
  }

  public get isDirty(): boolean {
    return this._entries.some((e) => e.isDirty);
  }

  /** For useSyncExternalStore — stable arrow function, safe to pass directly. */
  subscribe = (callback: () => void): (() => void) => {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== callback);
    };
  };

  /** For useSyncExternalStore — returns a new object only when state has changed. */
  getSnapshot = (): WorkspaceSnapshot => {
    return this._snapshot;
  };

  /** Classifies a file path. Returns "hidden" for paths with a segment starting with ".". */
  public static classifyFile(path: string): WorkspaceFileType | "hidden" {
    if (path.split("/").some((seg) => seg.startsWith("."))) return "hidden";
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "mei" || ext === "xml" || ext === "musicxml") return "MEI";
    if (
      [
        "jpg",
        "jpeg",
        "png",
        "gif",
        "svg",
        "bmp",
        "webp",
        "tiff",
        "tif",
      ].includes(ext)
    )
      return "Image";
    if (ext === "jsonld") return "WebAnnotation";
    return "Other";
  }

  /**
   * Adds a file path to the workspace. Returns null for hidden paths.
   * Returns the existing entry if the path is already present.
   *
   * isDirty initial value is determined by origin:
   *   - "workspace" → false  (file already exists in the workspace directory)
   *   - all others  → true   (file has not yet been written to a workspace dir)
   */
  public addFile(
    path: string,
    origin: EntryOrigin,
    type?: WorkspaceFileType,
  ): WorkspaceEntry | null {
    const classified = MeiFriendWorkspace.classifyFile(path);
    if (classified === "hidden") return null;

    const existing = this._entries.find((e) => e.path === path);
    if (existing) return existing;

    const entry: WorkspaceEntry = {
      id: Math.random().toString(36).substring(2, 11),
      path,
      type: type ?? classified,
      origin,
      isDirty: origin !== "workspace",
    };
    this._entries = [...this._entries, entry];
    this._notify();
    return entry;
  }

  /** Removes a file from the workspace and destroys its MeiFriend instance. */
  public removeFile(path: string): void {
    const entry = this._entries.find((e) => e.path === path);
    if (!entry) return;

    const unsub = this._unsubscribers.get(path);
    if (unsub) {
      unsub();
      this._unsubscribers.delete(path);
    }
    entry.meiFriend?.destroy();
    this._entries = this._entries.filter((e) => e.path !== path);
    this._notify();
  }

  /**
   * Loads or replaces MEI XML content for the given path.
   * The entry must already exist (added via addFile) and be of type "MEI".
   *
   * isDirty is NOT reset here for non-workspace files: loading content from the
   * original source does not mean the file has been written to the workspace
   * root directory. Only markSaved() resets isDirty.
   */
  public loadMeiContent(path: string, xmlString: string): MeiFriend {
    let entry = this._entries.find((e) => e.path === path);
    if (!entry) {
      // Fallback: auto-register with "loose" origin if not yet in workspace.
      const added = this.addFile(path, "loose", "MEI");
      if (!added) throw new Error(`Cannot add "${path}" to workspace.`);
      entry = added;
    } else if (entry.type !== "MEI") {
      throw new Error(`File "${path}" is not classified as MEI.`);
    }

    const existingUnsub = this._unsubscribers.get(path);
    if (existingUnsub) existingUnsub();
    entry.meiFriend?.destroy();

    const mf = MeiFriend.fromXmlString(xmlString);
    entry.meiFriend = mf;

    // "workspace" files: loading from disk means the local copy is in sync.
    // Other origins: isDirty stays true — content has not been saved to
    // the workspace root directory yet.
    if (entry.origin === "workspace") {
      entry.isDirty = false;
    }

    const unsub = mf.onUpdate(() => {
      if (entry) {
        entry.isDirty = true;
        this._notify();
      }
    });
    this._unsubscribers.set(path, unsub);

    this._notify();
    return mf;
  }

  public getMeiFriend(id: string): MeiFriend | undefined {
    return this._entries.find((e) => e.id === id || e.path === id)?.meiFriend;
  }

  /** Marks a file as saved (isDirty = false). Call after successfully writing to disk. */
  public markSaved(path: string): void {
    const entry = this._entries.find((e) => e.path === path);
    if (entry) {
      entry.isDirty = false;
      this._notify();
    }
  }

  /** Destroys all MeiFriend instances and clears the workspace. */
  public destroy(): void {
    for (const unsub of this._unsubscribers.values()) unsub();
    this._unsubscribers.clear();
    for (const entry of this._entries) {
      entry.meiFriend?.destroy();
    }
    this._entries = [];
    this._listeners = [];
    this._notify();
  }

  private _notify(): void {
    this._snapshot = {
      name: this._name,
      entries: [...this._entries],
      isDirty: this._entries.some((e) => e.isDirty),
    };
    for (const l of this._listeners) l();
  }
}
