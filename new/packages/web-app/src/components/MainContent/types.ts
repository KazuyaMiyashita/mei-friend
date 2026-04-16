export type PanelType =
  | "notation"
  | "xmlcode"
  | "annotation"
  | "facsimile"
  | "image";

export interface Panel {
  id: string;
  type: PanelType;
  meiFriendId: string | null;
  imagePath?: string;
}

export interface SplitLayoutNode {
  type: "split";
  direction: "horizontal" | "vertical";
  children: LayoutNode[];
}

export interface PanelContainerNode {
  type: "container";
  id: string;
  tabs: string[];
  activeTab: string | null;
}

export type LayoutNode = SplitLayoutNode | PanelContainerNode;

export interface LayoutState {
  panels: Record<string, Panel>;
  layout: LayoutNode | null;
  focusedPanelId: string | null;
}
