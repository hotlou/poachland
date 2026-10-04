import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

it("enforces rooted vouch eligibility, revocation, real-account authorization and one-time DM evidence", () => {
  const result = spawnSync(process.execPath, ["scripts/trust-smoke.mjs"], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_ENV: "test" } });
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  expect(result.stdout).toContain("TRUST SMOKE: all");
}, 60_000);
