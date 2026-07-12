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

/**
 * The singleton must live on globalThis, not at module level: the Next dev
 * server compiles separate module graphs for server actions and route
 * handlers, and two module-level singletons would open the same PGlite data
 * directory twice (which fails). One process — one connection.
 */
const g = globalThis as unknown as { __poachDbPromise?: Promise<Db> | null };

export function getDb(): Promise<Db> {
  if (!g.__poachDbPromise) {
    g.__poachDbPromise = init().catch((error) => {
      // Don't cache a failed initialization — allow retry on the next call.
      g.__poachDbPromise = null;
      throw error;
    });
  }
  return g.__poachDbPromise;
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
    const db = drizzle(pool, { schema });
    await migrateOnBoot(db);
    return db;
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

/**
 * Self-migrating production boot: apply any pending ./drizzle migrations on
 * the first connection after a deploy. Best-effort — concurrent cold starts
 * can race on the same pending migration, so on failure we verify the schema
 * actually exists (another instance may have won) before treating it as
 * fatal. `pnpm db:migrate` remains available for running migrations by hand.
 */
async function migrateOnBoot(
  db: import("drizzle-orm/node-postgres").NodePgDatabase<typeof schema>,
): Promise<void> {
  try {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(db, {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
  } catch (error) {
    const { sql } = await import("drizzle-orm");
    const check = await db
      .execute(
        sql`select 1 from information_schema.tables where table_schema = 'public' and table_name = 'users'`,
      )
      .catch(() => null);
    if (check && check.rows.length > 0) {
      console.warn(
        "[db] migrate-on-boot hit an error but the schema exists (likely a concurrent cold-start migration race):",
        error,
      );
      return;
    }
    throw error;
  }
}

const gm = globalThis as unknown as {
  __poachMigratedPromise?: Promise<void> | null;
};

/**
 * Applies the SQL migrations in ./drizzle to a PGlite database. Runs at most
 * once per process (globalThis-keyed for the same module-graph reason as
 * getDb); used automatically by the PGlite path of getDb().
 */
export function ensureMigrated(
  db: import("drizzle-orm/pglite").PgliteDatabase<typeof schema>,
): Promise<void> {
  if (!gm.__poachMigratedPromise) {
    gm.__poachMigratedPromise = (async () => {
      const { migrate } = await import("drizzle-orm/pglite/migrator");
      await migrate(db, {
        migrationsFolder: path.join(process.cwd(), "drizzle"),
      });
    })().catch((error) => {
      gm.__poachMigratedPromise = null;
      throw error;
    });
  }
  return gm.__poachMigratedPromise;
}
