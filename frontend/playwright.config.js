import { defineConfig } from "@playwright/test";

const CI = Boolean(process.env.CI);
const backendPort = process.env.PLAYWRIGHT_BACKEND_PORT || "38123";
const frontendPort = process.env.PLAYWRIGHT_FRONTEND_PORT || "34173";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${frontendPort}`;
const useExternalServers =
  String(process.env.PLAYWRIGHT_USE_EXTERNAL_SERVERS || "")
    .trim()
    .toLowerCase() === "1" ||
  String(process.env.PLAYWRIGHT_USE_EXTERNAL_SERVERS || "")
    .trim()
    .toLowerCase() === "true";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120000,
  expect: {
    timeout: 15000,
  },
  fullyParallel: false,
  retries: CI ? 1 : 0,
  reporter: CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    headless: true,
  },
  webServer: useExternalServers
    ? undefined
    : [
        {
          command: "python ../scripts/run_playwright_backend.py",
          url: `http://127.0.0.1:${backendPort}/api/health/`,
          reuseExistingServer: false,
          timeout: 120000,
          cwd: ".",
          env: {
            PLAYWRIGHT_FRONTEND_URL: baseURL,
            PLAYWRIGHT_BACKEND_HOST: "127.0.0.1",
            PLAYWRIGHT_BACKEND_PORT: backendPort,
            PLAYWRIGHT_SMOKE_USERNAME:
              process.env.PLAYWRIGHT_SMOKE_USERNAME || "playwright_b2b_client",
            PLAYWRIGHT_SMOKE_PASSWORD:
              process.env.PLAYWRIGHT_SMOKE_PASSWORD || "PlaywrightPass123!",
            PLAYWRIGHT_SMOKE_EMAIL:
              process.env.PLAYWRIGHT_SMOKE_EMAIL || "playwright-b2b@example.invalid",
            PLAYWRIGHT_ADMIN_USERNAME: process.env.PLAYWRIGHT_ADMIN_USERNAME || "playwright_admin",
            PLAYWRIGHT_ADMIN_PASSWORD:
              process.env.PLAYWRIGHT_ADMIN_PASSWORD || "PlaywrightAdmin123!",
            PLAYWRIGHT_ADMIN_EMAIL:
              process.env.PLAYWRIGHT_ADMIN_EMAIL || "playwright-admin@example.invalid",
          },
        },
        {
          command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort}`,
          url: baseURL,
          reuseExistingServer: false,
          timeout: 120000,
          cwd: ".",
          env: {
            VITE_DEV_API_PROXY: `http://127.0.0.1:${backendPort}`,
            VITE_DEV_WS_PROXY: `ws://127.0.0.1:${backendPort}`,
            VITE_API_BASE_URL: "/api",
            VITE_WS_BASE_URL: "",
            VITE_SITE_URL: baseURL,
            VITE_TELEGRAM_BOT_USERNAME: "",
          },
        },
      ],
});
