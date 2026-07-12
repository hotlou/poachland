/**
 * Applies the ./drizzle migrations over Neon's HTTPS SQL endpoint.
 *
 * Use this instead of `pnpm db:migrate` from environments where raw
 * Postgres TCP (port 5432) is blocked (CI sandboxes, proxied networks) —
 * it only needs HTTPS. Honors HTTPS_PROXY via undici's EnvHttpProxyAgent.
 *
 *   DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" \
 *     node scripts/db-migrate-http.mjs
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL to the Neon connection string.");
  process.exit(1);
}

try {
  const { setGlobalDispatcher, EnvHttpProxyAgent } = await import("undici");
  setGlobalDispatcher(new EnvHttpProxyAgent());
} catch {
  // no proxy support available/needed — direct fetch
}

const sql = neon(url);
const db = drizzle(sql);

await migrate(db, { migrationsFolder: "drizzle" });

const applied = await sql`
  select count(*)::int as n from drizzle.__drizzle_migrations
`;
const tables = await sql`
  select table_name from information_schema.tables
  where table_schema = 'public' order by table_name
`;
console.log(`Migrations applied: ${applied[0].n}`);
console.log(`Tables (${tables.length}): ${tables.map((t) => t.table_name).join(", ")}`);
