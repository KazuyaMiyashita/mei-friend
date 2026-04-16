import { useCallback, useState } from "react";
import type {
  LayoutNode,
  LayoutState,
  Panel,
  PanelContainerNode,
  SplitLayoutNode,
} from "./types";

/**
 * Unique ID generator for containers and panels
 */
export function uniqueId(prefix = "container"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Recursively walks the tree and transforms each PanelContainerNode.
 */
function mapLayout(
  node: LayoutNode,
  fn: (n: PanelContainerNode) => LayoutNode | null,
): LayoutNode | null {
  if (node.type === "container") {
    return fn(node);
  }
  const newChildren: LayoutNode[] = [];
  for (const child of node.children) {
    const mapped = mapLayout(child, fn);
    if (mapped !== null) newChildren.push(mapped);
  }
  if (newChildren.length === 0) return null;
  if (newChildren.length === 1) return newChildren[0];
  return { ...node, children: newChildren };
}

/**
 * Removes empty PanelContainerNodes and collapses single-child SplitLayoutNodes.
 */
function pruneEmptyContainers(node: LayoutNode): LayoutNode | null {
  if (node.type === "container") {
    return node.tabs.length === 0 ? null : node;
  }
  const newChildren: LayoutNode[] = [];
  for (const child of node.children) {
    const pruned = pruneEmptyContainers(child);
    if (pruned !== null) newChildren.push(pruned);
  }
  if (newChildren.length === 0) return null;
  if (newChildren.length === 1) return newChildren[0];
  return { ...node, children: newChildren };
}

/**
 * Recursively flattens same-direction split nodes.
 */
function flattenLayout(node: LayoutNode): LayoutNode {
  if (node.type === "container") return node;

  const flattenedChildren: LayoutNode[] = [];
  for (const child of node.children) {
    const processedChild = flattenLayout(child);
    if (
      processedChild.type === "split" &&
      processedChild.direction === node.direction
    ) {
      flattenedChildren.push(...processedChild.children);
    } else {
      flattenedChildren.push(processedChild);
    }
  }

  return { ...node, children: flattenedChildren };
}

export function findContainerById(
  node: LayoutNode,
  id: string,
): PanelContainerNode | null {
  if (node.type === "container") return node.id === id ? node : null;
  for (const child of node.children) {
    const found = findContainerById(child, id);
    if (found) return found;
  }
  return null;
}

export function useLayout(initialState: LayoutState) {
  const [layoutState, setLayoutState] = useState<LayoutState>(initialState);

  const setActivePanel = useCallback((panelId: string, containerId: string) => {
    setLayoutState((state) => {
      if (!state.layout) return state;
      const layout = mapLayout(state.layout, (c) =>
        c.id === containerId ? { ...c, activeTab: panelId } : c,
      );
      return { ...state, layout, focusedPanelId: panelId };
    });
  }, []);

  const closePanel = useCallback((panelId: string, containerId: string) => {
    setLayoutState((state) => {
      if (!state.layout) return state;

      const withPanelRemoved = mapLayout(state.layout, (c) => {
        if (c.id !== containerId) return c;
        const tabs = c.tabs.filter((t) => t !== panelId);
        const activeTab =
          c.activeTab === panelId
            ? (tabs[tabs.length - 1] ?? null)
            : c.activeTab;
        return { ...c, tabs, activeTab };
      });

      const pruned = withPanelRemoved
        ? pruneEmptyContainers(withPanelRemoved)
        : null;
      const panels = { ...state.panels };
      delete panels[panelId];

      let focusedPanelId = state.focusedPanelId;
      if (focusedPanelId === panelId) {
        focusedPanelId = null;
      }

      const finalLayout = pruned ? flattenLayout(pruned) : null;
      return { panels, layout: finalLayout, focusedPanelId };
    });
  }, []);

  const reorderPanelInContainer = useCallback(
    (containerId: string, oldIndex: number, newIndex: number) => {
      setLayoutState((state) => {
        if (!state.layout) return state;
        const layout = mapLayout(state.layout, (c) => {
          if (c.id !== containerId) return c;
          const tabs = [...c.tabs];
          const [moved] = tabs.splice(oldIndex, 1);
          tabs.splice(newIndex, 0, moved);
          return { ...c, tabs };
        });
        return { ...state, layout };
      });
    },
    [],
  );

  const movePanelToContainer = useCallback(
    (panelId: string, sourceContainerId: string, targetContainerId: string) => {
      setLayoutState((state) => {
        if (!state.layout) return state;
        if (sourceContainerId === targetContainerId) return state;

        const moved = mapLayout(state.layout, (c) => {
          if (c.id === sourceContainerId) {
            const tabs = c.tabs.filter((t) => t !== panelId);
            const activeTab =
              c.activeTab === panelId ? (tabs[0] ?? null) : c.activeTab;
            return { ...c, tabs, activeTab };
          }
          if (c.id === targetContainerId) {
            const tabs = [...c.tabs, panelId];
            return { ...c, tabs, activeTab: panelId };
          }
          return c;
        });

        const pruned = moved ? pruneEmptyContainers(moved) : null;
        const finalLayout = pruned ? flattenLayout(pruned) : null;
        return { ...state, layout: finalLayout, focusedPanelId: panelId };
      });
    },
    [],
  );

  const splitContainer = useCallback(
    (
      panelId: string,
      sourceContainerId: string,
      targetContainerId: string,
      direction: "horizontal" | "vertical",
      insertBefore: boolean,
    ) => {
      setLayoutState((state) => {
        if (!state.layout) return state;

        // 1. Remove panel from source container
        let updatedLayout = mapLayout(state.layout, (c) => {
          if (c.id !== sourceContainerId) return c;
          const tabs = c.tabs.filter((t) => t !== panelId);
          const activeTab =
            c.activeTab === panelId ? (tabs[0] ?? null) : c.activeTab;
          return { ...c, tabs, activeTab };
        });

        updatedLayout = updatedLayout
          ? pruneEmptyContainers(updatedLayout)
          : null;
        if (!updatedLayout) return state;

        // 2. Create new container for the panel
        const newContainer: PanelContainerNode = {
          type: "container",
          id: uniqueId(),
          tabs: [panelId],
          activeTab: panelId,
        };

        // 3. Insert split at target container
        updatedLayout = mapLayout(updatedLayout, (c) => {
          if (c.id !== targetContainerId) return c;
          const splitNode: SplitLayoutNode = {
            type: "split",
            direction,
            children: insertBefore ? [newContainer, c] : [c, newContainer],
          };
          return splitNode;
        });

        const finalLayout = updatedLayout ? flattenLayout(updatedLayout) : null;
        return { ...state, layout: finalLayout, focusedPanelId: panelId };
      });
    },
    [],
  );

  const addNewPanelToContainer = useCallback((containerId: string) => {
    setLayoutState((state) => {
      if (!state.layout) return state;

      const panelId = uniqueId("panel");
      const newPanel: Panel = {
        id: panelId,
        type: "notation",
        meiFriendId: "new-file.mei",
      };

      const panels = { ...state.panels, [panelId]: newPanel };
      const layout = mapLayout(state.layout, (c) => {
        if (c.id !== containerId) return c;
        return { ...c, tabs: [...c.tabs, panelId], activeTab: panelId };
      });

      return { panels, layout, focusedPanelId: panelId };
    });
  }, []);

  return {
    layoutState,
    setActivePanel,
    closePanel,
    reorderPanelInContainer,
    movePanelToContainer,
    splitContainer,
    addNewPanelToContainer,
  };
}
