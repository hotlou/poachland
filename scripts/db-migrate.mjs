#!/usr/bin/env node
/**
 * Applies the SQL migrations in ./drizzle to the database at DATABASE_URL.
 *
 * Usage: DATABASE_URL=postgres://... pnpm db:migrate
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required. Usage: DATABASE_URL=postgres://... pnpm db:migrate");
  process.exit(1);
}

const migrationsFolder = path.join(process.cwd(), "drizzle");
const journal = JSON.parse(
  readFileSync(path.join(migrationsFolder, "meta", "_journal.json"), "utf8"),
);
const allMigrations = journal.entries.map((e) => e.tag);

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
  max: 1,
});

async function appliedCount() {
  try {
    const res = await pool.query(
      'SELECT count(*)::int AS n FROM "drizzle"."__drizzle_migrations"',
    );
    return res.rows[0].n;
  } catch {
    return 0; // migrations table doesn't exist yet
  }
}

try {
  const before = await appliedCount();
  await migrate(drizzle(pool), { migrationsFolder });
  const after = await appliedCount();

  const applied = allMigrations.slice(before, after);
  if (applied.length === 0) {
    console.log(`Already up to date (${after}/${allMigrations.length} migrations applied).`);
  } else {
    for (const tag of applied) console.log(`applied: ${tag}`);
    console.log(`Done — ${applied.length} migration(s) applied, ${after}/${allMigrations.length} total.`);
  }
} catch (error) {
  console.error("Migration failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
