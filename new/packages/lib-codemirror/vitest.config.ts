import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "lib-codemirror",
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
    alias: {
      "@mei-friend/core": path.resolve(__dirname, "../core/src/index.ts"),
    },
  },
});
