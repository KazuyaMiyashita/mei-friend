import type { AppWorkspace } from './plugins'

interface FileSystemWindow extends Window {
  showDirectoryPicker?: (options?: {
    mode?: 'read' | 'readwrite'
  }) => Promise<FileSystemDirectoryHandle>
}

interface HTMLInputElementWithWebkitDirectory extends HTMLInputElement {
  webkitdirectory: boolean
}

export async function openFolderInWorkspace(
  workspace: AppWorkspace,
  onEnablePersistence?: (enabled: boolean) => void,
  askPersistenceMode?: () => Promise<'browser' | 'local' | 'cancel'>,
  storageMode?: 'browser' | 'local' | null,
): Promise<boolean> {
  const fsWindow = window as unknown as FileSystemWindow
  if (fsWindow.showDirectoryPicker) {
    try {
      const isPersistenceEnabled = await workspace.runApi((api) => api.localPersistence.enabled)
      const mode = isPersistenceEnabled ? 'readwrite' : 'read'

      let handle: FileSystemDirectoryHandle
      try {
        handle = await fsWindow.showDirectoryPicker({ mode })
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return false
        if (mode === 'readwrite') {
          handle = await fsWindow.showDirectoryPicker({ mode: 'read' })
        } else {
          throw e
        }
      }

      await workspace.runApi((api) => api.fileIO.loadFromDirectoryHandle(handle))

      if (storageMode === null && askPersistenceMode) {
        const choice = await askPersistenceMode()
        if (choice === 'cancel') return false
        if (choice === 'local') {
          workspace.runApi((api) => api.localPersistence.setEnabled(true))
          onEnablePersistence?.(true)
          try {
            // @ts-expect-error
            await handle.requestPermission({ mode: 'readwrite' })
          } catch (e) {
            console.warn('Failed to upgrade permission to readwrite:', e)
          }
        } else if (choice === 'browser') {
          onEnablePersistence?.(false)
        }
      }

      return true
    } catch (e) {
      console.error(e)
    }
  }

  return openFolderViaInput(workspace)
}

export async function openFolderViaInput(workspace: AppWorkspace): Promise<boolean> {
  return new Promise((resolve) => {
    const input = document.createElement('input') as HTMLInputElementWithWebkitDirectory
    input.type = 'file'
    input.webkitdirectory = true

    input.onchange = async () => {
      const files = input.files
      if (files && files.length > 0) {
        await workspace.runApi((api) => api.fileIO.loadFromFileList(files))
        resolve(true)
      } else {
        resolve(false)
      }
    }

    input.oncancel = () => resolve(false)
    input.click()
  })
}
