import type { MeiFriend } from "@mei-friend/core";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLiveShare } from "./LiveShareContext";
import { useWorkspaceContext } from "./WorkspaceContext";

// ── Types ────────────────────────────────────────────────────────────────────

export type MeiFriendSource = "workspace" | "live-share";

export interface MeiFriendLocation {
  source: MeiFriendSource;
  id: string;
}

interface FocusContextValue {
  focusedLocation: MeiFriendLocation | null;
  setFocusedLocation: (loc: MeiFriendLocation | null) => void;

  focusedPanelId: string | null;
  setFocusedPanelId: (id: string | null) => void;

  /**
   * Selection state (e.g. selected element ID) per MeiFriend.
   * Key is a stable string representation of MeiFriendLocation.
   */
  selections: Record<
    string,
    { selectionId: string | null; origin: string | null }
  >;
  setMeiFriendSelection: (
    location: MeiFriendLocation,
    selectionId: string | null,
    origin: string | null,
  ) => void;

  /**
   * Tool settings (temporary, not persisted in localStorage)
   */
  navigateEnabled: boolean;
  setNavigateEnabled: (enabled: boolean) => void;

  /**
   * Opens a MeiFriend in the main content panel.
   */
  openMeiFriendInPanel: (location: MeiFriendLocation) => Promise<void>;

  /**
   * Used by MainContent to register its openOrActivateMeiFriend handler.
   */
  registerPanelOpener: (
    fn: (location: MeiFriendLocation) => void,
  ) => () => void;
}

const FocusContext = createContext<FocusContextValue | null>(null);

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getLocationKey(loc: MeiFriendLocation): string {
  return `${loc.source}:${loc.id}`;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const { loadFileIfNeeded } = useWorkspaceContext();
  const { loadLiveShareMeiFriendIfNeeded } = useLiveShare();

  const [focusedLocation, setFocusedLocation] =
    useState<MeiFriendLocation | null>(null);
  const [focusedPanelId, setFocusedPanelId] = useState<string | null>(null);
  const [selections, setSelections] = useState<
    Record<string, { selectionId: string | null; origin: string | null }>
  >({});
  const [navigateEnabled, setNavigateEnabled] = useState(false);

  const setMeiFriendSelection = useCallback(
    (
      location: MeiFriendLocation,
      selectionId: string | null,
      origin: string | null,
    ) => {
      const key = getLocationKey(location);
      setSelections((prev) => ({ ...prev, [key]: { selectionId, origin } }));
    },
    [],
  );

  const panelOpenerRef = useRef<((loc: MeiFriendLocation) => void) | null>(
    null,
  );

  const registerPanelOpener = useCallback(
    (fn: (loc: MeiFriendLocation) => void) => {
      panelOpenerRef.current = fn;
      return () => {
        if (panelOpenerRef.current === fn) panelOpenerRef.current = null;
      };
    },
    [],
  );

  const openMeiFriendInPanel = useCallback(
    async (location: MeiFriendLocation) => {
      if (location.source === "workspace") {
        await loadFileIfNeeded(location.id);
      } else {
        await loadLiveShareMeiFriendIfNeeded(location.id);
      }
      panelOpenerRef.current?.(location);
    },
    [loadFileIfNeeded, loadLiveShareMeiFriendIfNeeded],
  );

  const value: FocusContextValue = {
    focusedLocation,
    setFocusedLocation,
    focusedPanelId,
    setFocusedPanelId,
    selections,
    setMeiFriendSelection,
    navigateEnabled,
    setNavigateEnabled,
    openMeiFriendInPanel,
    registerPanelOpener,
  };

  return (
    <FocusContext.Provider value={value}>{children}</FocusContext.Provider>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useFocus() {
  const context = useContext(FocusContext);
  if (!context) throw new Error("useFocus must be used within FocusProvider");
  return context;
}

/**
 * Returns the MeiFriend instance for a given location.
 */
export function useMeiFriend(location: MeiFriendLocation | null) {
  const { workspace } = useWorkspaceContext();
  const { sharedMeiFriends } = useLiveShare();

  return useMemo(() => {
    if (!location) return null;
    if (location.source === "workspace") {
      return workspace.getMeiFriend(location.id) ?? null;
    }
    return sharedMeiFriends.get(location.id)?.meiFriend ?? null;
  }, [location, workspace, sharedMeiFriends]);
}

/**
 * Returns the currently focused MeiFriend instance and its metadata.
 */
export function useFocusedMeiFriend() {
  const {
    focusedLocation,
    setFocusedLocation,
    focusedPanelId,
    setFocusedPanelId,
    selections,
    setMeiFriendSelection,
    navigateEnabled,
  } = useFocus();

  const focusedMeiFriend = useMeiFriend(focusedLocation);

  const selectionState = useMemo(() => {
    if (!focusedLocation) return { selectionId: null, origin: null };
    return (
      selections[getLocationKey(focusedLocation)] ?? {
        selectionId: null,
        origin: null,
      }
    );
  }, [focusedLocation, selections]);

  const setFocusedSelectionId = useCallback(
    (id: string | null, origin: string | null = null) => {
      if (focusedLocation) {
        setMeiFriendSelection(focusedLocation, id, origin);
      }
    },
    [focusedLocation, setMeiFriendSelection],
  );

  const [historyState, setHistoryState] = useState({
    canUndo: false,
    canRedo: false,
  });

  useEffect(() => {
    if (!focusedMeiFriend) {
      setHistoryState({ canUndo: false, canRedo: false });
      return;
    }

    const updateHistory = () => {
      setHistoryState({
        canUndo: (focusedMeiFriend as MeiFriend).canUndo,
        canRedo: (focusedMeiFriend as MeiFriend).canRedo,
      });
    };

    updateHistory();
    return (focusedMeiFriend as MeiFriend).onUpdate(updateHistory);
  }, [focusedMeiFriend]);

  return {
    focusedMeiFriend,
    focusedLocation,
    setFocusedLocation,
    focusedSelectionId: selectionState.selectionId,
    focusedSelectionOrigin: selectionState.origin,
    setFocusedSelectionId,
    focusedPanelId,
    setFocusedPanelId,
    navigateEnabled,
    ...historyState,
  };
}
