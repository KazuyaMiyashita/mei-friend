import { definePlugin, meiFriendCorePlugin } from '@mei-friend/core'

// ── Types ──────────────────────────────────────────────────────────────────

export type AnnotationType =
  | 'annotateHighlight'
  | 'annotateCircle'
  | 'annotateDescribe'
  | 'annotateLink'

export type AnnotationTargetType = 'elements' | 'range' | 'interval'

export interface Annotation {
  id: string
  type: AnnotationType
  /** xml:ids of elements targeted by this annotation */
  selection: string[]
  targetType: AnnotationTargetType
  /** Text description for annotateDescribe */
  description?: string
  /** URL for annotateLink */
  url?: string
  /** Whether it's saved inline as an <annot> element in MEI */
  isInline: boolean
}

/**
 * Markup items corresponding to MEI transcription elements (supplied, corr, etc.)
 */
export interface MarkupItem {
  id: string
  /** MEI element name (e.g. 'supplied', 'corr', 'choice') */
  type: string
  /**
   * xml:ids of corresponding elements.
   * First is its own id, followed by @corresp IDs.
   */
  selection: string[]
  /** Child element names for choice/subst */
  content?: string[]
  /** Text content of the element referenced by @resp */
  resp?: string
}

export interface AnnotationState {
  /** Inline annotations loaded from <annot> elements */
  inlineAnnotations: Annotation[]
  /** Standoff annotations created in the panel or loaded from JSON */
  standoffAnnotations: Annotation[]
  /** Transcription markup items (read-only) */
  markupItems: MarkupItem[]
  /** ID of currently selected annotation or markup item */
  selectedAnnotationId: string | null
  /** Path to the standoff JSON file in the workspace */
  standoffFilePath: string | null
}

export interface AnnotationApi {
  createHighlight: (selection: string[], targetType?: AnnotationTargetType) => void
  createCircle: (selection: string[], targetType?: AnnotationTargetType) => void
  createDescribe: (
    selection: string[],
    description: string,
    targetType?: AnnotationTargetType,
  ) => void
  createLink: (selection: string[], url: string, targetType?: AnnotationTargetType) => void
  updateAnnotation: (id: string, patch: Partial<Pick<Annotation, 'description' | 'url'>>) => void
  deleteAnnotation: (id: string) => void
  selectAnnotation: (id: string | null) => void
  writeAnnotationToMei: (id: string) => void
  removeAnnotationFromMei: (id: string) => void
  loadFromJson: (jsonText: string) => void
  exportToJson: () => string
  setStandoffFilePath: (path: string | null) => void
}

// ── Constants ──────────────────────────────────────────────────────────────────

const MEI_NS = 'http://www.music-encoding.org/ns/mei'
const XML_NS = 'http://www.w3.org/XML/1998/namespace'

const TRANSCRIPTION_LIKE = ['add', 'corr', 'del', 'orig', 'reg', 'sic', 'supplied', 'unclear']
const ALTERNATIVE_ENCODING = ['choice', 'subst']
const ALL_MARKUP_ELEMENTS = [...TRANSCRIPTION_LIKE, ...ALTERNATIVE_ENCODING]

// ── Utilities ────────────────────────────────────────────────────────────

function generateAnnotId(): string {
  return `annot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

// ── XML Reading ──────────────────────────────────────────────────────────────

function readAnnotsFromDoc(doc: Document): Annotation[] {
  const annotations: Annotation[] = []

  for (const annotEl of Array.from(doc.querySelectorAll('annot'))) {
    const id = annotEl.getAttributeNS(XML_NS, 'id') ?? annotEl.getAttribute('xml:id')
    if (!id) continue

    let type: AnnotationType = 'annotateHighlight'
    let description: string | undefined
    let url: string | undefined

    const textContent = annotEl.textContent?.trim() ?? ''
    if (textContent) {
      const ptrEl = annotEl.querySelector('ptr')
      if (ptrEl) {
        type = 'annotateLink'
        url = ptrEl.getAttribute('target') ?? undefined
      } else {
        type = 'annotateDescribe'
        description = textContent
      }
    }

    let selection: string[] = []
    if (annotEl.hasAttribute('plist')) {
      selection = (annotEl.getAttribute('plist') ?? '')
        .split(/\s+/)
        .map((s) => (s.startsWith('#') ? s.slice(1) : s))
        .filter(Boolean)
    } else if (annotEl.hasAttribute('startid')) {
      const startId = (annotEl.getAttribute('startid') ?? '').replace(/^#/, '')
      const endId = (annotEl.getAttribute('endid') ?? '').replace(/^#/, '')
      selection = [startId, endId].filter(Boolean)
    } else if (annotEl.parentElement?.hasAttribute('xml:id')) {
      const parentId = annotEl.parentElement.getAttribute('xml:id')
      if (parentId) {
        selection = [parentId]
      }
    }

    let targetType: AnnotationTargetType = 'elements'
    if (annotEl.hasAttribute('startid') && annotEl.hasAttribute('endid')) {
      targetType = 'range'
    } else if (annotEl.hasAttribute('tstamp') && annotEl.hasAttribute('tstamp2')) {
      targetType = 'interval'
    }

    annotations.push({ id, type, selection, targetType, description, url, isInline: true })
  }

  return annotations
}

function readMarkupFromDoc(doc: Document): MarkupItem[] {
  const items: MarkupItem[] = []
  const idsToIgnore = new Set<string>()
  for (const parentEl of Array.from(doc.querySelectorAll(ALTERNATIVE_ENCODING.join(',')))) {
    for (const child of Array.from(parentEl.children)) {
      const childId = child.getAttribute('xml:id')
      if (childId) idsToIgnore.add(childId)
    }
  }

  for (const el of Array.from(doc.querySelectorAll(ALL_MARKUP_ELEMENTS.join(',')))) {
    const id = el.getAttributeNS(XML_NS, 'id') ?? el.getAttribute('xml:id')
    if (!id || idsToIgnore.has(id)) continue

    const elName = el.localName
    const correspAttr = el.getAttribute('corresp') ?? ''
    const correspIds = correspAttr
      .split(/\s+/)
      .map((s) => (s.startsWith('#') ? s.slice(1) : s))
      .filter(Boolean)
    const selection = [id, ...correspIds]

    let content: string[] | undefined
    if (ALTERNATIVE_ENCODING.includes(elName)) {
      const childNames = Array.from(el.children).map((c) => c.localName)
      if (childNames.length > 0) content = childNames
    }

    let resp: string | undefined
    const respAttr = el.getAttribute('resp')
    if (respAttr) {
      const respId = respAttr.startsWith('#') ? respAttr.slice(1) : respAttr
      const respEl = doc.querySelector(`[*|id="${respId}"]`)
      const respText = respEl?.textContent?.trim()
      if (respText) resp = respText
    }

    items.push({ id, type: elName, selection, content, resp })
  }

  return items
}

// ── XML Writing ──────────────────────────────────────────────────────────────

function writeAnnotToDoc(doc: Document, annotation: Annotation): boolean {
  if (!annotation.selection.length) return false
  const anchorEl = doc.querySelector(`[*|id="${annotation.selection[0]}"]`)
  if (!anchorEl) return false

  const insertParent =
    anchorEl.closest('measure') ?? anchorEl.closest('section') ?? anchorEl.closest('score')
  if (!insertParent) return false

  const annotEl = doc.createElementNS(MEI_NS, 'annot')
  annotEl.setAttributeNS(XML_NS, 'xml:id', annotation.id)

  if (annotation.targetType === 'range' && annotation.selection.length >= 2) {
    annotEl.setAttribute('startid', `#${annotation.selection[0]}`)
    annotEl.setAttribute('endid', `#${annotation.selection[annotation.selection.length - 1]}`)
  } else if (annotation.targetType === 'elements') {
    annotEl.setAttribute('plist', annotation.selection.map((s) => `#${s}`).join(' '))
  }

  if (annotation.type === 'annotateDescribe' && annotation.description) {
    annotEl.textContent = annotation.description
  } else if (annotation.type === 'annotateLink' && annotation.url) {
    const ptrEl = doc.createElementNS(MEI_NS, 'ptr')
    ptrEl.setAttribute('target', annotation.url)
    annotEl.appendChild(ptrEl)
  }

  insertParent.insertBefore(annotEl, insertParent.firstChild)
  return true
}

function updateAnnotInDoc(
  doc: Document,
  id: string,
  patch: Partial<Pick<Annotation, 'description' | 'url'>>,
): void {
  const el =
    doc.querySelector(`annot[*|id="${id}"]`) ?? doc.querySelector(`annot[xml\\:id="${id}"]`)
  if (!el) return

  if ('description' in patch) {
    const ptr = el.querySelector('ptr')
    if (ptr) ptr.parentElement?.removeChild(ptr)
    el.textContent = patch.description ?? ''
  }
  if ('url' in patch) {
    let ptr = el.querySelector('ptr')
    if (!ptr) {
      ptr = doc.createElementNS(MEI_NS, 'ptr')
      el.textContent = ''
      el.appendChild(ptr)
    }
    ptr.setAttribute('target', patch.url ?? '')
  }
}

// ── Plugin Definition ────────────────────────────────────────────────────────────

/**
 * Manages both inline <annot> and standoff annotations, plus transcription markup elements.
 */
export const annotationPlugin = () =>
  definePlugin({
    name: 'annotation' as const,
    deps: [meiFriendCorePlugin] as const,

    initialState: {
      inlineAnnotations: [],
      standoffAnnotations: [],
      markupItems: [],
      selectedAnnotationId: null,
      standoffFilePath: null,
    } as AnnotationState,

    onInit: (ctx) => {
      const doc = ctx.depApi.core.getDocument()?.getDocument()
      if (doc) {
        ctx.setState({
          inlineAnnotations: readAnnotsFromDoc(doc),
          markupItems: readMarkupFromDoc(doc),
        })
      }
    },

    onUpdate: (ctx, xmlChanged) => {
      if (!xmlChanged) return
      const doc = ctx.depApi.core.getDocument()?.getDocument()
      if (!doc) return

      const newInline = readAnnotsFromDoc(doc)
      const newMarkup = readMarkupFromDoc(doc)
      const inlineIds = new Set(newInline.map((a) => a.id))

      const filteredStandoff = ctx
        .getState()
        .standoffAnnotations.filter((a) => !inlineIds.has(a.id))

      const allIds = new Set([
        ...inlineIds,
        ...filteredStandoff.map((a) => a.id),
        ...newMarkup.map((m) => m.id),
      ])
      const selectedId = ctx.getState().selectedAnnotationId

      ctx.setState({
        inlineAnnotations: newInline,
        standoffAnnotations: filteredStandoff,
        markupItems: newMarkup,
        selectedAnnotationId: selectedId != null && allIds.has(selectedId) ? selectedId : null,
      })
    },

    api: (ctx): AnnotationApi => {
      const addStandoff = (annotation: Annotation) => {
        ctx.setState({
          standoffAnnotations: [...ctx.getState().standoffAnnotations, annotation],
          selectedAnnotationId: annotation.id,
        })
      }

      return {
        createHighlight: (selection, targetType = 'elements') => {
          addStandoff({
            id: generateAnnotId(),
            type: 'annotateHighlight',
            selection,
            targetType,
            isInline: false,
          })
        },

        createCircle: (selection, targetType = 'elements') => {
          addStandoff({
            id: generateAnnotId(),
            type: 'annotateCircle',
            selection,
            targetType,
            isInline: false,
          })
        },

        createDescribe: (selection, description, targetType = 'elements') => {
          addStandoff({
            id: generateAnnotId(),
            type: 'annotateDescribe',
            selection,
            targetType,
            description,
            isInline: false,
          })
        },

        createLink: (selection, url, targetType = 'elements') => {
          addStandoff({
            id: generateAnnotId(),
            type: 'annotateLink',
            selection,
            targetType,
            url,
            isInline: false,
          })
        },

        updateAnnotation: (id, patch) => {
          const { inlineAnnotations, standoffAnnotations } = ctx.getState()
          const updateList = (list: Annotation[]) =>
            list.map((a) => (a.id === id ? { ...a, ...patch } : a))

          const isInline = inlineAnnotations.some((a) => a.id === id)

          ctx.setState({
            inlineAnnotations: updateList(inlineAnnotations),
            standoffAnnotations: updateList(standoffAnnotations),
          })

          if (isInline) {
            ctx.depApi.core.edit((doc: Document) => {
              updateAnnotInDoc(doc, id, patch)
            })
          }
        },

        deleteAnnotation: (id) => {
          const { inlineAnnotations, standoffAnnotations, selectedAnnotationId } = ctx.getState()
          const isInline = inlineAnnotations.some((a) => a.id === id)

          if (isInline) {
            ctx.depApi.core.edit((doc: Document) => {
              const el =
                doc.querySelector(`annot[*|id="${id}"]`) ??
                doc.querySelector(`annot[xml\\:id="${id}"]`)
              el?.parentElement?.removeChild(el)
            })
          } else {
            ctx.setState({
              standoffAnnotations: standoffAnnotations.filter((a) => a.id !== id),
              selectedAnnotationId: selectedAnnotationId === id ? null : selectedAnnotationId,
            })
          }
        },

        selectAnnotation: (id) => ctx.setState({ selectedAnnotationId: id }),

        writeAnnotationToMei: (id) => {
          const annotation = ctx.getState().standoffAnnotations.find((a) => a.id === id)
          if (!annotation) return

          ctx.setState({
            standoffAnnotations: ctx.getState().standoffAnnotations.filter((a) => a.id !== id),
          })

          ctx.depApi.core.edit((doc: Document) => {
            writeAnnotToDoc(doc, annotation)
          })
        },

        removeAnnotationFromMei: (id) => {
          const annotation = ctx.getState().inlineAnnotations.find((a) => a.id === id)
          if (!annotation) return

          ctx.setState({
            standoffAnnotations: [
              ...ctx.getState().standoffAnnotations,
              { ...annotation, isInline: false },
            ],
          })

          ctx.depApi.core.edit((doc: Document) => {
            const el =
              doc.querySelector(`annot[*|id="${id}"]`) ??
              doc.querySelector(`annot[xml\\:id="${id}"]`)
            el?.parentElement?.removeChild(el)
          })
        },

        loadFromJson: (jsonText) => {
          try {
            const data = JSON.parse(jsonText) as Record<string, unknown>
            const rawItems = (data.annotations ?? data.items ?? []) as unknown[]
            const items: Annotation[] = rawItems.map((item) => {
              const a = item as Record<string, unknown>
              return {
                id: (a.id as string | undefined) ?? generateAnnotId(),
                type: (a.type as AnnotationType | undefined) ?? 'annotateHighlight',
                selection: Array.isArray(a.selection) ? (a.selection as string[]) : [],
                targetType: (a.targetType as AnnotationTargetType | undefined) ?? 'elements',
                description: a.description as string | undefined,
                url: a.url as string | undefined,
                isInline: false,
              }
            })

            const inlineIds = new Set(ctx.getState().inlineAnnotations.map((a) => a.id))
            const filtered = items.filter((a) => !inlineIds.has(a.id))

            ctx.setState({ standoffAnnotations: filtered })
          } catch (e) {
            console.error('AnnotationPlugin: JSON parse failed', e)
          }
        },

        exportToJson: () => {
          const { inlineAnnotations, standoffAnnotations } = ctx.getState()
          const all = [...inlineAnnotations, ...standoffAnnotations]
          return JSON.stringify(
            {
              '@context': 'http://www.w3.org/ns/anno.jsonld',
              type: 'AnnotationCollection',
              annotations: all.map((a) => ({
                id: a.id,
                type: a.type,
                selection: a.selection,
                targetType: a.targetType,
                ...(a.description != null ? { description: a.description } : {}),
                ...(a.url != null ? { url: a.url } : {}),
                isInline: a.isInline,
              })),
            },
            null,
            2,
          )
        },

        setStandoffFilePath: (path) => ctx.setState({ standoffFilePath: path }),
      }
    },
  })
