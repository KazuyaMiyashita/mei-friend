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

export type WorkspaceFileType = "MEI" | "Image" | "WebAnnotation" | "Other";

export interface WorkspaceEntry {
  /** A stable identifier for this entry within the workspace. */
  readonly id: string;
  /** The path relative to the workspace root. */
  readonly path: string;
  /** The classified type of the file. */
  readonly type: WorkspaceFileType;
  /** Immutable provenance of where this entry came from. */
  readonly origin: EntryOrigin;
  /**
   * True when the workspace root directory does not reflect the current state
   * of this file.
   */
  isDirty: boolean;
  /**
   * The in-memory ID of the associated MeiFriend instance, if loaded.
   * This links the workspace metadata to the actual document model managed
   * by the application's registry.
   */
  meiFriendId?: string;
}

export interface WorkspaceSnapshot {
  name: string | undefined;
  entries: readonly WorkspaceEntry[];
  isDirty: boolean;
}

/**
 * MeiFriendWorkspace represents a named collection of file metadata (a manifest).
 * It is a pure data structure and does not manage the lifecycle of MeiFriend
 * instances or perform any I/O.
 *
 * The application (e.g., via WorkspaceContext) is responsible for:
 * 1. Performing file I/O and creating/destroying MeiFriend instances.
 * 2. Registering those instances in a global registry.
 * 3. Updating the `meiFriendId` in the workspace entries to link them.
 */
export class MeiFriendWorkspace {
  private _name: string;
  private _entries: WorkspaceEntry[] = [];
  private _listeners: Array<() => void> = [];
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

    const entryId = Math.random().toString(36).substring(2, 11);
    const finalType = type ?? classified;
    const entry: WorkspaceEntry = {
      id: entryId,
      path,
      type: finalType,
      origin,
      isDirty: origin !== "workspace",
      meiFriendId: finalType === "MEI" ? entryId : undefined,
    };
    this._entries = [...this._entries, entry];
    this._notify();
    return entry;
  }

  /** Removes a file from the workspace. */
  public removeFile(path: string): void {
    this._entries = this._entries.filter((e) => e.path !== path);
    this._notify();
  }

  /** Updates an entry's state. */
  public updateEntry(path: string, patch: Partial<WorkspaceEntry>): void {
    const entry = this._entries.find((e) => e.path === path);
    if (entry) {
      Object.assign(entry, patch);
      this._notify();
    }
  }

  /** Marks a file as saved (isDirty = false). */
  public markSaved(path: string): void {
    this.updateEntry(path, { isDirty: false });
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
