import type { Cursor, MeiFriend } from "@mei-friend/core";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type MeiFriendSource = "workspace" | "live-share" | "memory";

/**
 * Metadata and cross-cutting state associated with a single MeiFriend instance.
 */
export interface MeiFriendState {
  /** The name of the file or shared document, used for display in UI. */
  name: string;
  /** The provenance of this document instance. */
  source: MeiFriendSource;
  /**
   * The ID of the currently selected element within this MeiFriend instance.
   * This is used to synchronize selection across different panels and UI components.
   */
  selectionId: string | null;
  /**
   * The origin of the current selection (e.g., "verovio", "codemirror").
   * This prevents infinite loops where a component reacts to its own selection change.
   */
  selectionOrigin: string | null;
  /**
   * The current cursor position within this MeiFriend instance.
   */
  cursor: Cursor | null;
}

const DEFAULT_STATE: Omit<MeiFriendState, "name" | "source"> = {
  selectionId: null,
  selectionOrigin: null,
  cursor: null,
};

interface MeiFriendRegistryContextValue {
  /** Map of all active MeiFriend instances in the application. */
  registry: Map<string, MeiFriend>;
  /** Map of states (selection, etc.) for each MeiFriend instance. */
  states: Map<string, MeiFriendState>;

  registerMeiFriend: (
    meiFriend: MeiFriend,
    info: { name: string; source: MeiFriendSource },
  ) => void;

  unregisterMeiFriend: (meiFriendId: string) => void;

  /** Updates the state for a specific MeiFriend. */
  updateMeiFriendState: (
    meiFriendId: string,
    patch: Partial<MeiFriendState>,
  ) => void;
}

const MeiFriendRegistryContext =
  createContext<MeiFriendRegistryContextValue | null>(null);

export function MeiFriendRegistryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [registry, setRegistry] = useState<Map<string, MeiFriend>>(new Map());
  const [states, setStates] = useState<Map<string, MeiFriendState>>(new Map());

  const registerMeiFriend = useCallback(
    (meiFriend: MeiFriend, info: { name: string; source: MeiFriendSource }) => {
      setRegistry((prev) =>
        new Map(prev).set(meiFriend.meiFriendId, meiFriend),
      );
      setStates((prev) => {
        if (prev.has(meiFriend.meiFriendId)) return prev;
        return new Map(prev).set(meiFriend.meiFriendId, {
          ...DEFAULT_STATE,
          name: info.name,
          source: info.source,
        });
      });
    },
    [],
  );

  const unregisterMeiFriend = useCallback((meiFriendId: string) => {
    setRegistry((prev) => {
      const next = new Map(prev);
      next.delete(meiFriendId);
      return next;
    });
    setStates((prev) => {
      const next = new Map(prev);
      next.delete(meiFriendId);
      return next;
    });
  }, []);

  const updateMeiFriendState = useCallback(
    (meiFriendId: string, patch: Partial<MeiFriendState>) => {
      setStates((prev) => {
        const current = prev.get(meiFriendId) ?? {
          ...DEFAULT_STATE,
          name: "Unknown",
          source: "memory",
        };
        return new Map(prev).set(meiFriendId, { ...current, ...patch });
      });
    },
    [],
  );

  return (
    <MeiFriendRegistryContext.Provider
      value={{
        registry,
        states,
        registerMeiFriend,
        unregisterMeiFriend,
        updateMeiFriendState,
      }}
    >
      {children}
    </MeiFriendRegistryContext.Provider>
  );
}

export function useMeiFriendRegistry() {
  const context = useContext(MeiFriendRegistryContext);
  if (!context) {
    throw new Error(
      "useMeiFriendRegistry must be used within MeiFriendRegistryProvider",
    );
  }
  return context;
}

/**
 * Returns the MeiFriend instance and its associated state for a given ID.
 * Subscribes to changes in both the registry and the state.
 */
export function useMeiFriend(meiFriendId: string | null | undefined) {
  const { registry, states, updateMeiFriendState } = useMeiFriendRegistry();

  const setSelection = useCallback(
    (selectionId: string | null, origin: string | null = null) => {
      if (meiFriendId) {
        updateMeiFriendState(meiFriendId, {
          selectionId,
          selectionOrigin: origin,
        });
      }
    },
    [meiFriendId, updateMeiFriendState],
  );

  const setCursor = useCallback(
    (cursor: Cursor | null) => {
      if (meiFriendId) {
        updateMeiFriendState(meiFriendId, { cursor });
      }
    },
    [meiFriendId, updateMeiFriendState],
  );

  if (!meiFriendId) {
    return {
      meiFriend: null,
      state: null,
      setSelection,
      setCursor,
    };
  }

  const meiFriend = registry.get(meiFriendId) ?? null;
  const state = states.get(meiFriendId) ?? null;

  return {
    meiFriend,
    state,
    setSelection,
    setCursor,
  };
}

import { useFocusedContent } from "./FocusedPanelContext";

/**
 * Returns the currently focused MeiFriend instance and its associated state.
 * Automatically subscribes to history changes (undo/redo).
 */
export function useFocusedMeiFriend() {
  const focusedContent = useFocusedContent();
  const meiFriendId = focusedContent?.type === "mei" ? focusedContent.id : null;
  const { meiFriend, state, setSelection, setCursor } =
    useMeiFriend(meiFriendId);

  const [historyState, setHistoryState] = useState({
    canUndo: false,
    canRedo: false,
  });

  useEffect(() => {
    if (!meiFriend) {
      setHistoryState({ canUndo: false, canRedo: false });
      return;
    }

    const updateHistory = () => {
      setHistoryState({
        canUndo: meiFriend.canUndo,
        canRedo: meiFriend.canRedo,
      });
    };

    updateHistory();
    return meiFriend.onUpdate(updateHistory);
  }, [meiFriend]);

  return {
    meiFriend,
    state,
    setSelection,
    setCursor,
    ...historyState,
  };
}
