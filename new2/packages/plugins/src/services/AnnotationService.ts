import type { CoreSlice } from '@mei-friend2/core'
import type { StoreApi } from 'zustand/vanilla'
import type {
  Annotation,
  AnnotationSlice,
  AnnotationTargetType,
  AnnotationType,
  MarkupItem,
} from '../slices/annotationSlice'

const XML_NS = 'http://www.w3.org/XML/1998/namespace'
const TRANSCRIPTION_LIKE = ['add', 'corr', 'del', 'orig', 'reg', 'sic', 'supplied', 'unclear']
const ALTERNATIVE_ENCODING = ['choice', 'subst']
const ALL_MARKUP_ELEMENTS = [...TRANSCRIPTION_LIKE, ...ALTERNATIVE_ENCODING]

export class AnnotationService {
  private unsubscribe: (() => void) | null = null

  constructor(private store: StoreApi<CoreSlice & AnnotationSlice>) {
    this.startSubscription()
    // Initial parse
    const doc = store.getState().meiDocument?.getDocument()
    if (doc) {
      this.store.getState().annotation.updateState({
        inlineAnnotations: this.readAnnotsFromDoc(doc),
        markupItems: this.readMarkupFromDoc(doc),
      })
    }
  }

  private startSubscription() {
    this.unsubscribe = this.store.subscribe((state, prevState) => {
      if (state.meiDocument !== prevState.meiDocument) {
        const doc = state.meiDocument?.getDocument()
        if (doc) {
          const newInline = this.readAnnotsFromDoc(doc)
          const newMarkup = this.readMarkupFromDoc(doc)
          const inlineIds = new Set(newInline.map((a) => a.id))

          const filteredStandoff = state.annotation.standoffAnnotations.filter(
            (a) => !inlineIds.has(a.id),
          )

          const allIds = new Set([
            ...inlineIds,
            ...filteredStandoff.map((a) => a.id),
            ...newMarkup.map((m) => m.id),
          ])
          const selectedId = state.annotation.selectedAnnotationId

          state.annotation.updateState({
            inlineAnnotations: newInline,
            standoffAnnotations: filteredStandoff,
            markupItems: newMarkup,
            selectedAnnotationId: selectedId != null && allIds.has(selectedId) ? selectedId : null,
          })
        }
      }
    })
  }

  private readAnnotsFromDoc(doc: Document): Annotation[] {
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

  private readMarkupFromDoc(doc: Document): MarkupItem[] {
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

  destroy() {
    this.unsubscribe?.()
  }
}
