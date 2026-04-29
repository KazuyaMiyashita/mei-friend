import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export type PanelContentType = "mei" | "image";

export interface PanelContent {
  type: PanelContentType;
  id: string; // meiFriendId or image path
}

interface FocusedPanelContextValue {
  focusedPanelId: string | null;
  setFocusedPanelId: (id: string | null) => void;

  /**
   * Tracks what content is being displayed in each panel.
   * Key is the panel ID.
   */
  panels: Record<string, PanelContent>;
  setPanelContent: (panelId: string, content: PanelContent | null) => void;

  /**
   * Opens content in the main content area (UI only).
   */
  openContentInPanel: (content: PanelContent) => void;

  /**
   * Used by MainContent to register its open handler.
   */
  registerPanelOpener: (fn: (content: PanelContent) => void) => () => void;
}

const FocusedPanelContext = createContext<FocusedPanelContextValue | null>(
  null,
);

// ── Provider ──────────────────────────────────────────────────────────────────

export function FocusedPanelProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [focusedPanelId, setFocusedPanelId] = useState<string | null>(null);
  const [panels, setPanels] = useState<Record<string, PanelContent>>({});

  const setPanelContent = useCallback(
    (panelId: string, content: PanelContent | null) => {
      setPanels((prev) => {
        const next = { ...prev };
        if (content) {
          next[panelId] = content;
        } else {
          delete next[panelId];
        }
        return next;
      });
    },
    [],
  );

  const panelOpenerRef = useRef<((content: PanelContent) => void) | null>(null);

  const registerPanelOpener = useCallback(
    (fn: (content: PanelContent) => void) => {
      panelOpenerRef.current = fn;
      return () => {
        if (panelOpenerRef.current === fn) panelOpenerRef.current = null;
      };
    },
    [],
  );

  const openContentInPanel = useCallback((content: PanelContent) => {
    panelOpenerRef.current?.(content);
  }, []);

  const value: FocusedPanelContextValue = {
    focusedPanelId,
    setFocusedPanelId,
    panels,
    setPanelContent,
    openContentInPanel,
    registerPanelOpener,
  };

  return (
    <FocusedPanelContext.Provider value={value}>
      {children}
    </FocusedPanelContext.Provider>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useFocusedPanel() {
  const context = useContext(FocusedPanelContext);
  if (!context)
    throw new Error("useFocusedPanel must be used within FocusedPanelProvider");
  return context;
}

/**
 * Returns the content of the currently focused panel.
 */
export function useFocusedContent(): PanelContent | null {
  const { focusedPanelId, panels } = useFocusedPanel();
  return useMemo(() => {
    if (!focusedPanelId) return null;
    return panels[focusedPanelId] ?? null;
  }, [focusedPanelId, panels]);
}
