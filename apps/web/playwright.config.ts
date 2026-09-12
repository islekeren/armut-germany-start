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
  },
  webServer: [
    {
      command: "npm --prefix ../.. run dev:api",
      url: `${apiUrl}/api/categories`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL:
          process.env.DATABASE_URL ||
          "postgresql://postgres:postgres@127.0.0.1:5432/armut_test",
        JWT_SECRET: process.env.JWT_SECRET || "test-jwt-secret",
        JWT_REFRESH_SECRET:
          process.env.JWT_REFRESH_SECRET || "test-refresh-secret",
        PORT: process.env.PORT || "4000",
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
