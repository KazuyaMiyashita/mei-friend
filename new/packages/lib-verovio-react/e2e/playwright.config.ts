import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "dot" : "list",
  use: {
    baseURL: "http://127.0.0.1:5180",
    trace: "on-first-retry",
    video: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command:
      "../../../node_modules/.bin/vite sandbox --port 5180 --host 127.0.0.1",
    url: "http://127.0.0.1:5180",
    reuseExistingServer: !process.env.CI,
  },
});
