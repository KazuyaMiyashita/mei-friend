import { Fragment } from 'react'
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels'
import type { LayoutNode, PanelInstance, TabGroupNode } from '../../features/app/layout/types'
import TabGroup, { type DraggingInfo } from './TabGroup'
import WelcomeScreen from './WelcomeScreen'
import './LayoutRenderer.css'

export interface LayoutCallbacks {
  onActivate: (panelId: string, groupId: string) => void
  onClose: (panelId: string, groupId: string) => void
  onFocusGroup: (groupId: string) => void
  onFileDrop: (file: File, groupId: string | null) => void
}

interface LayoutRendererProps {
  node: LayoutNode | null
  panels: Record<string, PanelInstance>
  callbacks: LayoutCallbacks
  draggingInfo: DraggingInfo | null
}

function getNodeKey(node: LayoutNode): string {
  return node.type === 'tabgroup' ? node.id : `split-${node.children.map(getNodeKey).join('-')}`
}

export default function LayoutRenderer({
  node,
  panels,
  callbacks,
  draggingInfo,
}: LayoutRendererProps) {
  if (node === null) {
    return <WelcomeScreen onFileDrop={(file) => callbacks.onFileDrop(file, null)} />
  }

  if (node.type === 'tabgroup') {
    return (
      <TabGroup
        node={node as TabGroupNode}
        panels={panels}
        draggingInfo={draggingInfo}
        onActivate={callbacks.onActivate}
        onClose={callbacks.onClose}
        onFocusGroup={callbacks.onFocusGroup}
        onFileDrop={(file) => callbacks.onFileDrop(file, node.id)}
      />
    )
  }

  return (
    <PanelGroup orientation={node.direction} className="panelGroup">
      {node.children.map((child, i) => (
        <Fragment key={getNodeKey(child)}>
          {i > 0 && <PanelResizeHandle className={`resizeHandle resizeHandle-${node.direction}`} />}
          <Panel minSize="10%">
            <LayoutRenderer
              node={child}
              panels={panels}
              callbacks={callbacks}
              draggingInfo={draggingInfo}
            />
          </Panel>
        </Fragment>
      ))}
    </PanelGroup>
  )
}
