import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    coverage: { provider: "v8", reporter: ["text", "json", "html"], include: ["lib/**/*.ts"] },
    projects: [
      { test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" } },
      { test: { name: "integration", include: ["tests/integration/**/*.test.ts"], environment: "node", testTimeout: 30_000 } },
    ],
  },
});
