import "server-only";

import { and, eq, or, sql } from "drizzle-orm";
import type { SessionUser } from "./auth";
import type { Db } from "./db";
import { deals, listings, offers, sampleBatches, users } from "./schema";
import { claimImageUploads } from "./storage";
import { recordAdminAudit } from "./audit";
import { sanitizeUsername } from "../identifiers";

export type PublishInventoryInput = { listingId: string; username: string; displayName: string; location: string; ownsGear: boolean };

/** Promotion detaches only a reviewed item, never fabricated history or reputation. */
export async function publishManagedInventory(db: Db, actor: SessionUser, targetId: string, input: PublishInventoryInput) {
  if (!actor.isAdmin || actor.status !== "active" || actor.deletedAt || actor.id === targetId) return { ok: false as const, error: "Act as a non-admin account from an active moderator session first." };
  if (input.ownsGear !== true) return { ok: false as const, error: "Confirm that you own this gear and the saved details and photos are accurate." };
  const username = sanitizeUsername(String(input.username ?? ""));
  const displayName = String(input.displayName ?? "").trim();
  const location = String(input.location ?? "").trim();
  if (username.length < 3 || username.length > 30 || username.startsWith("sample_") || !displayName || displayName.length > 80 || !location || location.length > 120) return { ok: false as const, error: "Enter a handle without sample_, a profile name, and your real shipping location." };
  return db.transaction(async (tx) => {
    const [item] = await tx.select().from(listings).where(eq(listings.id, input.listingId));
    if (!item?.sampleBatchId || item.sellerId !== targetId) return { ok: false as const, error: "Choose an example listing owned by the account you are acting as." };
    // Serialize against batch purge and expiry before locking its content.
    const [batch] = await tx.select().from(sampleBatches).where(eq(sampleBatches.id, item.sampleBatchId)).for("update");
    if (!batch || batch.state === "deleted") return { ok: false as const, error: "This example batch has been deleted." };
    const [owner] = await tx.select().from(users).where(eq(users.id, targetId)).for("update");
    const [listing] = await tx.select().from(listings).where(eq(listings.id, item.id)).for("update");
    if (!owner || owner.isAdmin || owner.deletedAt || owner.status !== "active" || (!owner.sampleBatchId && !owner.managedByUserId) || !listing?.sampleBatchId || listing.sellerId !== owner.id || listing.status !== "active" || listing.hiddenAt) return { ok: false as const, error: "Only an active, visible example listing can be published." };
    const [linkedDeal] = await tx.select({ id: deals.id }).from(deals).where(eq(deals.listingId, listing.id)).limit(1);
    const [linkedOffer] = await tx.select({ id: offers.id }).from(offers).where(or(sql`${offers.proposerListingIds} ? ${listing.id}`, sql`${offers.ownerListingIds} ? ${listing.id}`)).limit(1);
    if (linkedDeal || linkedOffer) return { ok: false as const, error: "This item belongs to example swap history. Create a new listing for your gear." };
    if (!listing.photos.length || listing.photos.some((url) => !url.startsWith("https://"))) return { ok: false as const, error: "Replace every example image with your own uploaded photos, then save the listing first." };
    await claimImageUploads(tx, owner.id, listing.photos);
    const [taken] = await tx.select({ id: users.id }).from(users).where(and(eq(users.username, username), sql`${users.id} <> ${owner.id}`)).limit(1);
    if (taken) return { ok: false as const, error: "That handle is already taken." };
    const now = new Date();
    if (owner.sampleBatchId) {
      await tx.update(users).set({ sampleBatchId: null, managedByUserId: actor.id, username, displayName, location,
        bio: `Gear owned and managed by @${actor.username}.`, history: [], favoriteTeams: [], gallery: [],
        avatar: "/placeholder-user.jpg", baselineTrades: 0, baselineRatingCount: 0, baselineRatingSum: 0,
        trustScore: 0, ratingsCount: 0, tradesCompleted: 0, badges: [], isVerified: false,
        memberSince: now, onboardedAt: now, lastActiveAt: null, referredBy: null, passwordHash: null,
      }).where(eq(users.id, owner.id));
    }
    await tx.update(listings).set({ sampleBatchId: null, views: 0, saves: 0, isFeatured: false,
      createdAt: now, updatedAt: now, tags: listing.tags.filter((t) => !/^(sample|example|demo)(-|$)/i.test(t)),
    }).where(eq(listings.id, listing.id));
    await recordAdminAudit(tx, actor, "actAs.publishRealInventory", { type: "listing", id: listing.id }, {
      actingAsUserId: owner.id, sourceBatchId: item.sampleBatchId,
      note: "Moderator confirmed ownership and accurate saved details/photos. Item detached from example cleanup; fictional history and reputation were not converted.",
    });
    return { ok: true as const };
  });
}
