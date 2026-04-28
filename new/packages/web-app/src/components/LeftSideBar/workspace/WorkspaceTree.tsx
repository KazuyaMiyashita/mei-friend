import type { WorkspaceEntry, WorkspaceFileType } from "@mei-friend/core";
import { useState } from "react";
import styles from "./WorkspaceTree.module.css";

// ── Tree structure ────────────────────────────────────────────────────────────

interface DirNode {
  kind: "dir";
  name: string;
  children: Map<string, TreeNode>;
}

interface FileNode {
  kind: "file";
  name: string;
  entry: WorkspaceEntry;
}

type TreeNode = DirNode | FileNode;

function sortedEntries(map: Map<string, TreeNode>): [string, TreeNode][] {
  return [...map.entries()].sort(([aName, aNode], [bName, bNode]) => {
    if (aNode.kind !== bNode.kind) return aNode.kind === "dir" ? -1 : 1;
    return aName.localeCompare(bName);
  });
}

function buildTree(entries: readonly WorkspaceEntry[]): Map<string, TreeNode> {
  const root = new Map<string, TreeNode>();
  for (const entry of entries) {
    const parts = entry.path.split("/");
    let current = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      let node = current.get(part);
      if (!node) {
        node = { kind: "dir", name: part, children: new Map() };
        current.set(part, node);
      }
      if (node.kind === "dir") current = node.children;
    }
    const fileName = parts[parts.length - 1];
    current.set(fileName, { kind: "file", name: fileName, entry });
  }
  return root;
}

// ── File icons ────────────────────────────────────────────────────────────────

function fileIcon(type: WorkspaceFileType): string {
  switch (type) {
    case "MEI":
      return "🎼";
    case "Image":
      return "🖼";
    case "WebAnnotation":
      return "📝";
    default:
      return "📄";
  }
}

// ── TreeNodeView ──────────────────────────────────────────────────────────────

interface TreeNodeViewProps {
  name: string;
  node: TreeNode;
  depth: number;
  activeId: string | null;
  onFileClick: (id: string, type: WorkspaceFileType) => void;
}

function TreeNodeView({
  name,
  node,
  depth,
  activeId,
  onFileClick,
}: TreeNodeViewProps) {
  const [open, setOpen] = useState(true);
  const indent = depth * 14;

  if (node.kind === "file") {
    const { entry } = node;
    const isActive = activeId === entry.id;
    const isClickable = entry.type === "MEI";

    return (
      <button
        type="button"
        className={`${styles.fileNode}${isActive ? ` ${styles.active}` : ""}${!isClickable ? ` ${styles.nonClickable}` : ""}`}
        style={{ paddingLeft: `${indent + 8}px` }}
        onClick={() => isClickable && onFileClick(entry.id, entry.type)}
        title={entry.path}
      >
        <span className={styles.icon}>{fileIcon(entry.type)}</span>
        <span className={styles.name}>{name}</span>
        {entry.isDirty && (
          <span className={styles.openIndicator} title="Unsaved changes">
            ●
          </span>
        )}
      </button>
    );
  }

  // Directory node
  return (
    <div className={styles.treeNode}>
      <button
        type="button"
        className={styles.treeLabel}
        style={{ paddingLeft: `${indent + 2}px` }}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`${styles.arrow}${open ? ` ${styles.open}` : ""}`}>
          ▶
        </span>
        <span className={styles.icon}>📁</span>
        <span className={styles.name}>{name}</span>
      </button>
      {open && (
        <div>
          {sortedEntries(node.children).map(([childName, childNode]) => (
            <TreeNodeView
              key={childName}
              name={childName}
              node={childNode}
              depth={depth + 1}
              activeId={activeId}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── WorkspaceTree ─────────────────────────────────────────────────────────────

interface WorkspaceTreeProps {
  entries: readonly WorkspaceEntry[];
  activeId: string | null;
  onFileClick: (id: string, type: WorkspaceFileType) => void;
}

export default function WorkspaceTree({
  entries,
  activeId,
  onFileClick,
}: WorkspaceTreeProps) {
  const tree = buildTree(entries);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className={styles.workspaceTree}>
      {sortedEntries(tree).map(([name, node]) => (
        <TreeNodeView
          key={name}
          name={name}
          node={node}
          depth={0}
          activeId={activeId}
          onFileClick={onFileClick}
        />
      ))}
    </div>
  );
}
