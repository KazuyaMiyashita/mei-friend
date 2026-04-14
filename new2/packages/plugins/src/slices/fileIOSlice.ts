import type { CoreSlice, SliceCreator } from '@mei-friend2/core'
import type { VerovioSlice } from './verovioSlice'

export interface FileIOActions {
  saveMei: () => void
  saveSvg: () => void
}

export type FileIOSlice = { fileIO: FileIOActions }

export const createFileIOSlice: SliceCreator<FileIOSlice> = (_set, get) => {
  const downloadText = (content: string, fileName: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  return {
    fileIO: {
      saveMei: () => {
        const state = get() as CoreSlice
        const xml = state.xmlContent
        const fileName = state.fileName || 'score.mei'
        if (xml) {
          downloadText(xml, fileName, 'application/xml')
          state.markAsSaved()
        }
      },
      saveSvg: () => {
        const state = get() as CoreSlice & VerovioSlice
        const svg = state.verovio.currentSvg
        const fileName = state.fileName || 'score'
        if (svg) {
          const svgName = `${fileName.replace(/\.(mei|xml|musicxml)$/i, '')}.svg`
          downloadText(svg, svgName, 'image/svg+xml')
        }
      },
    },
  }
}
