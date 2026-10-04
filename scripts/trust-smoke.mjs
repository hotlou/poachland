#!/usr/bin/env node
import { spawnSync } from "node:child_process";
const result = spawnSync(process.execPath, ["--import", "tsx", "--conditions", "react-server", "scripts/trust-smoke.impl.mjs"], { stdio: "inherit" });
process.exit(result.status ?? 1);
