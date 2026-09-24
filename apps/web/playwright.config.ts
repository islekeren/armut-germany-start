import { defineConfig } from "@playwright/test";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    // Use a preinstalled Chromium instead of Playwright's bundled download.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
  webServer: [
    {
      command: "npm --prefix ../.. run dev:api",
      url: `${apiUrl}/api/categories`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL ||
          "postgresql://postgres:postgres@127.0.0.1:5433/armut_e2e_web",
        JWT_SECRET: process.env.JWT_SECRET || "test-jwt-secret",
        JWT_REFRESH_SECRET:
          process.env.JWT_REFRESH_SECRET || "test-refresh-secret",
        PORT: process.env.PORT || "4000",
        // Lets many test users log in from one IP without hitting the
        // per-route auth rate limits. Only honoured when NODE_ENV=test.
        NODE_ENV: "test",
        THROTTLE_DISABLED: "true",
        CORS_ORIGINS:
          process.env.CORS_ORIGINS ||
          "http://localhost:3000,http://127.0.0.1:3000",
      },
    },
    {
      command: "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
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
