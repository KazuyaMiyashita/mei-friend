import type { AnySelection, SliceCreator } from '@mei-friend2/core'

export interface SelectionState {
  /** Current selection (NoteSelection or StaffSelection) */
  selection: AnySelection | null
  /** Flag for note input mode */
  inputModeActive: boolean
}

export interface SelectionActions {
  setSelection: (s: AnySelection | null) => void
  clearSelection: () => void
  toggleInputMode: () => void
}

export type SelectionSlice = { selection: SelectionState & SelectionActions }

export const createSelectionSlice: SliceCreator<SelectionSlice> = (set, _get) => ({
  selection: {
    selection: null,
    inputModeActive: false,

    setSelection: (s: AnySelection | null) => {
      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      set((state: any) => ({
        selection: { ...state.selection, selection: s },
      }))
    },
    clearSelection: () => {
      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      set((state: any) => ({
        selection: { ...state.selection, selection: null },
      }))
    },
    toggleInputMode: () => {
      // biome-ignore lint/suspicious/noExplicitAny: slice pattern
      set((state: any) => ({
        selection: { ...state.selection, inputModeActive: !state.selection.inputModeActive },
      }))
    },
  },
})
