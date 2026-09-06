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
  // Browser journeys use an isolated development database so magic links stay
  // local and CI never needs production credentials. `pnpm check` separately
  // builds and validates the production artifact before this step runs.
  webServer: {
    command: "pnpm dev --webpack",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { PGLITE_PATH: ".pglite-e2e", WATCHPACK_POLLING: "true" },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
