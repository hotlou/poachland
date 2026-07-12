/**
 * Database connection (server-only).
 *
 * - With DATABASE_URL set (Neon / any Postgres): drizzle over a `pg` Pool.
 * - Without it (local dev & tests): drizzle over PGlite persisted at ./.pglite,
 *   with the SQL migrations in ./drizzle auto-applied once on first use.
 *
 * Always `await getDb()` — the singleton is memoized and async-safe (concurrent
 * first calls share one initialization promise).
 */

import "server-only";

import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let dbPromise: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = init().catch((error) => {
      // Don't cache a failed initialization — allow retry on the next call.
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

async function init(): Promise<Db> {
  const url = process.env.DATABASE_URL;

  if (url) {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: url,
      ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
      max: 5,
    });
    return drizzle(pool, { schema });
  }

  // Local dev / test fallback: embedded Postgres persisted on disk.
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  const dataDir =
    process.env.PGLITE_PATH ?? path.join(process.cwd(), ".pglite");
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await ensureMigrated(db);
  return db;
}

let migratedPromise: Promise<void> | null = null;

/**
 * Applies the SQL migrations in ./drizzle to a PGlite database. Runs at most
 * once per process; used automatically by the PGlite path of getDb().
 */
export function ensureMigrated(
  db: import("drizzle-orm/pglite").PgliteDatabase<typeof schema>,
): Promise<void> {
  if (!migratedPromise) {
    migratedPromise = (async () => {
      const { migrate } = await import("drizzle-orm/pglite/migrator");
      await migrate(db, {
        migrationsFolder: path.join(process.cwd(), "drizzle"),
      });
    })().catch((error) => {
      migratedPromise = null;
      throw error;
    });
  }
  return migratedPromise;
}
