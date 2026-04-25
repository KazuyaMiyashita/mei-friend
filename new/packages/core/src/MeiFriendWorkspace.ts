import { MeiFriend } from "./MeiFriend.js";

export type WorkspaceFileType = "MEI" | "Image" | "WebAnnotation" | "Other";

export interface WorkspaceEntry {
  readonly path: string;
  readonly type: WorkspaceFileType;
  meiFriend?: MeiFriend;
  isDirty: boolean;
}

export interface WorkspaceSnapshot {
  name: string | undefined;
  entries: readonly WorkspaceEntry[];
  isDirty: boolean;
}

function classifyFile(path: string): WorkspaceFileType {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "mei" || ext === "xml" || ext === "musicxml") return "MEI";
  if (
    ["jpg", "jpeg", "png", "gif", "svg", "bmp", "webp", "tiff", "tif"].includes(
      ext,
    )
  )
    return "Image";
  if (ext === "jsonld") return "WebAnnotation";
  return "Other";
}

/**
 * Manages a workspace — a named collection of file paths with optional MEI content.
 * Does not perform any file I/O; call loadMeiContent() to supply MEI XML data.
 *
 * subscribe/getSnapshot follow the useSyncExternalStore convention.
 */
export class MeiFriendWorkspace {
  private _name?: string;
  private _entries: WorkspaceEntry[] = [];
  private _listeners: Array<() => void> = [];
  private _unsubscribers = new Map<string, () => void>();
  private _snapshot: WorkspaceSnapshot = {
    name: undefined,
    entries: [],
    isDirty: false,
  };

  get name(): string | undefined {
    return this._name;
  }
  set name(v: string | undefined) {
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

  /** Adds a file path to the workspace. Returns the existing entry if already present. */
  public addFile(path: string, type?: WorkspaceFileType): WorkspaceEntry {
    const existing = this._entries.find((e) => e.path === path);
    if (existing) return existing;

    const entry: WorkspaceEntry = {
      path,
      type: type ?? classifyFile(path),
      isDirty: false,
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
   * Adds the file to the workspace as "MEI" type if not already present.
   */
  public loadMeiContent(path: string, xmlString: string): MeiFriend {
    let entry = this._entries.find((e) => e.path === path);
    if (!entry) {
      this.addFile(path, "MEI");
      const added = this._entries.find((e) => e.path === path);
      if (!added) throw new Error(`Failed to add "${path}" to workspace.`);
      entry = added;
    } else if (entry.type !== "MEI") {
      throw new Error(`File "${path}" is not classified as MEI.`);
    }

    const existingUnsub = this._unsubscribers.get(path);
    if (existingUnsub) existingUnsub();
    entry.meiFriend?.destroy();

    const mf = MeiFriend.fromXmlString(xmlString);
    entry.meiFriend = mf;
    entry.isDirty = false;

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

  public getMeiFriend(path: string): MeiFriend | undefined {
    return this._entries.find((e) => e.path === path)?.meiFriend;
  }

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
