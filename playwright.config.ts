import { defineConfig } from "@playwright/test";

const reviewBaseURL = process.env.REVIEW_BASE_URL?.trim();
const localBaseURL = "http://127.0.0.1:5183";

export default defineConfig({
  testDir: "./tests/current-e2e",
  timeout: 90000,
  expect: { timeout: 12000 },
  fullyParallel: false,
  workers: 1,
  outputDir: "output/playwright/current-e2e-artifacts",
  reporter: [
    ["list"],
    ["json", { outputFile: "output/playwright/current-e2e-results.json" }],
  ],
  use: {
    baseURL: reviewBaseURL || localBaseURL,
    viewport: { width: 1366, height: 900 },
    channel: process.env.REVIEW_BROWSER || "chrome",
    actionTimeout: 15000,
    navigationTimeout: 30000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // REVIEW_BASE_URL deliberately owns its server lifecycle. The default
  // source-engine check serves only loopback; no built dist is required.
  webServer: reviewBaseURL ? undefined : {
    command: "npm run dev -- --port 5183 --strictPort",
    url: localBaseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
