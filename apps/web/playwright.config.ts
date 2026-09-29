import { defineConfig, devices } from "@playwright/test";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const webUrl = "http://localhost:3000";
const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:5433/armut_e2e_web";

// Production builds by default (what CI runs); E2E_DEV_SERVERS=true switches
// to watch-mode servers for local debugging.
const useDevServers = process.env.E2E_DEV_SERVERS === "true";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 2 : 0,
  forbidOnly: !!process.env.CI,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["github"], ["list"]]
    : "list",
  use: {
    baseURL: webUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Use a preinstalled Chromium instead of Playwright's bundled download.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: useDevServers
        ? "npm --prefix ../.. run dev:api"
        : "npm --prefix ../api run start:prod",
      url: `${apiUrl}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "ignore",
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        JWT_SECRET: process.env.JWT_SECRET || "test-jwt-secret",
        JWT_REFRESH_SECRET:
          process.env.JWT_REFRESH_SECRET || "test-refresh-secret",
        PORT: process.env.PORT || "4000",
        CORS_ORIGINS:
          process.env.CORS_ORIGINS ||
          "http://localhost:3000,http://127.0.0.1:3000",
        // Lets many test users log in from one IP without hitting the
        // per-route auth rate limits. Only honoured when NODE_ENV=test.
        NODE_ENV: "test",
        THROTTLE_DISABLED: "true",
      },
    },
    {
      command: useDevServers ? "npm run dev" : "npm run start -- --port 3000",
      url: webUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "ignore",
      env: {
        ...process.env,
        API_TIMEOUT_MS: process.env.API_TIMEOUT_MS || "10000",
        NEXT_PUBLIC_API_URL: apiUrl,
        NEXT_PUBLIC_API_TIMEOUT_MS:
          process.env.NEXT_PUBLIC_API_TIMEOUT_MS || "10000",
      },
    },
  ],
});
