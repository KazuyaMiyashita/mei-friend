import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  resolve: {
    alias: {
      "@mei-friend/core": path.resolve(__dirname, "../core/src/index.ts"),
      "@mei-friend/lib-codemirror": path.resolve(
        __dirname,
        "../lib-codemirror/src/index.ts",
      ),
      "@mei-friend/lib-verovio-react": path.resolve(
        __dirname,
        "../lib-verovio-react/src/index.ts",
      ),
    },
  },
});
