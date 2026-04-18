import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // Allow serving files from one level up to access src/ and node_modules
      allow: ["..", "../../src", "../../node_modules", "../../../node_modules"],
    },
  },
  resolve: {
    alias: {
      // Create an alias to make it easier and more robust
      "@src": resolve(__dirname, "../../src"),
    },
  },
});
