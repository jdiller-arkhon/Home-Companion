import { defineConfig } from "@playwright/test";

const DATA = process.env.E2E_DATA_DIR ?? "/tmp/hearth-e2e";
export default defineConfig({
  testDir: "e2e",
  workers: 1,
  use: { baseURL: "http://localhost:3200", launchOptions: { executablePath: process.env.PW_CHROMIUM } },
  webServer: {
    command: `rm -rf ${DATA} && HEARTH_DATA_DIR=${DATA} HEARTH_SECURE_COOKIES=false PORT=3200 node .next/standalone/server.js`,
    url: "http://localhost:3200/welcome", reuseExistingServer: false, timeout: 60_000,
  },
  projects: [
    { name: "ipad", use: { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 } },
  ],
});
