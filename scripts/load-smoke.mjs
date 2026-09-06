#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const result = spawnSync(
  "pnpm",
  ["exec", "tsx", "--conditions", "react-server", path.join(here, "load-smoke.impl.mjs")],
  { stdio: "inherit", cwd: path.join(here, "..") },
);
if (result.error) console.error("Failed to launch load smoke:", result.error);
process.exit(result.status ?? 1);
