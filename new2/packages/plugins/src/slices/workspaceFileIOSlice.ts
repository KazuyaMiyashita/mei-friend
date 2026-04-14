import { parseMfWorkspaceJson, type SliceCreator } from '@mei-friend2/core'

export interface WorkspaceFileIOState {
  files: Map<string, File | FileSystemFileHandle>
  directoryHandle?: FileSystemDirectoryHandle
}

export interface WorkspaceFileIOActions {
  addFile: (file: File) => void
  removeFile: (path: string) => void
  loadFromFileList: (files: FileList | File[]) => Promise<void>
  loadFromDirectoryHandle: (handle: FileSystemDirectoryHandle) => Promise<void>
  getFileHandle: (path: string) => FileSystemFileHandle | undefined
  readFile: (path: string) => Promise<string>
  readFileBuffer: (path: string) => Promise<ArrayBuffer>
}

export type WorkspaceFileIOSlice = { fileIO: WorkspaceFileIOState & WorkspaceFileIOActions }

export const createWorkspaceFileIOSlice: SliceCreator<WorkspaceFileIOSlice> = (set, get) => {
  const readFileText = async (path: string): Promise<string> => {
    const { files } = get().fileIO
    const entry = files.get(path)
    if (!entry) throw new Error(`File not found: ${path}`)
    if (entry instanceof File) return entry.text()
    const file = await entry.getFile()
    return file.text()
  }

  const readFileArrayBuffer = async (path: string): Promise<ArrayBuffer> => {
    const { files } = get().fileIO
    const entry = files.get(path)
    if (!entry) throw new Error(`File not found: ${path}`)
    if (entry instanceof File) return entry.arrayBuffer()
    const file = await entry.getFile()
    return file.arrayBuffer()
  }

  return {
    fileIO: {
      files: new Map(),

      addFile: (file: File) => {
        // biome-ignore lint/suspicious/noExplicitAny: slice pattern
        set((state: any) => {
          const { files } = state.fileIO
          const newFiles = new Map(files)
          newFiles.set(file.name, file)
          const paths = Array.from(newFiles.keys()).sort()
          state.setFiles(paths)
          return { fileIO: { ...state.fileIO, files: newFiles } }
        })
      },

      removeFile: (path: string) => {
        // biome-ignore lint/suspicious/noExplicitAny: slice pattern
        set((state: any) => {
          const { files } = state.fileIO
          const newFiles = new Map(files)
          if (newFiles.delete(path)) {
            const paths = Array.from(newFiles.keys()).sort()
            state.setFiles(paths)
            return { fileIO: { ...state.fileIO, files: newFiles } }
          }
          return {}
        })
      },

      loadFromFileList: async (fileList: FileList | File[]) => {
        const files = new Map<string, File>()
        let workspaceName: string | undefined

        const fileArray = fileList instanceof FileList ? Array.from(fileList) : fileList

        for (const file of fileArray) {
          const path =
            (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
          if (path.endsWith('mf-workspace.json')) {
            workspaceName = parseMfWorkspaceJson(await file.text()).name
          } else {
            files.set(path, file)
          }
        }

        // biome-ignore lint/suspicious/noExplicitAny: slice pattern
        set((state: any) => {
          const paths = Array.from(files.keys()).sort()
          state.setFiles(paths, workspaceName)
          return { fileIO: { ...state.fileIO, files } }
        })
      },

      loadFromDirectoryHandle: async (handle: FileSystemDirectoryHandle) => {
        const files = new Map<string, File | FileSystemFileHandle>()
        let workspaceName: string | undefined

        async function scan(dirHandle: FileSystemDirectoryHandle, path = '') {
          // biome-ignore lint/suspicious/noExplicitAny: values()
          const iter = (dirHandle as any).values()
          for await (const entry of iter) {
            const entryPath = path ? `${path}/${entry.name}` : entry.name
            if (entry.kind === 'file') {
              const fileHandle = entry as FileSystemFileHandle
              if (entry.name === 'mf-workspace.json') {
                const file = await fileHandle.getFile()
                workspaceName = parseMfWorkspaceJson(await file.text()).name
              } else {
                files.set(entryPath, fileHandle)
              }
            } else if (entry.kind === 'directory') {
              await scan(entry as FileSystemDirectoryHandle, entryPath)
            }
          }
        }

        await scan(handle)
        // biome-ignore lint/suspicious/noExplicitAny: slice pattern
        set((state: any) => {
          const paths = Array.from(files.keys()).sort()
          state.setFiles(paths, workspaceName || handle.name)
          return { fileIO: { ...state.fileIO, files, directoryHandle: handle } }
        })
      },

      getFileHandle: (path: string) => {
        const { files } = get().fileIO
        const entry = files.get(path)
        return entry instanceof FileSystemFileHandle ? entry : undefined
      },

      readFile: (path: string) => readFileText(path),

      readFileBuffer: (path: string) => readFileArrayBuffer(path),
    },
  }
}
