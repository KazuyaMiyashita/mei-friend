/**
 * AppStateContext — session-level UI state.
 *
 * Owns only the state that describes *what the user is currently looking at*:
 * the active file path, the selected element ID, and the bridge between the
 * workspace data layer (WorkspaceContext) and the panel layout system
 * (MainContent / useLayout).
 *
 * Must be rendered inside <WorkspaceProvider> because openFileInPanel
 * delegates the lazy-load step to WorkspaceContext.loadFileIfNeeded.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useWorkspace, useWorkspaceContext } from "./WorkspaceContext";

// ── Context interface ─────────────────────────────────────────────────────────

interface AppState {
  activeMeiFriendPath: string | null;
  setActiveMeiFriendPath: (path: string | null) => void;

  activeSelectedId: string | null;
  setActiveSelectedId: (id: string | null) => void;

  focusedPanelId: string | null;
  setFocusedPanelId: (id: string | null) => void;

  /**
   * Opens a file in the main content panel.
   * Step 1: delegates to WorkspaceContext.loadFileIfNeeded to ensure the MEI
   *         content is in memory (lazy-load for "workspace" origin files).
   * Step 2: calls the registered panel opener to create or activate the panel.
   */
  openFileInPanel: (path: string) => void;

  /**
   * Used by MainContent to register its openOrActivateFile handler.
   * Returns a cleanup function that unregisters the handler.
   */
  registerPanelOpener: (fn: (path: string) => void) => () => void;
}

const AppStateContext = createContext<AppState | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  // Retrieve the lazy-load helper from the workspace layer.
  const { loadFileIfNeeded } = useWorkspaceContext();

  const [activeMeiFriendPath, setActiveMeiFriendPath] = useState<string | null>(
    null,
  );
  const [activeSelectedId, setActiveSelectedId] = useState<string | null>(null);
  const [focusedPanelId, setFocusedPanelId] = useState<string | null>(null);

  // Ref rather than state: the opener is set once by MainContent and never
  // triggers a re-render when changed.
  const panelOpenerRef = useRef<((path: string) => void) | null>(null);

  const registerPanelOpener = useCallback(
    (fn: (path: string) => void): (() => void) => {
      panelOpenerRef.current = fn;
      return () => {
        if (panelOpenerRef.current === fn) panelOpenerRef.current = null;
      };
    },
    [],
  );

  const openFileInPanel = useCallback(
    async (path: string): Promise<void> => {
      // Ensure content is in memory before handing off to the panel system.
      await loadFileIfNeeded(path);
      panelOpenerRef.current?.(path);
    },
    [loadFileIfNeeded],
  );

  const value: AppState = {
    activeMeiFriendPath,
    setActiveMeiFriendPath,
    activeSelectedId,
    setActiveSelectedId,
    focusedPanelId,
    setFocusedPanelId,
    openFileInPanel,
    registerPanelOpener,
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}

/**
 * Returns the active MeiFriend instance together with its path and the
 * current selection state. Combines data from both context layers.
 */
export function useActiveMeiFriend() {
  const { workspace } = useWorkspace();
  const {
    activeMeiFriendPath,
    setActiveMeiFriendPath,
    activeSelectedId,
    setActiveSelectedId,
    focusedPanelId,
    setFocusedPanelId,
  } = useAppState();

  const activeMeiFriend = useMemo(
    () =>
      activeMeiFriendPath
        ? (workspace.getMeiFriend(activeMeiFriendPath) ?? null)
        : null,
    [activeMeiFriendPath, workspace],
  );

  const [historyState, setHistoryState] = useState({
    canUndo: false,
    canRedo: false,
  });

  useEffect(() => {
    if (!activeMeiFriend) {
      setHistoryState({ canUndo: false, canRedo: false });
      return;
    }

    const updateHistory = () => {
      setHistoryState({
        canUndo: activeMeiFriend.canUndo,
        canRedo: activeMeiFriend.canRedo,
      });
    };

    updateHistory();
    return activeMeiFriend.onUpdate(updateHistory);
  }, [activeMeiFriend]);

  return {
    activeMeiFriend,
    activeMeiFriendPath,
    setActiveMeiFriendPath,
    activeSelectedId,
    setActiveSelectedId,
    focusedPanelId,
    setFocusedPanelId,
    ...historyState,
  };
}

export type { AppSettings } from "./WorkspaceContext";
// Re-export hooks that components may import from this module for convenience.
export { useWorkspace } from "./WorkspaceContext";
