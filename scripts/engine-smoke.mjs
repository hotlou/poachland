#!/usr/bin/env node
/**
 * Engine smoke test — run with: node scripts/engine-smoke.mjs
 *
 * Thin launcher: the real test (engine-smoke.impl.mjs) imports the TypeScript
 * modules under lib/server/, so it must run through tsx, and with the
 * `react-server` module condition so the `server-only` import guard in
 * lib/server/db.ts is satisfied outside of Next.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(here, "..");
const impl = path.join(here, "engine-smoke.impl.mjs");

const result = spawnSync(
  "pnpm",
  ["exec", "tsx", "--conditions", "react-server", impl],
  { stdio: "inherit", cwd: projectRoot },
);

if (result.error) {
  console.error("Failed to launch tsx:", result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
