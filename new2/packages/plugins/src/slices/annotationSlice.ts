import type { CoreSlice, SliceCreator } from '@mei-friend2/core'

export type AnnotationType =
  | 'annotateHighlight'
  | 'annotateCircle'
  | 'annotateDescribe'
  | 'annotateLink'

export type AnnotationTargetType = 'elements' | 'range' | 'interval'

export interface Annotation {
  id: string
  type: AnnotationType
  selection: string[]
  targetType: AnnotationTargetType
  description?: string
  url?: string
  isInline: boolean
}

export interface MarkupItem {
  id: string
  type: string
  selection: string[]
  content?: string[]
  resp?: string
}

export interface AnnotationState {
  inlineAnnotations: Annotation[]
  standoffAnnotations: Annotation[]
  markupItems: MarkupItem[]
  selectedAnnotationId: string | null
  standoffFilePath: string | null
}

export interface AnnotationActions {
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
  updateState: (patch: Partial<AnnotationState>) => void
}

export type AnnotationSlice = { annotation: AnnotationState & AnnotationActions }

function generateAnnotId(): string {
  return `annot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export const createAnnotationSlice: SliceCreator<AnnotationSlice> = (set, get) => ({
  annotation: {
    inlineAnnotations: [],
    standoffAnnotations: [],
    markupItems: [],
    selectedAnnotationId: null,
    standoffFilePath: null,

    createHighlight: (selection: string[], targetType: AnnotationTargetType = 'elements') => {
      const id = generateAnnotId()
      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      set((state: any) => ({
        annotation: {
          ...state.annotation,
          standoffAnnotations: [
            ...state.annotation.standoffAnnotations,
            { id, type: 'annotateHighlight', selection, targetType, isInline: false },
          ],
          selectedAnnotationId: id,
        },
      }))
    },

    createCircle: (selection: string[], targetType: AnnotationTargetType = 'elements') => {
      const id = generateAnnotId()
      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      set((state: any) => ({
        annotation: {
          ...state.annotation,
          standoffAnnotations: [
            ...state.annotation.standoffAnnotations,
            { id, type: 'annotateCircle', selection, targetType, isInline: false },
          ],
          selectedAnnotationId: id,
        },
      }))
    },

    createDescribe: (
      selection: string[],
      description: string,
      targetType: AnnotationTargetType = 'elements',
    ) => {
      const id = generateAnnotId()
      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      set((state: any) => ({
        annotation: {
          ...state.annotation,
          standoffAnnotations: [
            ...state.annotation.standoffAnnotations,
            { id, type: 'annotateDescribe', selection, targetType, description, isInline: false },
          ],
          selectedAnnotationId: id,
        },
      }))
    },

    createLink: (
      selection: string[],
      url: string,
      targetType: AnnotationTargetType = 'elements',
    ) => {
      const id = generateAnnotId()
      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      set((state: any) => ({
        annotation: {
          ...state.annotation,
          standoffAnnotations: [
            ...state.annotation.standoffAnnotations,
            { id, type: 'annotateLink', selection, targetType, url, isInline: false },
          ],
          selectedAnnotationId: id,
        },
      }))
    },

    updateAnnotation: (id: string, patch: Partial<Pick<Annotation, 'description' | 'url'>>) => {
      const state = get() as AnnotationSlice & CoreSlice
      const { inlineAnnotations } = state.annotation
      const isInline = inlineAnnotations.some((a) => a.id === id)

      const updateList = (list: Annotation[]) =>
        list.map((a) => (a.id === id ? { ...a, ...patch } : a))

      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      set((s: any) => ({
        annotation: {
          ...s.annotation,
          inlineAnnotations: updateList(s.annotation.inlineAnnotations),
          standoffAnnotations: updateList(s.annotation.standoffAnnotations),
        },
      }))

      if (isInline) {
        state.edit((doc: Document) => {
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
              ptr = doc.createElementNS('http://www.music-encoding.org/ns/mei', 'ptr')
              el.textContent = ''
              el.appendChild(ptr)
            }
            ptr.setAttribute('target', patch.url ?? '')
          }
        })
      }
    },

    deleteAnnotation: (id: string) => {
      const state = get() as AnnotationSlice & CoreSlice
      const { inlineAnnotations, selectedAnnotationId } = state.annotation
      const isInline = inlineAnnotations.some((a) => a.id === id)

      if (isInline) {
        state.edit((doc: Document) => {
          const el =
            doc.querySelector(`annot[*|id="${id}"]`) ?? doc.querySelector(`annot[xml\\:id="${id}"]`)
          el?.parentElement?.removeChild(el)
        })
      } else {
        // biome-ignore lint/suspicious/noExplicitAny: slice pattern
        set((s: any) => ({
          annotation: {
            ...s.annotation,
            standoffAnnotations: s.annotation.standoffAnnotations.filter(
              (a: Annotation) => a.id !== id,
            ),
            selectedAnnotationId: selectedAnnotationId === id ? null : selectedAnnotationId,
          },
        }))
      }
    },

    selectAnnotation: (id: string | null) => {
      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      set((s: any) => ({
        annotation: { ...s.annotation, selectedAnnotationId: id },
      }))
    },

    writeAnnotationToMei: (id: string) => {
      const state = get() as AnnotationSlice & CoreSlice
      const annotation = state.annotation.standoffAnnotations.find((a) => a.id === id)
      if (!annotation) return

      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      set((s: any) => ({
        annotation: {
          ...s.annotation,
          standoffAnnotations: s.annotation.standoffAnnotations.filter(
            (a: Annotation) => a.id !== id,
          ),
        },
      }))

      state.edit((doc: Document) => {
        if (!annotation.selection.length) return
        const anchorEl = doc.querySelector(`[*|id="${annotation.selection[0]}"]`)
        if (!anchorEl) return

        const insertParent =
          anchorEl.closest('measure') ?? anchorEl.closest('section') ?? anchorEl.closest('score')
        if (!insertParent) return

        const annotEl = doc.createElementNS('http://www.music-encoding.org/ns/mei', 'annot')
        annotEl.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:id', annotation.id)

        if (annotation.targetType === 'range' && annotation.selection.length >= 2) {
          annotEl.setAttribute('startid', `#${annotation.selection[0]}`)
          annotEl.setAttribute('endid', `#${annotation.selection[annotation.selection.length - 1]}`)
        } else if (annotation.targetType === 'elements') {
          annotEl.setAttribute('plist', annotation.selection.map((s) => `#${s}`).join(' '))
        }

        if (annotation.type === 'annotateDescribe' && annotation.description) {
          annotEl.textContent = annotation.description
        } else if (annotation.type === 'annotateLink' && annotation.url) {
          const ptrEl = doc.createElementNS('http://www.music-encoding.org/ns/mei', 'ptr')
          ptrEl.setAttribute('target', annotation.url)
          annotEl.appendChild(ptrEl)
        }

        insertParent.insertBefore(annotEl, insertParent.firstChild)
      })
    },

    removeAnnotationFromMei: (id: string) => {
      const state = get() as AnnotationSlice & CoreSlice
      const annotation = state.annotation.inlineAnnotations.find((a) => a.id === id)
      if (!annotation) return

      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      set((s: any) => ({
        annotation: {
          ...s.annotation,
          standoffAnnotations: [
            ...s.annotation.standoffAnnotations,
            { ...annotation, isInline: false },
          ],
        },
      }))

      state.edit((doc: Document) => {
        const el =
          doc.querySelector(`annot[*|id="${id}"]`) ?? doc.querySelector(`annot[xml\\:id="${id}"]`)
        el?.parentElement?.removeChild(el)
      })
    },

    loadFromJson: (jsonText: string) => {
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

        const state = get() as AnnotationSlice
        const inlineIds = new Set(state.annotation.inlineAnnotations.map((a) => a.id))
        const filtered = items.filter((a) => !inlineIds.has(a.id))

        // biome-ignore lint/suspicious/noExplicitAny: slice pattern
        set((s: any) => ({
          annotation: { ...s.annotation, standoffAnnotations: filtered },
        }))
      } catch (e) {
        console.error('AnnotationSlice: JSON parse failed', e)
      }
    },

    exportToJson: () => {
      const state = get() as AnnotationSlice
      const { inlineAnnotations, standoffAnnotations } = state.annotation
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

    setStandoffFilePath: (path: string | null) => {
      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      set((s: any) => ({
        annotation: { ...s.annotation, standoffFilePath: path },
      }))
    },

    updateState: (patch: Partial<AnnotationState>) => {
      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      set((s: any) => ({
        annotation: { ...s.annotation, ...patch },
      }))
    },
  },
})
