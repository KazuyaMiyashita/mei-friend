import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "core",
    environment: "node",
    include: ["test/**/*.test.ts"],
    alias: {
      "@mei-friend/core": path.resolve(__dirname, "./src/index.ts"),
    },
  },
});
