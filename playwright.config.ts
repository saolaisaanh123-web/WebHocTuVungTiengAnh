import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
export default defineConfig({
  testDir: "./e2e",
  // Browser workflows include importing the real 8.9 MB corpus and restoring
  // backups; leave room for those transactions on shared CI runners.
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:5173",
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox"],
    },
    headless: true,
  },
  webServer: {
    command: "npm run dev -- --port 5173",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
});
