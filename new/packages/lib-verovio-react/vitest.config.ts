import path from "node:path";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "lib-verovio-react",
    include: ["test/**/*.test.ts"],
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
      headless: true,
    },
    alias: {
      "@mei-friend/core": path.resolve(__dirname, "../core/src/index.ts"),
    },
  },
});
