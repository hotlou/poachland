import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("isolated PGlite foundation", () => {
  it("migrates and exercises auth, sessions, rate limits, and identities", () => {
    const result = spawnSync("node", ["scripts/foundation-smoke.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, NODE_ENV: "test" },
    });

    expect(result.stderr).toBe("");
    expect(result.status, result.stdout).toBe(0);
    expect(result.stdout).toContain("FOUNDATION SMOKE: all");
  });
});
