import { definePlugin, meiFriendCorePlugin } from '@mei-friend/core'
import { verovioPlugin } from './VerovioPlugin'

export interface FileIOApi {
  saveMei: () => void
  saveSvg: () => void
}

/**
 * Handles browser-based file downloads for MEI and SVG.
 */
export const fileIOPlugin = () =>
  definePlugin({
    name: 'fileIO' as const,
    deps: [meiFriendCorePlugin, verovioPlugin()] as const,
    api: (ctx): FileIOApi => {
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
        saveMei: () => {
          const xml = ctx.depApi.core.getXml()
          const fileName = ctx.depApi.core.getFileName() || 'score.mei'
          if (xml) {
            downloadText(xml, fileName, 'application/xml')
            ctx.depApi.core.markAsSaved()
          }
        },
        saveSvg: () => {
          const svg = ctx.depState.verovio.currentSvg
          const fileName = ctx.depApi.core.getFileName() || 'score'
          if (svg) {
            const svgName = `${fileName.replace(/\.(mei|xml|musicxml)$/i, '')}.svg`
            downloadText(svg, svgName, 'image/svg+xml')
          }
        },
      }
    },
  })
