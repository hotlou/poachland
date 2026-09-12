import "server-only";

import { and, eq, inArray, or, sql } from "drizzle-orm";
import { buildSampleContent, SAMPLE_BATCH_ID, SAMPLE_BATCH_NAME, SAMPLE_DEFAULT_DAYS } from "../sample-content";
import type { SessionUser } from "./auth";
import type { Db } from "./db";
import { recordAdminAudit } from "./audit";
import { deals, haulComments, haulPosts, haulReactions, listings, messages, notifications, offers, ratings, sampleBatches, sessions, threads, users } from "./schema";

export const MAX_SAMPLE_LISTINGS = 200;

export type SampleAction = "publish" | "hide" | "delete";

export function samplePlan(anchor = new Date()) {
  const fixture = buildSampleContent(anchor);
  return { id: SAMPLE_BATCH_ID, name: SAMPLE_BATCH_NAME, users: fixture.users.length, listings: fixture.listings.length,
    activeListings: fixture.listings.filter((l) => l.status === "active").length,
    completedSwaps: fixture.deals.filter((d) => d.status === "completed").length,
    ratings: fixture.ratings.length, haulPosts: fixture.haulPosts.length, expiresInDays: SAMPLE_DEFAULT_DAYS,
    profiles: fixture.users.map((u) => ({ username: u.username, name: u.displayName })),
    items: fixture.listings.map((l) => ({ id: l.id, title: l.title, status: l.status, photo: l.photos[0] })),
  };
}

/** Exact batch ownership, not ID prefixes, determines what can be removed. */
async function purgeBatch(tx: Db, batchId: string) {
  const ownedUsers = await tx.select({ id: users.id }).from(users).where(eq(users.sampleBatchId, batchId)).for("update");
  const ownedListings = await tx.select({ id: listings.id }).from(listings).where(eq(listings.sampleBatchId, batchId)).for("update");
  const ownedDeals = await tx.select({ id: deals.id }).from(deals).where(eq(deals.sampleBatchId, batchId)).for("update");
  const uids = ownedUsers.map((u) => u.id), lids = ownedListings.map((l) => l.id), dids = ownedDeals.map((d) => d.id);
  if (uids.length > 6 || lids.length > MAX_SAMPLE_LISTINGS || dids.length > 6) throw new Error("Batch exceeds its approved manifest; review before deleting.");
  if (uids.length) {
    const [outsideDeal] = await tx.select({ id: deals.id }).from(deals).where(and(
      sql`${deals.sampleBatchId} is distinct from ${batchId}`,
      or(inArray(deals.proposerId, uids), inArray(deals.ownerId, uids), lids.length ? inArray(deals.listingId, lids) : sql`false`),
    )).limit(1);
    const [outsideListing] = await tx.select({ id: listings.id }).from(listings).where(and(inArray(listings.sellerId, uids), sql`${listings.sampleBatchId} is distinct from ${batchId}`)).limit(1);
    const [outsideRating] = await tx.select({ id: ratings.id }).from(ratings).where(and(sql`${ratings.sampleBatchId} is distinct from ${batchId}`, or(inArray(ratings.fromUserId, uids), inArray(ratings.toUserId, uids)))).limit(1);
    const [outsideHaul] = await tx.select({ id: haulPosts.id }).from(haulPosts).where(and(sql`${haulPosts.sampleBatchId} is distinct from ${batchId}`, or(inArray(haulPosts.proposerId, uids), inArray(haulPosts.ownerId, uids)))).limit(1);
    const [outsideThread] = await tx.select({ id: threads.id }).from(threads).where(and(
      sql`${threads.participantIds} ?| array[${sql.join(uids.map((id) => sql`${id}`), sql`, `)}]`,
      dids.length ? sql`(${threads.dealId} is null or ${threads.dealId} not in (${sql.join(dids.map((id) => sql`${id}`), sql`, `)}))` : sql`true`,
    )).limit(1);
    if (outsideDeal || outsideListing || outsideRating || outsideHaul || outsideThread) throw new Error("Real content references this batch. Hide it and review those relationships before deleting.");
  }
  if (lids.length) {
    const [outsideOffer] = await tx.select({ id: offers.id }).from(offers).where(and(
      dids.length ? sql`${offers.dealId} not in (${sql.join(dids.map((id) => sql`${id}`), sql`, `)})` : sql`true`,
      sql`(${offers.proposerListingIds} ?| array[${sql.join(lids.map((id) => sql`${id}`), sql`, `)}] or ${offers.ownerListingIds} ?| array[${sql.join(lids.map((id) => sql`${id}`), sql`, `)}])`,
    )).limit(1);
    if (outsideOffer) throw new Error("An outside offer references these items. Hide the batch and review it before deleting.");
  }
  const ownedHaul = await tx.select({ id: haulPosts.id }).from(haulPosts).where(eq(haulPosts.sampleBatchId, batchId));
  if (ownedHaul.length) {
    const hids = ownedHaul.map((h) => h.id);
    // Real-authored contributions are never silently swept up in a sample purge.
    const [comment] = await tx.select({ id: haulComments.id }).from(haulComments).where(and(inArray(haulComments.haulId, hids), uids.length ? sql`${haulComments.userId} not in (${sql.join(uids.map((id) => sql`${id}`), sql`, `)})` : sql`true`)).limit(1);
    const [reaction] = await tx.select({ userId: haulReactions.userId }).from(haulReactions).where(and(inArray(haulReactions.haulId, hids), uids.length ? sql`${haulReactions.userId} not in (${sql.join(uids.map((id) => sql`${id}`), sql`, `)})` : sql`true`)).limit(1);
    if (comment || reaction) throw new Error("Real contributions reference these examples. Hide the batch and review them before deleting.");
  }
  await tx.delete(haulPosts).where(eq(haulPosts.sampleBatchId, batchId));
  await tx.delete(ratings).where(eq(ratings.sampleBatchId, batchId));
  if (dids.length) {
    const trs = await tx.select({ id: threads.id }).from(threads).where(inArray(threads.dealId, dids));
    if (trs.length) await tx.delete(messages).where(inArray(messages.threadId, trs.map((t) => t.id)));
    await tx.delete(threads).where(inArray(threads.dealId, dids));
  }
  await tx.delete(deals).where(eq(deals.sampleBatchId, batchId));
  await tx.delete(listings).where(eq(listings.sampleBatchId, batchId));
  if (uids.length) {
    await tx.delete(notifications).where(inArray(notifications.userId, uids));
    await tx.update(sessions).set({ impersonatingUserId: null }).where(inArray(sessions.impersonatingUserId, uids));
    await tx.delete(sessions).where(inArray(sessions.userId, uids));
  }
  await tx.delete(users).where(eq(users.sampleBatchId, batchId));
}

export async function manageSampleBatch(db: Db, actor: SessionUser, input: { action: SampleAction; batchId: string; confirm: string; days?: number; note: string }) {
  if (!actor.isAdmin) return { ok: false as const, error: "Moderators only" };
  if (input.batchId !== SAMPLE_BATCH_ID || !["publish", "hide", "delete"].includes(input.action)) return { ok: false as const, error: "Unknown sample batch or action" };
  if (input.confirm !== `${input.action.toUpperCase()} ${SAMPLE_BATCH_ID}`) return { ok: false as const, error: "Type the full action and batch ID to confirm." };
  const days = input.days ?? SAMPLE_DEFAULT_DAYS;
  if (!Number.isInteger(days) || days < 1 || days > 90) return { ok: false as const, error: "Choose a lifetime from 1 to 90 days." };
  if (typeof input.note !== "string" || input.note.trim().length < 10 || input.note.length > 2000) return { ok: false as const, error: "Add a reason of 10–2,000 characters." };
  try {
    return await db.transaction(async (tx) => {
      const now = new Date();
      await tx.insert(sampleBatches).values({ id: SAMPLE_BATCH_ID, name: SAMPLE_BATCH_NAME, state: "hidden", createdBy: actor.id,
        publishedAt: now, expiresAt: new Date(now.getTime() + days * 86_400_000) }).onConflictDoNothing();
      const [batch] = await tx.select().from(sampleBatches).where(eq(sampleBatches.id, SAMPLE_BATCH_ID)).for("update");
      if (input.action === "hide") {
        if (batch.state !== "deleted") await tx.update(sampleBatches).set({ state: "hidden", archivedAt: now, archivalReason: input.note.trim() }).where(eq(sampleBatches.id, batch.id));
      } else if (input.action === "delete") {
        await purgeBatch(tx, batch.id);
        await tx.update(sampleBatches).set({ state: "deleted", archivedAt: now, archivalReason: input.note.trim() }).where(eq(sampleBatches.id, batch.id));
      } else {
        const [existingUser] = await tx.select({ id: users.id }).from(users).where(eq(users.sampleBatchId, batch.id)).limit(1);
        const [existingDeal] = await tx.select({ id: deals.id }).from(deals).where(eq(deals.sampleBatchId, batch.id)).limit(1);
        const exists = existingUser || existingDeal;
        if (!exists) {
          const data = buildSampleContent(now);
          const [retained] = await tx.select({ id: users.id }).from(users).where(inArray(users.id, data.users.map((u) => u.id))).limit(1);
          if (retained) throw new Error("Real content now uses these profiles. This batch cannot be recreated after deletion.");
          await tx.insert(users).values(data.users.map((u) => ({ ...u, memberSince: new Date(u.memberSince), onboardedAt: new Date(u.memberSince),
            email: `${u.username}@samples.invalid`, emailPrefs: { deals: false, messages: false, community: false, account: false } })));
          await tx.insert(listings).values(data.listings.map((l) => ({ ...l, createdAt: new Date(l.createdAt), updatedAt: new Date(l.updatedAt), hiddenAt: null })));
          await tx.insert(deals).values(data.deals.map(({ offers: _offers, ...d }) => ({ ...d, sampleBatchId: batch.id,
            createdAt: new Date(d.createdAt), updatedAt: new Date(d.updatedAt), acceptedAt: d.acceptedAt ? new Date(d.acceptedAt) : null,
            completedAt: d.completedAt ? new Date(d.completedAt) : null, closedAt: null })));
          await tx.insert(threads).values(data.deals.map((d) => ({ id: d.threadId, participantIds: [d.proposerId, d.ownerId] as [string, string],
            listingId: d.listingId, dealId: d.id, createdAt: new Date(d.createdAt), updatedAt: new Date(d.updatedAt) })));
          await tx.insert(offers).values(data.deals.flatMap((d) => d.offers.map((o, position) => ({ ...o, dealId: d.id, position, createdAt: new Date(o.createdAt), expiresAt: new Date(o.expiresAt) }))));
          await tx.insert(ratings).values(data.ratings.map((r) => ({ ...r, createdAt: new Date(r.createdAt) })));
          await tx.insert(haulPosts).values(data.haulPosts.map((h) => ({ ...h, createdAt: new Date(h.createdAt) })));
        }
        // Re-publishing never rewrites individual content or moderation decisions.
        await tx.update(sampleBatches).set({ state: "published", expiresAt: new Date(now.getTime() + days * 86_400_000), archivedAt: null, archivalReason: null,
          ...(!exists ? { publishedAt: now } : {}) }).where(eq(sampleBatches.id, batch.id));
      }
      await recordAdminAudit(tx, actor, `sampleBatch.${input.action}`, { type: "sampleBatch", id: batch.id }, { note: input.note.trim(), days, manifest: samplePlan() });
      return { ok: true as const };
    });
  } catch (error) {
    // Keep database errors (including collision details) out of the browser.
    const message = error instanceof Error ? error.message : "";
    return { ok: false as const, error: /^(Batch exceeds|Real content|An outside offer|Real contributions)/.test(message) ? message : "Batch change failed and was rolled back. Check the server logs or review conflicting records." };
  }
}

/** Called by the existing authenticated five-minute worker, independent of traffic. */
export async function expireSampleBatches(db: Db): Promise<number> {
  const rows = await db.update(sampleBatches).set({ state: "hidden", archivedAt: new Date(), archivalReason: "Automatic expiry" })
    .where(and(eq(sampleBatches.state, "published"), sql`${sampleBatches.expiresAt} <= now()`)).returning({ id: sampleBatches.id });
  return rows.length;
}
