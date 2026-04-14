import { classifyWorkspaceFile, type WorkspaceFileKind } from '@mei-friend/core'
import { useMemo, useState } from 'react'
import './WorkspaceTree.css'

interface ViewFolder {
  name: string
  path: string
  children: ViewNode[]
}
interface ViewFile {
  name: string
  path: string
  kind: WorkspaceFileKind
}
type ViewNode = ViewFolder | ViewFile

interface WorkspaceTreeProps {
  files: readonly string[]
  onOpenFile: (path: string) => void
  onOpenImage: (path: string) => void
  openFilePaths: string[]
  openImagePaths: string[]
}

export default function WorkspaceTree({
  files,
  onOpenFile,
  onOpenImage,
  openFilePaths,
  openImagePaths,
}: WorkspaceTreeProps) {
  const tree = useMemo(() => buildViewTree(files), [files])

  return (
    <div className="workspaceTree">
      {tree.children.map((node) => (
        <Node
          key={node.path}
          node={node}
          onOpenFile={onOpenFile}
          onOpenImage={onOpenImage}
          openFilePaths={openFilePaths}
          openImagePaths={openImagePaths}
          depth={0}
        />
      ))}
    </div>
  )
}

function Node({
  node,
  onOpenFile,
  onOpenImage,
  openFilePaths,
  openImagePaths,
  depth,
}: {
  node: ViewNode
  onOpenFile: (path: string) => void
  onOpenImage: (path: string) => void
  openFilePaths: string[]
  openImagePaths: string[]
  depth: number
}) {
  const [isOpen, setIsOpen] = useState(true)
  const isFolder = 'children' in node

  if (isFolder) {
    return (
      <div className="treeNode folderNode" style={{ paddingLeft: depth * 12 }}>
        <button type="button" className="treeLabel folderLabel" onClick={() => setIsOpen(!isOpen)}>
          <span className={`arrow ${isOpen ? 'open' : ''}`}>▶</span>
          <span className="icon">📁</span>
          <span className="name">{node.name}</span>
        </button>
        {isOpen && (
          <div className="folderChildren">
            {node.children.map((child) => (
              <Node
                key={child.path}
                node={child}
                onOpenFile={onOpenFile}
                onOpenImage={onOpenImage}
                openFilePaths={openFilePaths}
                openImagePaths={openImagePaths}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  const isOpenInEditor = openFilePaths.includes(node.path)
  const isOpenAsImage = openImagePaths.includes(node.path)
  const isActive = isOpenInEditor || isOpenAsImage

  const handleClick = () => {
    if (node.kind === 'mei') onOpenFile(node.path)
    else if (node.kind === 'image') onOpenImage(node.path)
  }

  const isClickable = node.kind === 'mei' || node.kind === 'image'

  return (
    <button
      type="button"
      className={`treeNode fileNode${isActive ? ' active' : ''}${isClickable ? '' : ' nonClickable'}`}
      style={{ paddingLeft: depth * 12 + 16 }}
      onClick={isClickable ? handleClick : undefined}
      disabled={!isClickable}
    >
      <span className="icon">{getFileIcon(node.kind)}</span>
      <span className="name">{node.name}</span>
      {isActive && <span className="openIndicator">•</span>}
    </button>
  )
}

function getFileIcon(kind: WorkspaceFileKind) {
  switch (kind) {
    case 'mei':
      return '🎼'
    case 'image':
      return '🖼️'
    case 'annotation':
      return '📝'
    default:
      return '📄'
  }
}

function buildViewTree(files: readonly string[]): ViewFolder {
  const root: ViewFolder = { name: '', path: '', children: [] }

  for (const path of files) {
    const parts = path.split('/')
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      const currentPath = parts.slice(0, i + 1).join('/')

      if (isLast) {
        current.children.push({
          name: part,
          path: currentPath,
          kind: classifyWorkspaceFile(part),
        })
      } else {
        let folder = current.children.find((c) => 'children' in c && c.name === part) as
          | ViewFolder
          | undefined
        if (!folder) {
          folder = { name: part, path: currentPath, children: [] }
          current.children.push(folder)
        }
        current = folder
      }
    }
  }

  // Sort: folders first, then alphabetical
  const sortNodes = (nodes: ViewNode[]) => {
    nodes.sort((a, b) => {
      const aIsFolder = 'children' in a
      const bIsFolder = 'children' in b
      if (aIsFolder && !bIsFolder) return -1
      if (!aIsFolder && bIsFolder) return 1
      return a.name.localeCompare(b.name)
    })
    for (const node of nodes) {
      if ('children' in node) sortNodes(node.children)
    }
  }

  sortNodes(root.children)
  return root
}
