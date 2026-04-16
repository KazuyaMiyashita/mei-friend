import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/*/test/**/*.test.ts"],
    alias: {
      "@mei-friend/core": path.resolve(
        __dirname,
        "./packages/core/src/index.ts",
      ),
    },
  },
});
