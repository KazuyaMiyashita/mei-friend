import { getActiveMeter, getDurationAndOffset, getElementById } from '@mei-friend2/core'
import { useEffect } from 'react'
import { useFocusedMeiFriendId } from '../app/layout/LayoutProvider'
import { useMeiFriend } from '../app/workspace/useMeiFriend'
import { useWorkspace } from '../app/workspace/WorkspaceProvider'
import { useStatus } from './StatusProvider'

/**
 * Manages the global status bar text based on the selection in the currently focused score.
 */
export function ActiveStatusManager() {
  const focusedId = useFocusedMeiFriendId()
  const workspace = useWorkspace()
  const { setStatusText } = useStatus()

  // Granular subscription
  const selection = useMeiFriend(focusedId, (s) => s.selection.selection)

  useEffect(() => {
    if (!focusedId) {
      setStatusText('Ready.')
      return
    }

    const instance = workspace.getMeiFriendInstance(focusedId)
    if (!instance) {
      setStatusText('Ready.')
      return
    }

    const updateStatus = async () => {
      const doc = instance.getSnapshot().meiDocument?.getDocument()
      let statusText = 'Ready.'

      if (selection) {
        let xmlId: string | undefined
        let measureN: number | undefined
        let staffN: number | undefined
        let layerN: number | undefined

        if (selection.kind === 'note') {
          xmlId = selection.xmlId
          measureN = selection.address.measureN
          staffN = selection.address.staffN
          layerN = selection.address.layerN
        } else if (selection.kind === 'staff') {
          xmlId = selection.staffXmlId
          measureN = selection.measureN
          staffN = selection.staffN
        }

        let extraInfo = ''
        if (doc && xmlId) {
          const el = getElementById(doc, xmlId)
          if (el) {
            if (selection.kind === 'note') {
              const timeInfo = getDurationAndOffset(doc, xmlId)
              if (timeInfo) {
                const d = timeInfo.duration.value
                const o = timeInfo.offset.value
                extraInfo = ` [Duration: ${d.n}/${d.d}, Offset: ${o.n}/${o.d}]`
              }
            } else {
              const measureEl = el.closest('measure')
              if (measureEl) {
                const meter = getActiveMeter(measureEl)
                if (meter) {
                  const u = meter.unit.value
                  extraInfo = ` [Meter: ${meter.count}/${u.d === 1 ? u.n : `${u.n}/${u.d}`}]`
                }
              }
            }
          }
        }

        if (selection.kind === 'note') {
          statusText = `Selected Note: ${xmlId ?? 'no-id'} (Meas: ${measureN}, Staff: ${staffN}, Layer: ${layerN})${extraInfo}`
        } else if (selection.kind === 'staff') {
          statusText = `Selected Staff: ${xmlId ?? 'no-id'} (Meas: ${measureN}, Staff: ${staffN})${extraInfo}`
        }
      }

      setStatusText(statusText)
    }

    updateStatus()
  }, [focusedId, selection, workspace, setStatusText])

  return null
}
