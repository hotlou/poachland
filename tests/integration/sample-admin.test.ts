import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

it("isolates, moderates, expires, and reverses a sample batch without changing real content", () => {
  const result = spawnSync(process.execPath, ["scripts/sample-admin-smoke.mjs"], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_ENV: "test" } });
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  expect(result.stdout).toContain("SAMPLE ADMIN SMOKE: all");
}, 60_000);
