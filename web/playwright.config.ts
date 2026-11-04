import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: "../test/scratch/interaction-results.json" }],
  ],
  outputDir: "../test/scratch/playwright",
  use: {
    baseURL: "http://127.0.0.1:4185/preview/",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  webServer: {
    command: "node scripts/serve.mjs",
    url: "http://127.0.0.1:4185/preview/",
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
  },
});
