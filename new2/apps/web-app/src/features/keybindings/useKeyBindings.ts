import { findNoteSelectionById, navigateAddressByOffset } from '@mei-friend2/core'
import type { SelectionSlice, VerovioSlice } from '@mei-friend2/plugins'
import { useEffect, useRef } from 'react'
import { useLayoutDispatch, useLayoutState } from '../app/layout/LayoutProvider'
import { findGroupForPanel } from '../app/layout/layoutUtils'
import type { AppMeiFriend } from '../app/workspace/plugins'
import { useMeiFriendWorkspace } from '../app/workspace/useMeiFriendWorkspace'

const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)

function isCmd(e: KeyboardEvent): boolean {
  return isMac ? e.metaKey : e.ctrlKey
}

interface KeyBindingsProps {
  onNewFile?: () => void
  onToggleSettings?: () => void
}

export function useKeyBindings({ onNewFile, onToggleSettings }: KeyBindingsProps = {}) {
  const layoutState = useLayoutState()
  const dispatch = useLayoutDispatch()
  const { workspace, saveMei } = useMeiFriendWorkspace()

  const layoutStateRef = useRef(layoutState)
  layoutStateRef.current = layoutState

  const workspaceRef = useRef(workspace)
  workspaceRef.current = workspace

  const saveMeiRef = useRef(saveMei)
  saveMeiRef.current = saveMei

  const onNewFileRef = useRef(onNewFile)
  onNewFileRef.current = onNewFile

  const onToggleSettingsRef = useRef(onToggleSettings)
  onToggleSettingsRef.current = onToggleSettings

  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      const target = e.target as Element
      const tag = target.tagName.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || (target as HTMLElement).isContentEditable) return

      if (e.ctrlKey && e.key === 'n' && !e.metaKey && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        onNewFileRef.current?.()
        return
      }

      if (isCmd(e) && e.key === ',' && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        onToggleSettingsRef.current?.()
        return
      }

      const state = layoutStateRef.current
      const ws = workspaceRef.current

      // Undo / Redo
      if (isCmd(e) && e.key === 'z' && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        const meiFriendId = state.focusedPanelId
          ? state.panels[state.focusedPanelId]?.meiFriendId
          : null
        const instance = meiFriendId
          ? (ws.getMeiFriendInstance(meiFriendId) as AppMeiFriend | undefined)
          : undefined
        if (instance) await instance.runApi((api) => api.history.undo())
        return
      }
      if (isCmd(e) && (e.key === 'y' || (e.key === 'z' && e.shiftKey)) && !e.altKey) {
        e.preventDefault()
        const meiFriendId = state.focusedPanelId
          ? state.panels[state.focusedPanelId]?.meiFriendId
          : null
        const instance = meiFriendId
          ? (ws.getMeiFriendInstance(meiFriendId) as AppMeiFriend | undefined)
          : undefined
        if (instance) await instance.runApi((api) => api.history.redo())
        return
      }

      // Save
      if (isCmd(e) && e.key === 's' && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        const meiFriendId = state.focusedPanelId
          ? state.panels[state.focusedPanelId]?.meiFriendId
          : null
        if (meiFriendId) await saveMeiRef.current(meiFriendId)
        return
      }

      // Close panel
      if (isCmd(e) && e.key === 'w' && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        const focusedId = state.focusedPanelId
        if (focusedId && state.layout) {
          const group = findGroupForPanel(state.layout, focusedId)
          if (group) dispatch({ type: 'closeTab', panelId: focusedId, groupId: group.id })
        }
        return
      }

      const focusedId = state.focusedPanelId
      const meiFriendId = focusedId ? state.panels[focusedId]?.meiFriendId : null
      const instance = meiFriendId
        ? (ws.getMeiFriendInstance(meiFriendId) as AppMeiFriend | undefined)
        : undefined
      if (!instance) return

      const snap = instance.getSnapshot()
      const selState = (snap as unknown as SelectionSlice).selection
      const isInputActive = selState?.inputModeActive ?? false
      const currentSel = selState?.selection
      const noteSel = currentSel?.kind === 'note' ? currentSel : null

      if (isInputActive && noteSel) {
        const key = e.key.toLowerCase()

        if (!isCmd(e) && !e.altKey && !e.shiftKey && /^[a-g]$/.test(key)) {
          e.preventDefault()
          const newId = await instance.runApi((api) =>
            api.meiEditor.insertNoteAtScoreAddress(noteSel.xmlId, {
              pname: key,
              dur: '4',
              dots: 0,
            }),
          )
          if (newId) {
            const doc = instance.getSnapshot().meiDocument?.getDocument()
            if (doc) {
              const sel = findNoteSelectionById(doc, newId)
              if (sel) await instance.runApi((api) => api.selection.setSelection(sel))
            }
          }
          return
        }

        if (!isCmd(e) && !e.altKey && !e.shiftKey && key === '0') {
          e.preventDefault()
          const newId = await instance.runApi((api) =>
            api.meiEditor.insertRestAtScoreAddress(noteSel.xmlId, { dur: '4', dots: 0 }),
          )
          if (newId) {
            const doc = instance.getSnapshot().meiDocument?.getDocument()
            if (doc) {
              const sel = findNoteSelectionById(doc, newId)
              if (sel) await instance.runApi((api) => api.selection.setSelection(sel))
            }
          }
          return
        }

        if (!isCmd(e) && !e.altKey && !e.shiftKey && e.key.startsWith('Arrow')) {
          e.preventDefault()
          const vrvState = (snap as unknown as VerovioSlice).verovio
          const scoreModel = vrvState?.scoreModel
          if (!scoreModel) return
          const direction = e.key.replace('Arrow', '').toLowerCase() as
            | 'left'
            | 'right'
            | 'up'
            | 'down'
          const next = navigateAddressByOffset(scoreModel, noteSel, direction)
          if (next) await instance.runApi((api) => api.selection.setSelection(next))
          return
        }
      }

      if (e.shiftKey && !e.altKey && !isCmd(e) && e.key === 'ArrowUp') {
        e.preventDefault()
        await instance.runApi((api) => api.meiEditor.pitchChromatic(1))
        return
      }
      if (e.shiftKey && !e.altKey && !isCmd(e) && e.key === 'ArrowDown') {
        e.preventDefault()
        await instance.runApi((api) => api.meiEditor.pitchChromatic(-1))
        return
      }
      if (e.shiftKey && e.altKey && !isCmd(e) && e.key === 'ArrowUp') {
        e.preventDefault()
        await instance.runApi((api) => api.meiEditor.pitchDiatonic(1))
        return
      }
      if (e.shiftKey && e.altKey && !isCmd(e) && e.key === 'ArrowDown') {
        e.preventDefault()
        await instance.runApi((api) => api.meiEditor.pitchDiatonic(-1))
        return
      }
      if (e.shiftKey && !e.altKey && isCmd(e) && e.key === 'ArrowUp') {
        e.preventDefault()
        await instance.runApi((api) => api.meiEditor.pitchOctave(1))
        return
      }
      if (e.shiftKey && !e.altKey && isCmd(e) && e.key === 'ArrowDown') {
        e.preventDefault()
        await instance.runApi((api) => api.meiEditor.pitchOctave(-1))
        return
      }

      if ((e.key === 'Backspace' || e.key === 'Delete') && !isCmd(e) && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        await instance.runApi((api) => api.meiEditor.deleteSelectedElements())
        return
      }

      if (!isCmd(e) && !e.altKey && e.key === 's' && !e.shiftKey) {
        e.preventDefault()
        await instance.runApi((api) => api.meiEditor.insertSpanElement('slur'))
        return
      }
      if (!isCmd(e) && !e.altKey && e.key === 't' && !e.shiftKey) {
        e.preventDefault()
        await instance.runApi((api) => api.meiEditor.insertSpanElement('tie'))
        return
      }
      if (!isCmd(e) && !e.altKey && e.key === 'h' && !e.shiftKey) {
        e.preventDefault()
        await instance.runApi((api) =>
          api.meiEditor.insertSpanElement('hairpin', undefined, 'cres'),
        )
        return
      }
      if (!isCmd(e) && !e.altKey && e.key === 'h' && e.shiftKey) {
        e.preventDefault()
        await instance.runApi((api) => api.meiEditor.insertSpanElement('hairpin', undefined, 'dim'))
        return
      }
      if (!isCmd(e) && !e.altKey && e.key === 'd' && !e.shiftKey) {
        e.preventDefault()
        await instance.runApi((api) => api.meiEditor.insertPointElement('dynam', 'below', ''))
        return
      }
      if (!isCmd(e) && !e.altKey && e.key === 't' && e.shiftKey) {
        e.preventDefault()
        await instance.runApi((api) => api.meiEditor.insertPointElement('tempo', 'above', ''))
        return
      }
      if (!isCmd(e) && !e.altKey && e.key === 'f' && !e.shiftKey) {
        e.preventDefault()
        await instance.runApi((api) => api.meiEditor.insertPointElement('fermata', 'above'))
        return
      }

      if (!isCmd(e) && !e.altKey && !e.shiftKey && e.key === '+') {
        e.preventDefault()
        await instance.runApi((api) => api.meiEditor.setAccidental('s'))
        return
      }
      if (!isCmd(e) && !e.altKey && !e.shiftKey && e.key === '=') {
        e.preventDefault()
        await instance.runApi((api) => api.meiEditor.setAccidental('n'))
        return
      }
      if (!isCmd(e) && !e.altKey && !e.shiftKey && (e.key === '-' || e.key === '−')) {
        e.preventDefault()
        await instance.runApi((api) => api.meiEditor.setAccidental('f'))
        return
      }

      if (isCmd(e) && e.key === 'm' && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        await instance.runApi((api) => api.meiEditor.addXmlIds())
        return
      }
      if (isCmd(e) && e.key === 'm' && e.shiftKey && !e.altKey) {
        e.preventDefault()
        await instance.runApi((api) => api.meiEditor.removeXmlIds())
        return
      }
      if (isCmd(e) && e.key === 'r' && e.shiftKey && !e.altKey) {
        e.preventDefault()
        await instance.runApi((api) => api.meiEditor.renumberMeasures())
        return
      }

      if (e.key === 'ArrowRight' && !e.shiftKey && !e.altKey && !isCmd(e)) {
        const vrvState = (snap as unknown as VerovioSlice).verovio
        if (vrvState && vrvState.currentPage < vrvState.totalPages) {
          e.preventDefault()
          await instance.runApi((api) => api.verovio.changePage(vrvState.currentPage + 1))
        }
        return
      }
      if (e.key === 'ArrowLeft' && !e.shiftKey && !e.altKey && !isCmd(e)) {
        const vrvState = (snap as unknown as VerovioSlice).verovio
        if (vrvState && vrvState.currentPage > 1) {
          e.preventDefault()
          await instance.runApi((api) => api.verovio.changePage(vrvState.currentPage - 1))
        }
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [dispatch])
}
