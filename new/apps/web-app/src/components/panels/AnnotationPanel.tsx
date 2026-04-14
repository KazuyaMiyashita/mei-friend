/**
 * AnnotationPanel
 *
 * A panel for viewing and editing MEI <annot> inline annotations and
 * standoff annotations managed by the workspace.
 *
 * - Inline: Saved as <annot> elements within the MEI XML.
 * - Standoff: Created in the panel or loaded from a JSON file.
 *   Can be converted to inline with the "Write to MEI" button, or reversed with "Remove from MEI".
 */

import { isNoteSelection, isStaffSelection } from '@mei-friend/core'
import type { Annotation, AnnotationType, MarkupItem } from '@mei-friend/plugins'
import { useEffect, useRef, useState } from 'react'
import { useMeiFriend } from '../../features/app/workspace/useMeiFriend'
import { useWorkspace } from '../../features/app/workspace/WorkspaceProvider'
import './AnnotationPanel.css'

interface Props {
  meiFriendId: string | null
}

// ── Labels ────────────────────────────────────────────────────────────────────

function typeLabel(type: AnnotationType): string {
  switch (type) {
    case 'annotateHighlight':
      return 'Highlight'
    case 'annotateCircle':
      return 'Circle'
    case 'annotateDescribe':
      return 'Describe'
    case 'annotateLink':
      return 'Link'
    default:
      return type
  }
}

/** Display label for markup elements */
function markupTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    supplied: 'Supplied',
    corr: 'Corr',
    sic: 'Sic',
    unclear: 'Unclear',
    add: 'Add',
    del: 'Del',
    orig: 'Orig',
    reg: 'Reg',
    choice: 'Choice',
    subst: 'Subst',
  }
  return labels[type] ?? type
}

// ── Main Component ──────────────────────────────────────────────────────

export default function AnnotationPanel({ meiFriendId }: Props) {
  const mf = useMeiFriend(meiFriendId)
  const workspace = useWorkspace()

  // ── Edit State for Description/URL ────────────────────────────────────────────────────
  const [descInput, setDescInput] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [editing, setEditing] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Plugin state and API
  const annoState = mf?.annotation ?? null
  const instance = meiFriendId ? workspace.getMeiFriendInstance(meiFriendId) : null

  // All annotations (inline + standoff)
  const allAnnotations: Annotation[] = annoState
    ? [...annoState.inlineAnnotations, ...annoState.standoffAnnotations]
    : []

  // List of editorial markup
  const markupItems: MarkupItem[] = annoState?.markupItems ?? []

  const selectedAnnotation =
    annoState?.selectedAnnotationId != null
      ? (allAnnotations.find((a) => a.id === annoState.selectedAnnotationId) ?? null)
      : null

  const selectedMarkup: MarkupItem | null =
    annoState?.selectedAnnotationId != null && selectedAnnotation == null
      ? (markupItems.find((m) => m.id === annoState.selectedAnnotationId) ?? null)
      : null

  // Get xml:id from current music selection
  const currentSelection = mf?.selection?.selection ?? null
  const selectedIds: string[] = currentSelection
    ? isNoteSelection(currentSelection)
      ? [currentSelection.xmlId]
      : isStaffSelection(currentSelection)
        ? [currentSelection.measureXmlId]
        : []
    : []
  const hasSelection = selectedIds.length > 0

  // Reset edit form when selected annotation changes
  useEffect(() => {
    if (selectedAnnotation) {
      setDescInput(selectedAnnotation.description ?? '')
      setUrlInput(selectedAnnotation.url ?? '')
    } else {
      setDescInput('')
      setUrlInput('')
    }
    setEditing(false)
  }, [selectedAnnotation])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSaveEdit = async () => {
    if (!selectedAnnotation || !instance) return
    const patch: Partial<Pick<Annotation, 'description' | 'url'>> = {}
    if (selectedAnnotation.type === 'annotateDescribe') patch.description = descInput || undefined
    if (selectedAnnotation.type === 'annotateLink') patch.url = urlInput || undefined
    await instance.runApi((api) => api.annotation.updateAnnotation(selectedAnnotation.id, patch))
    setEditing(false)
  }

  const handleLoadJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !instance) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const text = ev.target?.result
      if (typeof text === 'string') {
        await instance.runApi((api) => {
          api.annotation.loadFromJson(text)
          api.annotation.setStandoffFilePath(file.name)
        })
      }
    }
    reader.readAsText(file)
    // Reset (so the same file can be re-selected)
    e.target.value = ''
  }

  const handleExportJson = async () => {
    if (!instance) return
    const json = await instance.runApi((api) => api.annotation.exportToJson())
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = annoState?.standoffFilePath ?? 'annotations.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleAddAnnotation = async (type: AnnotationType) => {
    if (!instance || !hasSelection) return
    if (type === 'annotateDescribe') {
      const desc = window.prompt('Enter description:')
      if (desc) await instance.runApi((api) => api.annotation.createDescribe(selectedIds, desc))
    } else if (type === 'annotateLink') {
      let url = window.prompt('Enter URL:')
      if (url) {
        if (!url.startsWith('http')) url = `https://${url}`
        await instance.runApi((api) => api.annotation.createLink(selectedIds, url as string))
      }
    } else if (type === 'annotateHighlight') {
      await instance.runApi((api) => api.annotation.createHighlight(selectedIds))
    } else if (type === 'annotateCircle') {
      await instance.runApi((api) => api.annotation.createCircle(selectedIds))
    }
  }

  // ── Early Return ──────────────────────────────────────────────────────────

  if (!mf?.core.xmlContent) {
    return (
      <div className="annotationPlaceholder">
        <strong>No file open</strong>
        <p>Open a MEI file to view its annotations</p>
      </div>
    )
  }

  // ── Rendering ──────────────────────────────────────────────────────────

  return (
    <div className="annotationPanel">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="annotationControls">
        <span className="ctrlLabelText">Add:</span>
        {(
          [
            'annotateHighlight',
            'annotateCircle',
            'annotateDescribe',
            'annotateLink',
          ] as AnnotationType[]
        ).map((type) => (
          <button
            key={type}
            type="button"
            className="ctrlBtn"
            onClick={() => handleAddAnnotation(type)}
            disabled={!hasSelection}
            title={
              hasSelection
                ? `Add ${typeLabel(type)} annotation`
                : 'Select elements in the notation first'
            }
          >
            {typeLabel(type)}
          </button>
        ))}

        <div className="annotationControlsSpacer" />

        <button
          type="button"
          className="ctrlBtn"
          onClick={() => fileInputRef.current?.click()}
          title="Load standoff annotations from JSON file"
        >
          Load JSON
        </button>
        <button
          type="button"
          className="ctrlBtn"
          onClick={handleExportJson}
          disabled={allAnnotations.length === 0}
          title="Export all annotations to JSON"
        >
          Export JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleLoadJson}
        />
      </div>

      {/* Standoff file path display */}
      {annoState?.standoffFilePath && (
        <div className="annotationFilePath">
          <span className="annotationFilePathLabel">JSON:</span>
          <span className="annotationFilePathValue">{annoState.standoffFilePath}</span>
        </div>
      )}

      {/* ── Body (List + Details) ─────────────────────────────────────────── */}
      <div className="annotationBody">
        {allAnnotations.length === 0 && markupItems.length === 0 ? (
          <div className="annotationEmpty">
            <p>No annotations or markup</p>
            <p>
              Select elements in the notation panel,
              <br />
              then use the buttons above to add annotations.
            </p>
          </div>
        ) : (
          <div className="annotationList">
            {/* ── Annotations Section ─────────────────────────────── */}
            {allAnnotations.length > 0 && (
              <>
                <div className="annotationSectionHeader">Annotations ({allAnnotations.length})</div>
                {allAnnotations.map((annotation) => {
                  const isSelected = annoState?.selectedAnnotationId === annotation.id
                  return (
                    <button
                      type="button"
                      key={annotation.id}
                      className={`annotationItem${isSelected ? ' annotationItem--selected' : ''}`}
                      onClick={() =>
                        instance?.runApi((api) =>
                          api.annotation.selectAnnotation(isSelected ? null : annotation.id),
                        )
                      }
                    >
                      <span
                        className="annotationTypeTag"
                        data-type={annotation.type}
                        title={typeLabel(annotation.type)}
                      >
                        {typeLabel(annotation.type).slice(0, 4)}
                      </span>

                      <span className="annotationSelection">
                        {annotation.selection.slice(0, 2).join(', ')}
                        {annotation.selection.length > 2 && (
                          <span className="annotationMore">
                            {' '}
                            +{annotation.selection.length - 2}
                          </span>
                        )}
                      </span>

                      {annotation.isInline && (
                        <span
                          className="annotationBadge annotationBadge--inline"
                          title="Saved in MEI XML"
                        >
                          MEI
                        </span>
                      )}

                      {(annotation.description || annotation.url) && (
                        <span className="annotationPreview">
                          {(annotation.description ?? annotation.url ?? '').slice(0, 24)}
                          {(annotation.description ?? annotation.url ?? '').length > 24 ? '…' : ''}
                        </span>
                      )}

                      <button
                        type="button"
                        className="annotationDeleteBtn"
                        onClick={(e) => {
                          e.stopPropagation()
                          instance?.runApi((api) => api.annotation.deleteAnnotation(annotation.id))
                        }}
                        title="Delete annotation"
                      >
                        ×
                      </button>
                    </button>
                  )
                })}
              </>
            )}

            {/* ── Markup Section ────────────────────────────────── */}
            {markupItems.length > 0 && (
              <>
                <div className="annotationSectionHeader">
                  Editorial Markup ({markupItems.length})
                </div>
                {markupItems.map((markup) => {
                  const isSelected = annoState?.selectedAnnotationId === markup.id
                  return (
                    <button
                      type="button"
                      key={markup.id}
                      className={`annotationItem${isSelected ? ' annotationItem--selected' : ''}`}
                      onClick={() =>
                        instance?.runApi((api) =>
                          api.annotation.selectAnnotation(isSelected ? null : markup.id),
                        )
                      }
                    >
                      <span
                        className="annotationTypeTag annotationTypeTag--markup"
                        data-markup-type={markup.type}
                        title={`<${markup.type}>`}
                      >
                        {markupTypeLabel(markup.type).slice(0, 5)}
                      </span>

                      <span className="annotationSelection">
                        {markup.selection[0]}
                        {markup.selection.length > 1 && (
                          <span className="annotationMore"> +{markup.selection.length - 1}</span>
                        )}
                      </span>

                      {markup.content && (
                        <span className="annotationPreview">{markup.content.join(' / ')}</span>
                      )}

                      {markup.resp && (
                        <span className="annotationBadge" title={`resp: ${markup.resp}`}>
                          {markup.resp.slice(0, 8)}
                        </span>
                      )}
                    </button>
                  )
                })}
              </>
            )}
          </div>
        )}

        {/* ── Annotation Detail Panel ────────────────────────────────────── */}
        {selectedAnnotation && (
          <div className="annotationDetail">
            <div className="annotationDetailHeader">
              <span className="annotationTypeTag" data-type={selectedAnnotation.type}>
                {typeLabel(selectedAnnotation.type)}
              </span>
              <span className="annotationDetailStorage">
                {selectedAnnotation.isInline ? 'Inline (MEI)' : 'Standoff'}
              </span>
              <button
                type="button"
                className="annotationDetailClose"
                onClick={() => instance?.runApi((api) => api.annotation.selectAnnotation(null))}
                title="Close detail"
              >
                ×
              </button>
            </div>

            <div className="annotationDetailRow">
              <span className="annotationDetailLabel">Target:</span>
              <span className="annotationDetailValue annotationDetailIds">
                {selectedAnnotation.selection.join(', ') || '—'}
              </span>
            </div>

            {/* description field */}
            {(selectedAnnotation.type === 'annotateDescribe' ||
              selectedAnnotation.description != null) && (
              <div className="annotationDetailRow">
                <span className="annotationDetailLabel">Description:</span>
                {editing ? (
                  <input
                    className="annotationInput"
                    value={descInput}
                    onChange={(e) => setDescInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit()
                      if (e.key === 'Escape') setEditing(false)
                    }}
                  />
                ) : (
                  <span className="annotationDetailValue">
                    {selectedAnnotation.description ?? '—'}
                  </span>
                )}
              </div>
            )}

            {/* url field */}
            {(selectedAnnotation.type === 'annotateLink' || selectedAnnotation.url != null) && (
              <div className="annotationDetailRow">
                <span className="annotationDetailLabel">URL:</span>
                {editing ? (
                  <input
                    className="annotationInput"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit()
                      if (e.key === 'Escape') setEditing(false)
                    }}
                  />
                ) : selectedAnnotation.url ? (
                  <a
                    className="annotationDetailValue annotationDetailUrl"
                    href={selectedAnnotation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {selectedAnnotation.url}
                  </a>
                ) : (
                  <span className="annotationDetailValue">—</span>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="annotationDetailActions">
              {editing ? (
                <>
                  <button type="button" className="ctrlBtn" onClick={handleSaveEdit}>
                    Save
                  </button>
                  <button type="button" className="ctrlBtn" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {(selectedAnnotation.type === 'annotateDescribe' ||
                    selectedAnnotation.type === 'annotateLink') && (
                    <button type="button" className="ctrlBtn" onClick={() => setEditing(true)}>
                      Edit
                    </button>
                  )}

                  {!selectedAnnotation.isInline && (
                    <button
                      type="button"
                      className="ctrlBtn ctrlBtn--primary"
                      onClick={() =>
                        instance?.runApi((api) =>
                          api.annotation.writeAnnotationToMei(selectedAnnotation.id),
                        )
                      }
                      title="Insert as <annot> element in MEI XML"
                    >
                      Write to MEI
                    </button>
                  )}

                  {selectedAnnotation.isInline && (
                    <button
                      type="button"
                      className="ctrlBtn"
                      onClick={() =>
                        instance?.runApi((api) =>
                          api.annotation.removeAnnotationFromMei(selectedAnnotation.id),
                        )
                      }
                      title="Remove <annot> from MEI XML (keep as standoff)"
                    >
                      Remove from MEI
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Markup Detail Panel ──────────────────────────────────────── */}
        {selectedMarkup && (
          <div className="annotationDetail">
            <div className="annotationDetailHeader">
              <span
                className="annotationTypeTag annotationTypeTag--markup"
                data-markup-type={selectedMarkup.type}
              >
                &lt;{selectedMarkup.type}&gt;
              </span>
              <span className="annotationDetailStorage">Editorial Markup</span>
              <button
                type="button"
                className="annotationDetailClose"
                onClick={() => instance?.runApi((api) => api.annotation.selectAnnotation(null))}
                title="Close detail"
              >
                ×
              </button>
            </div>

            <div className="annotationDetailRow">
              <span className="annotationDetailLabel">Element:</span>
              <span className="annotationDetailValue annotationDetailIds">{selectedMarkup.id}</span>
            </div>

            {selectedMarkup.selection.length > 1 && (
              <div className="annotationDetailRow">
                <span className="annotationDetailLabel">Corresp:</span>
                <span className="annotationDetailValue annotationDetailIds">
                  {selectedMarkup.selection.slice(1).join(', ')}
                </span>
              </div>
            )}

            {selectedMarkup.content && (
              <div className="annotationDetailRow">
                <span className="annotationDetailLabel">Children:</span>
                <span className="annotationDetailValue">
                  {selectedMarkup.content.map((c) => `<${c}>`).join(', ')}
                </span>
              </div>
            )}

            {selectedMarkup.resp && (
              <div className="annotationDetailRow">
                <span className="annotationDetailLabel">Resp:</span>
                <span className="annotationDetailValue">{selectedMarkup.resp}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
