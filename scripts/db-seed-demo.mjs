#!/usr/bin/env node
/**
 * Demo/staging seeder — ports the client seed state (lib/seed.ts) into the
 * database. NOT for production.
 *
 * Usage: SEED_DEMO=yes node scripts/db-seed-demo.mjs
 *   - refuses to run unless SEED_DEMO=yes
 *   - refuses to run against a non-empty users table
 *   - targets DATABASE_URL when set, the local PGlite dir otherwise
 *
 * Thin launcher: the real work (db-seed-demo.impl.mjs) imports the TypeScript
 * modules under lib/, so it must run through tsx with the `react-server`
 * module condition (same pattern as engine-smoke.mjs).
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.SEED_DEMO !== "yes") {
  console.error("Refusing to seed: set SEED_DEMO=yes to run this script.");
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(here, "..");
const impl = path.join(here, "db-seed-demo.impl.mjs");

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
