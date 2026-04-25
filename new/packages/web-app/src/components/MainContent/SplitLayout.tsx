import { Fragment } from "react";
import {
  Panel as RRPanel,
  Group as RRPanelGroup,
  Separator as RRPanelResizeHandle,
} from "react-resizable-panels";
import PanelContainer, { type DraggingInfo } from "./PanelContainer";
import styles from "./SplitLayout.module.css";
import type { LayoutNode, Panel } from "./types";

export interface LayoutCallbacks {
  onActivate: (panelId: string, containerId: string) => void;
  onClose: (panelId: string, containerId: string) => void;
  onFocusContainer: (containerId: string) => void;
  onNewPanel: (containerId: string) => void;
  onOpenCodeMirror: (panelId: string, containerId: string) => void;
  onFileDrop: (file: File, containerId: string | null) => void;
}

interface SplitLayoutProps {
  node: LayoutNode;
  panels: Record<string, Panel>;
  focusedPanelId: string | null;
  callbacks: LayoutCallbacks;
  draggingInfo: DraggingInfo | null;
}

function getNodeKey(node: LayoutNode): string {
  return node.type === "container"
    ? node.id
    : `split-${node.children.map(getNodeKey).join("-")}`;
}

export default function SplitLayout({
  node,
  panels,
  focusedPanelId,
  callbacks,
  draggingInfo,
}: SplitLayoutProps) {
  if (node.type === "container") {
    return (
      <PanelContainer
        node={node}
        panels={panels}
        focusedPanelId={focusedPanelId}
        draggingInfo={draggingInfo}
        onActivate={callbacks.onActivate}
        onClose={callbacks.onClose}
        onFocusContainer={callbacks.onFocusContainer}
        onNewPanel={callbacks.onNewPanel}
        onOpenCodeMirror={callbacks.onOpenCodeMirror}
        onFileDrop={(file) => callbacks.onFileDrop(file, node.id)}
      />
    );
  }

  return (
    <RRPanelGroup orientation={node.direction} className={styles.splitLayout}>
      {node.children.map((child: LayoutNode, i: number) => (
        <Fragment key={getNodeKey(child)}>
          {i > 0 && (
            <RRPanelResizeHandle
              className={`${styles.resizeHandle} ${
                node.direction === "horizontal"
                  ? styles.resizeHandleHorizontal
                  : styles.resizeHandleVertical
              }`}
            />
          )}
          <RRPanel minSize={10}>
            <SplitLayout
              node={child}
              panels={panels}
              focusedPanelId={focusedPanelId}
              callbacks={callbacks}
              draggingInfo={draggingInfo}
            />
          </RRPanel>
        </Fragment>
      ))}
    </RRPanelGroup>
  );
}
