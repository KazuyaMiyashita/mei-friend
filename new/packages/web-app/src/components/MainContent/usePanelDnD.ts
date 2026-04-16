import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/react";
import { useCallback, useState } from "react";
import type { DraggingInfo } from "./PanelContainer";
import type { LayoutState } from "./types";
import { findContainerById } from "./useLayout";

export type Zone = "top" | "bottom" | "left" | "right" | "center";

interface UsePanelDnDActions {
  movePanelToContainer: (
    panelId: string,
    sourceContainerId: string,
    targetContainerId: string,
  ) => void;
  splitContainer: (
    panelId: string,
    sourceContainerId: string,
    targetContainerId: string,
    direction: "horizontal" | "vertical",
    insertBefore: boolean,
  ) => void;
  reorderPanelInContainer: (
    containerId: string,
    oldIndex: number,
    newIndex: number,
  ) => void;
}

export function usePanelDnD(
  layoutStateRef: React.MutableRefObject<LayoutState>,
  actions: UsePanelDnDActions,
) {
  const [draggingInfo, setDraggingInfo] = useState<DraggingInfo | null>(null);

  const handleDragStart = useCallback(
    (event: Parameters<DragStartEvent>[0]) => {
      const sourceData = event.operation?.source?.data as
        | { panelId: string; containerId: string }
        | undefined;
      if (sourceData && layoutStateRef.current.layout) {
        const container = findContainerById(
          layoutStateRef.current.layout,
          sourceData.containerId,
        );
        const info: DraggingInfo = {
          panelId: sourceData.panelId,
          sourceContainerId: sourceData.containerId,
          sourceTabCount: container?.tabs.length ?? 0,
        };
        console.log("[DnD] dragStart", info);
        setDraggingInfo(info);
      }
    },
    [layoutStateRef],
  );

  const handleDragEnd = useCallback(
    (event: Parameters<DragEndEvent>[0]) => {
      setDraggingInfo(null);
      if (event.canceled) return;

      const source = event.operation.source;
      const target = event.operation.target;
      if (!source || !target) return;

      const sourceData = source.data as
        | { panelId: string; containerId: string }
        | undefined;
      const targetData = target.data as
        | { containerId: string; zone: Zone }
        | undefined;
      if (!sourceData || !targetData) return;

      const { panelId, containerId: srcContainerId } = sourceData;
      const { containerId: tgtContainerId, zone } = targetData;

      const isEdgeZone =
        zone === "top" ||
        zone === "bottom" ||
        zone === "left" ||
        zone === "right";

      if (!isEdgeZone) {
        if (srcContainerId === tgtContainerId) return;
        actions.movePanelToContainer(panelId, srcContainerId, tgtContainerId);
      } else {
        const direction =
          zone === "top" || zone === "bottom" ? "vertical" : "horizontal";
        const insertBefore = zone === "top" || zone === "left";
        actions.splitContainer(
          panelId,
          srcContainerId,
          tgtContainerId,
          direction,
          insertBefore,
        );
      }
    },
    [actions],
  );

  const handleDragOver = useCallback(
    (event: Parameters<DragOverEvent>[0]) => {
      const source = event.operation.source;
      const target = event.operation.target;
      if (!source || !target) return;

      const current = layoutStateRef.current;
      if (!current.layout) return;

      const sourceData = source.data as
        | { panelId: string; containerId: string }
        | undefined;
      const targetData = target.data as
        | { containerId: string; zone: Zone }
        | undefined;
      if (!sourceData || !targetData) return;

      const { panelId, containerId: srcContainerId } = sourceData;
      const { containerId: tgtContainerId, zone } = targetData;

      if (srcContainerId === tgtContainerId && zone === "center") {
        const container = findContainerById(current.layout, tgtContainerId);
        if (!container) return;
        const oldIndex = container.tabs.indexOf(panelId);
        const targetIndex = container.tabs.indexOf(target.id as string);
        if (oldIndex === -1 || targetIndex === -1 || oldIndex === targetIndex)
          return;

        actions.reorderPanelInContainer(tgtContainerId, oldIndex, targetIndex);
      }
    },
    [actions, layoutStateRef],
  );

  return {
    draggingInfo,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
  };
}
