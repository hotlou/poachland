import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

it("publishes only consented real activity and never retries an ambiguous publish", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "--conditions", "react-server", "scripts/social-publishing-smoke.mjs"], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_ENV: "test" } });
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  expect(result.stdout).toContain("SOCIAL PUBLISHING SMOKE: all");
}, 60_000);
