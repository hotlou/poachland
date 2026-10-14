import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Db } from "../../lib/server/db";
import * as schema from "../../lib/server/schema";
import { emptyDBState, PoachStore } from "../../lib/engine";
import { ratingOverall, ratingSummaryFrom } from "../../lib/reputation";
import { ExchangedRating } from "../../app/app/trades/[id]/deal-room-summary";

const state = vi.hoisted(() => ({ db: null as Db | null }));
vi.mock("server-only", () => ({}));
vi.mock("../../lib/server/db", () => ({ getDb: async () => state.db! }));
import { recomputeReputation } from "../../lib/server/engine-effects";
import { buildSnapshot } from "../../lib/server/snapshot";

const baseline = { baselineRatingCount: 0, baselineRatingSum: 0 };
let client: PGlite;
let db: Db;
beforeAll(async () => {
  client = new PGlite();
  const connection = drizzle(client, { schema });
  await migrate(connection, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  db = connection as Db;
  state.db = db;
  await db.insert(schema.users).values([
    { id: "u_compatowner", email: "owner@rollback.invalid", username: "compatowner", displayName: "Owner", onboardedAt: new Date(), badges: [{ id: "b_oldquick", type: "quick-shipper", label: "Quick Shipper" }] },
    { id: "u_compatrater", email: "rater@rollback.invalid", username: "compatrater", displayName: "Rater", onboardedAt: new Date() },
  ]);
}, 30_000);
afterAll(async () => { await client?.close(); });

describe("patched rollback baseline reads forward nullable ratings", () => {
  it("retains previous numeric averages and excludes unassessed dimensions from denominators", () => {
    const numeric = { communication: 5, shippingSpeed: 3, itemAccuracy: 4, wouldTradeAgain: true };
    expect(ratingOverall(numeric)).toBe(4);
    expect(ratingSummaryFrom([numeric], baseline)).toEqual({ count: 1, overall: 4, communication: 5, shippingSpeed: 3, itemAccuracy: 4, wouldTradeAgainPct: 100 });
    const unassessed = { communication: 5, shippingSpeed: null, itemAccuracy: null, wouldTradeAgain: true };
    expect(ratingOverall(unassessed)).toBe(5);
    expect(ratingSummaryFrom([numeric, unassessed], baseline)).toMatchObject({ count: 2, overall: 4.5, communication: 5, shippingSpeed: 3, itemAccuracy: 4 });
    expect(ratingSummaryFrom([unassessed], baseline)).toMatchObject({ overall: 5, shippingSpeed: 0, itemAccuracy: 0 });
  });

  it("migrates, reads and recomputes nullable rows without inventing shipping scores or losing them", async () => {
    const columns = await client.query<{ column_name: string; is_nullable: string }>("SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name='ratings' AND column_name IN ('shipping_speed','item_accuracy') ORDER BY column_name");
    expect(columns.rows).toEqual([{ column_name: "item_accuracy", is_nullable: "YES" }, { column_name: "shipping_speed", is_nullable: "YES" }]);
    await db.insert(schema.ratings).values(Array.from({ length: 8 }, (_, index) => ({
      id: `rt_compat${index}`, dealId: `d_compat${index}`, fromUserId: "u_compatrater", toUserId: "u_compatowner",
      communication: 5, shippingSpeed: null, itemAccuracy: null, wouldTradeAgain: true,
    })));
    const before = await db.select().from(schema.ratings);
    await db.transaction(async (tx) => { await recomputeReputation(tx, "u_compatowner"); });
    const [owner] = await db.select().from(schema.users).where(eq(schema.users.id, "u_compatowner"));
    expect(owner.trustScore).toBe(5);
    expect(owner.ratingsCount).toBe(8);
    expect(owner.badges.some((badge) => badge.type === "flawless")).toBe(true);
    expect(owner.badges.some((badge) => badge.type === "quick-shipper")).toBe(false);
    expect(await db.select().from(schema.ratings)).toEqual(before);

    const snapshot = await buildSnapshot(owner.id);
    expect(snapshot.ratings).toHaveLength(8);
    expect(snapshot.ratings.every((rating) => rating.shippingSpeed === null && rating.itemAccuracy === null)).toBe(true);
    const store = new PoachStore(false, { ...emptyDBState(), ...snapshot, currentUserId: owner.id });
    expect(store.ratingSummary(owner.id)).toMatchObject({ overall: 5, count: 8, shippingSpeed: 0, itemAccuracy: 0 });
    const markup = renderToStaticMarkup(createElement(ExchangedRating, { rating: store.ratingsFor(owner.id)[0], heading: "Received" }));
    expect(markup).toContain("Communication 5");
    expect(markup).not.toContain("Shipping");
    expect(markup).not.toContain("Accuracy");
    expect(markup).not.toContain("NaN");
  });

  it("still accepts legacy numeric rows after the expansion and awards shipping badges from real assessments", async () => {
    await db.insert(schema.ratings).values(Array.from({ length: 5 }, (_, index) => ({
      id: `rt_numeric${index}`, dealId: `d_numeric${index}`, fromUserId: "u_compatrater", toUserId: "u_compatowner",
      communication: 5, shippingSpeed: 5, itemAccuracy: 5, wouldTradeAgain: true,
    })));
    await db.transaction(async (tx) => { await recomputeReputation(tx, "u_compatowner"); });
    const [owner] = await db.select().from(schema.users).where(eq(schema.users.id, "u_compatowner"));
    expect(owner.trustScore).toBe(5);
    expect(owner.ratingsCount).toBe(13);
    expect(owner.badges.some((badge) => badge.type === "quick-shipper")).toBe(true);
    const snapshot = await buildSnapshot(owner.id);
    const store = new PoachStore(false, { ...emptyDBState(), ...snapshot, currentUserId: owner.id });
    expect(store.ratingSummary(owner.id)).toMatchObject({ overall: 5, count: 13, shippingSpeed: 5, itemAccuracy: 5 });
  });
});
