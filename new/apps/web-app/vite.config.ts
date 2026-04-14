import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  server: {
    fs: {
      allow: ['../..'],
    },
  },
  worker: {
    format: 'es',
  },
})
