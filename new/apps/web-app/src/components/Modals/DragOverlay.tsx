import './Modals.css'

interface DragOverlayProps {
  visible: boolean
}

export default function DragOverlay({ visible }: DragOverlayProps) {
  if (!visible) return null
  return (
    <div className="dragOverlay">
      <div className="dragOverlayText" id="dragOverlayText">
        Drag your input file here.
      </div>
    </div>
  )
}
