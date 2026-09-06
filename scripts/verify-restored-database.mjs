#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const connectionString = process.env.RESTORE_DATABASE_URL;
if (!connectionString || process.env.RESTORE_DRILL !== "yes") {
  console.error(
    "Refusing to run. Set RESTORE_DRILL=yes and RESTORE_DATABASE_URL to an isolated restored database.",
  );
  process.exit(1);
}

const parsedUrl = new URL(connectionString);
const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsedUrl.hostname);
if (!local) {
  parsedUrl.searchParams.delete("sslmode");
  parsedUrl.searchParams.delete("uselibpqcompat");
}

const journal = JSON.parse(
  readFileSync(path.join(process.cwd(), "drizzle", "meta", "_journal.json"), "utf8"),
);
const expectedMigrations = journal.entries.length;
const pool = new pg.Pool({
  connectionString: parsedUrl.toString(),
  ssl: local ? undefined : { rejectUnauthorized: true },
  max: 1,
  application_name: "poachland-restore-verifier",
});

const coreTables = ["users", "listings", "deals", "messages"];
const integrityChecks = [
  ["listings_without_seller", 'SELECT count(*)::int AS count FROM "listings" l LEFT JOIN "users" u ON u.id = l.seller_id WHERE u.id IS NULL'],
  ["deals_without_proposer", 'SELECT count(*)::int AS count FROM "deals" d LEFT JOIN "users" u ON u.id = d.proposer_id WHERE u.id IS NULL'],
  ["deals_without_owner", 'SELECT count(*)::int AS count FROM "deals" d LEFT JOIN "users" u ON u.id = d.owner_id WHERE u.id IS NULL'],
  ["messages_without_thread", 'SELECT count(*)::int AS count FROM "messages" m LEFT JOIN "threads" t ON t.id = m.thread_id WHERE t.id IS NULL'],
  ["offers_without_deal", 'SELECT count(*)::int AS count FROM "offers" o LEFT JOIN "deals" d ON d.id = o.deal_id WHERE d.id IS NULL'],
];

try {
  await pool.query("BEGIN READ ONLY");

  const migrationResult = await pool.query(
    'SELECT count(*)::int AS count FROM "drizzle"."__drizzle_migrations"',
  );
  const appliedMigrations = migrationResult.rows[0].count;
  if (appliedMigrations !== expectedMigrations) {
    throw new Error(
      `Restored schema has ${appliedMigrations}/${expectedMigrations} migrations; run current migrations before verification.`,
    );
  }

  const rowCounts = {};
  for (const table of coreTables) {
    const result = await pool.query(`SELECT count(*)::int AS count FROM "${table}"`);
    rowCounts[table] = result.rows[0].count;
  }

  const integrity = {};
  for (const [name, query] of integrityChecks) {
    const result = await pool.query(query);
    integrity[name] = result.rows[0].count;
  }
  const violations = Object.entries(integrity).filter(([, count]) => count !== 0);
  if (violations.length > 0) {
    throw new Error(`Referential-integrity violations: ${JSON.stringify(Object.fromEntries(violations))}`);
  }

  const binaryColumns = await pool.query(
    "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND data_type = 'bytea' ORDER BY table_name, column_name",
  );
  if (binaryColumns.rowCount > 0) {
    throw new Error(`Unexpected binary columns in primary snapshots: ${JSON.stringify(binaryColumns.rows)}`);
  }

  await pool.query("ROLLBACK");
  console.log(JSON.stringify({
    status: "ok",
    checkedAt: new Date().toISOString(),
    targetHost: parsedUrl.hostname,
    migrations: { applied: appliedMigrations, expected: expectedMigrations },
    rowCounts,
    integrity,
    primaryDatabaseBinaryColumns: 0,
  }, null, 2));
} catch (error) {
  try {
    await pool.query("ROLLBACK");
  } catch {
    // The connection may already be gone; retain the original verification error.
  }
  console.error("Restore verification failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
