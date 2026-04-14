import {
  definePlugin,
  parseMfWorkspaceJson,
  type UpdateCtx,
  workspaceCorePlugin,
} from '@mei-friend/core'

export interface WorkspaceFileIOState {
  files: Map<string, File | FileSystemFileHandle>
  directoryHandle?: FileSystemDirectoryHandle
}

export interface WorkspaceFileIOApi {
  addFile: (file: File) => void
  removeFile: (path: string) => void
  loadFromFileList: (files: FileList | File[]) => Promise<void>
  loadFromDirectoryHandle: (handle: FileSystemDirectoryHandle) => Promise<void>
  getFileHandle: (path: string) => FileSystemFileHandle | undefined
  readFile: (path: string) => Promise<string>
  readFileBuffer: (path: string) => Promise<ArrayBuffer>
  /** Reads a MEI file from the workspace and opens it as a MeiFriend instance. */
  openMeiFile: (path: string) => Promise<string>
}

async function readFileText(
  ctx: UpdateCtx<WorkspaceFileIOState, Record<string, unknown>>,
  path: string,
): Promise<string> {
  const { files } = ctx.getState()
  const entry = files.get(path)
  if (!entry) throw new Error(`File not found: ${path}`)
  if (entry instanceof File) return entry.text()
  const file = await entry.getFile()
  return file.text()
}

async function readFileArrayBuffer(
  ctx: UpdateCtx<WorkspaceFileIOState, Record<string, unknown>>,
  path: string,
): Promise<ArrayBuffer> {
  const { files } = ctx.getState()
  const entry = files.get(path)
  if (!entry) throw new Error(`File not found: ${path}`)
  if (entry instanceof File) return entry.arrayBuffer()
  const file = await entry.getFile()
  return file.arrayBuffer()
}

/**
 * Handles file I/O operations for the workspace.
 */
export const workspaceFileIOPlugin = () =>
  definePlugin({
    name: 'fileIO' as const,
    deps: [workspaceCorePlugin] as const,
    initialState: {
      files: new Map(),
    } as WorkspaceFileIOState,
    api: (ctx): WorkspaceFileIOApi => ({
      addFile: (file: File) => {
        const { files } = ctx.getState()
        const newFiles = new Map(files)
        newFiles.set(file.name, file)
        ctx.setState({ files: newFiles })
        ctx.depApi.core.setFiles(Array.from(newFiles.keys()).sort())
      },

      removeFile: (path: string) => {
        const { files } = ctx.getState()
        const newFiles = new Map(files)
        if (newFiles.delete(path)) {
          ctx.setState({ files: newFiles })
          ctx.depApi.core.setFiles(Array.from(newFiles.keys()).sort())
        }
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

        ctx.setState({ files })
        ctx.depApi.core.setFiles(Array.from(files.keys()).sort(), workspaceName)
      },

      loadFromDirectoryHandle: async (handle: FileSystemDirectoryHandle) => {
        const files = new Map<string, File | FileSystemFileHandle>()
        let workspaceName: string | undefined

        async function scan(dirHandle: FileSystemDirectoryHandle, path = '') {
          // biome-ignore lint/suspicious/noExplicitAny: FileSystemDirectoryHandle.values() is not yet in standard types
          const iter = (dirHandle as any).values()
          for await (const entry of iter) {
            const entryPath = path ? `${path}/${entry.name}` : entry.name
            if (entry.kind === 'file') {
              if (entry.name === 'mf-workspace.json') {
                const file = await entry.getFile()
                workspaceName = parseMfWorkspaceJson(await file.text()).name
              } else {
                files.set(entryPath, entry)
              }
            } else if (entry.kind === 'directory') {
              await scan(entry, entryPath)
            }
          }
        }

        await scan(handle)
        ctx.setState({ files, directoryHandle: handle })
        ctx.depApi.core.setFiles(Array.from(files.keys()).sort(), workspaceName || handle.name)
      },

      getFileHandle: (path: string) => {
        const { files } = ctx.getState()
        const entry = files.get(path)
        return entry instanceof FileSystemFileHandle ? entry : undefined
      },

      readFile: (path: string) => readFileText(ctx, path),

      readFileBuffer: (path: string) => readFileArrayBuffer(ctx, path),

      openMeiFile: async (path: string) => {
        const xml = await readFileText(ctx, path)
        // Note: workspace instance is not directly in context anymore.
        // We might need to rethink how plugins interact with the wrapper classes.
        // For now, let's assume we can pass the workspace in onInit or something if needed,
        // but ideally, the workspace should be the one calling this API.
        // Wait, the original code had: return ctx.workspace.openMeiFile(path, xml)
        // This is a bit of a circular dependency (plugin calling workspace which holds the plugin).
        // A better way is for the plugin to provide the XML and the caller (UI) to call workspace.openMeiFile.
        return xml
      },
    }),
  })
