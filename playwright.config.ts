import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // The browser suite shares one embedded PGlite database. Serial CI execution
  // avoids competing migrations and writes while preserving per-test isolation.
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  // Authenticated marketplace journeys intentionally exercise multiple users,
  // page compilations, and the complete deal lifecycle.
  timeout: 90_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://127.0.0.1:3000", trace: "on-first-retry" },
  // CI exercises the exact artifact built by `pnpm check`. Local development
  // retains the faster dev server. Both use an isolated embedded database.
  webServer: {
    command: process.env.CI ? "pnpm start" : "pnpm dev --webpack",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PGLITE_PATH: ".pglite-e2e",
      ...(process.env.CI
        ? { POACHLAND_E2E_MODE: "1" }
        : { WATCHPACK_POLLING: "true" }),
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
