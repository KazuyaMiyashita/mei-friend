/** Static definition of keyboard shortcuts (labels and default values only). Used in SettingsDialog etc. */
export interface ShortcutDef {
  id: string
  label: string
  defaultShortcut?: string
  category: string
}

export const SHORTCUTS: Record<string, ShortcutDef> = {
  'app.showSettings': {
    id: 'app.showSettings',
    label: 'Preferences: Open Settings',
    defaultShortcut: 'Mod+,',
    category: 'Application',
  },
  'workspace.saveAll': {
    id: 'workspace.saveAll',
    label: 'File: Save All',
    category: 'File',
  },
  'document.save': {
    id: 'document.save',
    label: 'File: Save',
    defaultShortcut: 'Mod+S',
    category: 'File',
  },
  'document.undo': {
    id: 'document.undo',
    label: 'Edit: Undo',
    defaultShortcut: 'Mod+Z',
    category: 'Edit',
  },
  'document.redo': {
    id: 'document.redo',
    label: 'Edit: Redo',
    defaultShortcut: 'Mod+Shift+Z',
    category: 'Edit',
  },
  'document.zoomIn': {
    id: 'document.zoomIn',
    label: 'View: Zoom In',
    defaultShortcut: 'Mod+=',
    category: 'View',
  },
  'document.zoomOut': {
    id: 'document.zoomOut',
    label: 'View: Zoom Out',
    defaultShortcut: 'Mod+-',
    category: 'View',
  },
  'document.deleteElement': {
    id: 'document.deleteElement',
    label: 'Manipulate: Delete Element',
    defaultShortcut: 'Backspace',
    category: 'Manipulate',
  },
  'document.pitchChromaticUp': {
    id: 'document.pitchChromaticUp',
    label: 'Manipulate: Pitch Chromatic Up',
    defaultShortcut: 'Shift+ArrowUp',
    category: 'Manipulate',
  },
  'document.pitchChromaticDown': {
    id: 'document.pitchChromaticDown',
    label: 'Manipulate: Pitch Chromatic Down',
    defaultShortcut: 'Shift+ArrowDown',
    category: 'Manipulate',
  },
  'panel.close': {
    id: 'panel.close',
    label: 'View: Close Panel',
    defaultShortcut: 'Mod+W',
    category: 'View',
  },
}
