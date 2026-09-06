import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

delete process.env.DATABASE_URL;
const dataDir = path.join(process.cwd(), ".pglite-load-smoke");
fs.rmSync(dataDir, { recursive: true, force: true });
process.env.PGLITE_PATH = dataDir;

const { getDb } = await import("../lib/server/db.ts");
const { users, listings } = await import("../lib/server/schema.ts");
const { queryMarketplacePage } = await import("../lib/server/marketplace-query.ts");
const { buildSnapshot } = await import("../lib/server/snapshot.ts");

const USER_COUNT = 100;
const LISTING_COUNT = 2_000;
const CONCURRENCY = 20;
const REQUESTS = 60;
const P95_TARGET_MS = 1_000;
const PAYLOAD_TARGET_BYTES = 100_000;

try {
  const db = await getDb();
  const now = new Date();
  await db.insert(users).values(
    Array.from({ length: USER_COUNT }, (_, index) => ({
      id: `u_load_${index}`,
      email: `load-${index}@example.test`,
      username: `loadtrader${index}`,
      displayName: `Load Trader ${index}`,
      onboardedAt: now,
    })),
  );
  for (let offset = 0; offset < LISTING_COUNT; offset += 250) {
    await db.insert(listings).values(
      Array.from({ length: Math.min(250, LISTING_COUNT - offset) }, (_, inner) => {
        const index = offset + inner;
        return {
          id: `l_load_${String(index).padStart(5, "0")}`,
          sellerId: `u_load_${index % USER_COUNT}`,
          type: index % 4 === 0 ? "disc" : "jersey",
          title: `${index % 3 === 0 ? "Sockeye" : "Collector"} item ${index}`,
          team: index % 3 === 0 ? "Sockeye" : `Team ${index % 80}`,
          level: index % 5 === 0 ? "college" : "club",
          condition: "Good",
          listingType: index % 2 === 0 ? "trade" : "sell",
          askingPrice: index % 2 === 0 ? null : 25 + (index % 100),
          photos: ["/images/jersey-1.jpg"],
          description: `Representative marketplace listing ${index}`,
          shippingPreference: "buyer-pays",
          tags: ["collector", index % 3 === 0 ? "sockeye" : "ultimate"],
          createdAt: new Date(now.getTime() - index * 1_000),
          updatedAt: now,
        };
      }),
    );
  }

  await queryMarketplacePage({ query: "sockeye", limit: 24 });
  const durations = [];
  let maxPayload = 0;
  for (let offset = 0; offset < REQUESTS; offset += CONCURRENCY) {
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, REQUESTS - offset) }, async (_, inner) => {
        const started = performance.now();
        const page = await queryMarketplacePage({
          query: (offset + inner) % 2 === 0 ? "sockeye" : "collector",
          itemType: (offset + inner) % 3 === 0 ? "jersey" : undefined,
          sort: (offset + inner) % 4 === 0 ? "popular" : "newest",
          limit: 24,
        });
        durations.push(performance.now() - started);
        maxPayload = Math.max(maxPayload, Buffer.byteLength(JSON.stringify(page)));
        assert.ok(page.items.length <= 24);
      }),
    );
  }
  durations.sort((a, b) => a - b);
  const p95 = durations[Math.ceil(durations.length * 0.95) - 1];
  assert.ok(p95 <= P95_TARGET_MS, `p95 ${p95.toFixed(1)}ms exceeds ${P95_TARGET_MS}ms`);
  assert.ok(maxPayload <= PAYLOAD_TARGET_BYTES, `payload ${maxPayload}B exceeds ${PAYLOAD_TARGET_BYTES}B`);
  const bootstrap = await buildSnapshot(null);
  const bootstrapBytes = Buffer.byteLength(JSON.stringify(bootstrap));
  assert.ok(bootstrap.listings.length <= 120, `bootstrap leaked ${bootstrap.listings.length} catalog listings`);
  assert.ok(bootstrap.users.length <= 200, `bootstrap leaked ${bootstrap.users.length} catalog users`);
  assert.ok(bootstrapBytes <= 1_000_000, `bootstrap payload ${bootstrapBytes}B exceeds 1MB`);
  console.log(`LOAD SMOKE: ${REQUESTS} queries, concurrency ${CONCURRENCY}, p95 ${p95.toFixed(1)}ms, max page ${maxPayload}B, bootstrap ${bootstrapBytes}B`);
} finally {
  fs.rmSync(dataDir, { recursive: true, force: true });
}
