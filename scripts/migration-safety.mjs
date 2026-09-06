#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const migrationDir = path.join(process.cwd(), "drizzle");
const files = fs.readdirSync(migrationDir).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
assert.ok(files.length > 0, "no SQL migrations found");

// Additive and index-replacement migrations keep the previous application
// release functional. Destructive shape changes require an explicit expand /
// migrate / contract sequence and must never slip through an ordinary PR.
const destructive = [
  /\bdrop\s+table\b/i,
  /\bdrop\s+column\b/i,
  /\btruncate\b/i,
  /\balter\s+column\b[^;]*\btype\b/i,
  /\balter\s+type\b[^;]*\b(rename|drop)\b/i,
];

const violations = [];
for (const file of files) {
  const sql = fs.readFileSync(path.join(migrationDir, file), "utf8");
  for (const pattern of destructive) {
    if (pattern.test(sql)) violations.push(`${file}: ${pattern}`);
  }
}

assert.deepEqual(
  violations,
  [],
  `destructive migration detected; use a backward-compatible expand/migrate/contract rollout:\n${violations.join("\n")}`,
);
console.log(`MIGRATION SAFETY: ${files.length} migrations are backward-compatible with the previous release.`);
