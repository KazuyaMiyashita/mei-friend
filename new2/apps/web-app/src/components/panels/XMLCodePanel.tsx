import { defaultKeymap } from '@codemirror/commands'
import { xml } from '@codemirror/lang-xml'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { search, searchKeymap } from '@codemirror/search'
import { Annotation, EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { findOffsetOfId } from '@mei-friend2/core'
import { useEffect, useRef } from 'react'
import { useMeiFriend } from '../../features/app/workspace/useMeiFriend'
import { useWorkspace } from '../../features/app/workspace/WorkspaceProvider'

const externalChange = Annotation.define<true>()

interface Props {
  meiFriendId: string | null
}

export default function XMLCodePanel({ meiFriendId }: Props) {
  const xmlContent = useMeiFriend(meiFriendId, (s) => s.xmlContent)
  const selection = useMeiFriend(meiFriendId, (s) => s.selection.selection)

  const workspace = useWorkspace()
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)

  // Initialize and update editor content
  useEffect(() => {
    if (!containerRef.current) return

    const view = new EditorView({
      state: EditorState.create({
        doc: xmlContent ?? '',
        extensions: [
          lineNumbers(),
          xml(),
          syntaxHighlighting(defaultHighlightStyle),
          search({ top: true }),
          keymap.of([
            ...defaultKeymap,
            ...searchKeymap,
            {
              key: isMac ? 'Mod-z' : 'Ctrl-z',
              run: () => {
                if (meiFriendId) {
                  const inst = workspace.getMeiFriendInstance(meiFriendId)
                  // biome-ignore lint/suspicious/noExplicitAny: API type is complex
                  if (inst) inst.runApi((api: any) => api.history.undo())
                }
                return true
              },
            },
            {
              key: isMac ? 'Mod-Shift-z' : 'Ctrl-Shift-z',
              run: () => {
                if (meiFriendId) {
                  const inst = workspace.getMeiFriendInstance(meiFriendId)
                  // biome-ignore lint/suspicious/noExplicitAny: API type is complex
                  if (inst) inst.runApi((api: any) => api.history.redo())
                }
                return true
              },
            },
          ]),
          EditorView.theme({
            '&': { height: '100%' },
            '.cm-scroller': { overflow: 'auto' },
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && meiFriendId) {
              const isExternal = update.transactions.some((tr) => tr.annotation(externalChange))
              if (!isExternal) {
                workspace.getMeiFriendInstance(meiFriendId)?.updateXml(update.state.doc.toString())
              }
            }
          }),
        ],
      }),
      parent: containerRef.current,
    })

    viewRef.current = view
    return () => view.destroy()
  }, [meiFriendId, isMac, workspace, xmlContent])

  // Sync external XML changes into CodeMirror
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

  // Sync selection to cursor position
  useEffect(() => {
    const view = viewRef.current
    if (!view || !selection) return
    const xmlId = selection.kind === 'note' ? selection.xmlId : selection.staffXmlId
    if (!xmlId) return
    const xmlStr = view.state.doc.toString()
    const offset = findOffsetOfId(xmlStr, xmlId)
    if (offset >= 0) {
      view.dispatch({
        selection: { anchor: offset },
        scrollIntoView: true,
      })
    }
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
