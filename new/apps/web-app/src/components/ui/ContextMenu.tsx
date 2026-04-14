import { useEffect, useRef } from 'react'
import './ContextMenu.css'

export type ContextMenuItem =
  | { label: string; onClick: () => void; disabled?: boolean; separator?: never }
  | { separator: true; label?: never; onClick?: never; disabled?: never }

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  return (
    <div ref={ref} className="contextMenu" style={{ left: x, top: y }}>
      {items.map((item, i) => {
        const key = item.separator ? `sep-${i}` : `${item.label}-${i}`
        if (item.separator) {
          return <hr key={key} className="contextMenuSeparator" />
        }
        return (
          <button
            key={key}
            type="button"
            className={`contextMenuItem${item.disabled ? ' disabled' : ''}`}
            onClick={() => {
              if (!item.disabled) {
                item.onClick()
                onClose()
              }
            }}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
