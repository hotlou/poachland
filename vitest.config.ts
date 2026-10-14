import { defineConfig } from "vitest/config";
import path from "node:path";

const resolve = { alias: { "@": path.resolve(__dirname) } };

export default defineConfig({
  resolve,
  test: {
    coverage: { provider: "v8", reporter: ["text", "json", "html"], include: ["lib/**/*.ts"] },
    projects: [
      { resolve, test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" } },
      { resolve, test: { name: "integration", include: ["tests/integration/**/*.test.ts"], environment: "node", testTimeout: 30_000 } },
    ],
  },
});
