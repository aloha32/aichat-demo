import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    cwd: "/root/project1-aichat/aichat-demo",
    env: {
      AI_PROVIDER: "mock",
      DEMO_API_KEY: "demo-chat-key",
      MOCK_STREAM_DELAY_MS: "1",
    },
    timeout: 120_000,
    reuseExistingServer: false,
    url: "http://127.0.0.1:3100",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
