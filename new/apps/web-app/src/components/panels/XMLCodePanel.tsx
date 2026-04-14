import { defaultKeymap } from '@codemirror/commands'
import { xml } from '@codemirror/lang-xml'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { search, searchKeymap } from '@codemirror/search'
import { Annotation, EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { findOffsetOfId } from '@mei-friend/core'
import { useEffect, useRef } from 'react'
import { useMeiFriend } from '../../features/app/workspace/useMeiFriend'
import { useWorkspace } from '../../features/app/workspace/WorkspaceProvider'

/** CM6 annotation indicating a programmatic change from outside the editor */
const externalChange = Annotation.define<true>()

interface Props {
  meiFriendId: string | null
}

export default function XMLCodePanel({ meiFriendId }: Props) {
  const mf = useMeiFriend(meiFriendId)
  const workspace = useWorkspace()
  const workspaceRef = useRef(workspace)
  workspaceRef.current = workspace
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const xmlContentRef = useRef<string | null>(mf?.core?.xmlContent ?? null)
  xmlContentRef.current = mf?.core?.xmlContent ?? null

  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)

  // Remount editor when meiFriendId changes
  useEffect(() => {
    if (!containerRef.current) return

    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const view = new EditorView({
      state: EditorState.create({
        doc: xmlContentRef.current ?? '',
        extensions: [
          lineNumbers(),
          // history() is removed to avoid conflict with global history
          xml(),
          syntaxHighlighting(defaultHighlightStyle),
          search({ top: true }),
          keymap.of([
            ...defaultKeymap,
            ...searchKeymap,
            // Delegate Undo/Redo to global API
            {
              key: isMac ? 'Mod-z' : 'Ctrl-z',
              run: () => {
                if (meiFriendId) {
                  workspaceRef.current
                    .getMeiFriendInstance(meiFriendId)
                    ?.runApi((api) => api.history.undo())
                  return true
                }
                return false
              },
            },
            {
              key: isMac ? 'Mod-Shift-z' : 'Ctrl-Shift-z',
              run: () => {
                if (meiFriendId) {
                  workspaceRef.current
                    .getMeiFriendInstance(meiFriendId)
                    ?.runApi((api) => api.history.redo())
                  return true
                }
                return false
              },
            },
            ...(isMac
              ? []
              : [
                  {
                    key: 'Ctrl-y',
                    run: () => {
                      if (meiFriendId) {
                        workspaceRef.current
                          .getMeiFriendInstance(meiFriendId)
                          ?.runApi((api) => api.history.redo())
                        return true
                      }
                      return false
                    },
                  },
                ]),
          ]),
          EditorView.theme({
            '&': { height: '100%' },
            '.cm-scroller': { overflow: 'auto' },
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && meiFriendId) {
              // Exclude programmatic changes from outside (e.g. pitch editing) to prevent loops
              const isExternal = update.transactions.some((tr) => tr.annotation(externalChange))
              if (!isExternal) {
                if (debounceTimer) clearTimeout(debounceTimer)
                debounceTimer = setTimeout(() => {
                  workspaceRef.current
                    .getMeiFriendInstance(meiFriendId)
                    ?.updateXml(update.state.doc.toString())
                }, 500)
              }
            }
          }),
        ],
      }),
      parent: containerRef.current,
    })

    viewRef.current = view
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      view.destroy()
      viewRef.current = null
    }
  }, [meiFriendId, isMac])

  // Reflect changes in xmlContent to the editor (e.g., pitch changes, updates from outside the editor)
  const xmlContent = mf?.core?.xmlContent ?? null
  useEffect(() => {
    const view = viewRef.current
    if (!view || xmlContent == null) return
    const current = view.state.doc.toString()
    if (current !== xmlContent) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: xmlContent },
        annotations: externalChange.of(true),
      })
    }
  }, [xmlContent])

  // Scroll to the corresponding line when selection changes
  const selection = mf?.selection?.selection
  useEffect(() => {
    const view = viewRef.current
    if (!view || !selection) return
    const xmlId = selection.kind === 'note' ? selection.xmlId : selection.staffXmlId
    if (!xmlId) return
    const xml = view.state.doc.toString()
    const offset = findOffsetOfId(xml, xmlId)
    if (offset < 0) return
    // Scroll editor to that position
    view.dispatch({
      selection: { anchor: offset },
      scrollIntoView: true,
    })
  }, [selection])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        fontSize: '13px',
      }}
    />
  )
}
