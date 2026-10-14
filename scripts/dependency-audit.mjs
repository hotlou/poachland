import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { evaluateDependencyAudit } from "../lib/dependency-audit-policy.mjs";

const cwd = fileURLToPath(new URL("../", import.meta.url));

function pnpmJson(args, audit = false) {
  return new Promise((resolve, reject) => {
    execFile("pnpm", args, {
      cwd,
      timeout: 60_000,
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, npm_config_fetch_retries: "1", npm_config_fetch_timeout: "20000" },
    }, (error, stdout, stderr) => {
      // Audit exits 1 when it finds vulnerabilities. Other failures stay fatal;
      // registry errors using exit 1 still fail JSON/schema validation below.
      if (error && !(audit && error.code === 1 && !error.killed && !error.signal)) {
        reject(new Error(`pnpm ${args.join(" ")} failed: ${error.message}${stderr ? `\n${stderr}` : ""}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(`pnpm ${args.join(" ")} did not return valid JSON${stderr ? `: ${stderr}` : ""}`));
      }
    });
  });
}

try {
  const [fullReport, productionReport] = await Promise.all([
    pnpmJson(["audit", "--json"], true),
    pnpmJson(["audit", "--prod", "--json"], true),
  ]);
  const result = evaluateDependencyAudit({ fullReport, productionReport });
  console.log(`Full dependency audit: ${Object.entries(result.counts).map(([level, count]) => `${count} ${level}`).join(", ")}.`);
  for (const failure of result.failures) console.error(`BLOCKED: ${failure}`);
  if (result.failures.length) process.exitCode = 1;
  else console.log("Dependency policy passed; every high/critical finding is blocking, with no exceptions.");
} catch (error) {
  console.error(`Dependency audit failed closed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
