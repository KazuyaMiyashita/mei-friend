import { type AnySelection, definePlugin } from '@mei-friend/core'

export interface SelectionState {
  /** Current selection (NoteSelection or StaffSelection) */
  selection: AnySelection | null
  /** Flag for note input mode */
  inputModeActive: boolean
}

export interface SelectionApi {
  setSelection: (s: AnySelection | null) => void
  clearSelection: () => void
  toggleInputMode: () => void
}

/**
 * Manages the current selection state and input mode.
 */
export const selectionPlugin = () =>
  definePlugin({
    name: 'selection' as const,
    deps: [] as const,
    initialState: {
      selection: null,
      inputModeActive: false,
    } as SelectionState,
    api: (ctx): SelectionApi => ({
      setSelection: (s) => {
        ctx.setState({ selection: s })
      },
      clearSelection: () => {
        ctx.setState({ selection: null })
      },
      toggleInputMode: () => {
        ctx.setState({ inputModeActive: !ctx.getState().inputModeActive })
      },
    }),
  })
