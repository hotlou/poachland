import "server-only";

import { and, eq, inArray, or, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import type { DealStatus } from "../types";
import { getDb } from "./db";
import {
  blocks,
  deals,
  haulComments,
  haulPosts,
  haulReactions,
  identities,
  isoPosts,
  listings,
  messages,
  notifications,
  offers,
  paymentMethods,
  ratings,
  reports,
  saves,
  sessions,
  threads,
  users,
} from "./schema";

/** Deal statuses that leave a counterparty waiting — deletion is blocked. */
const IN_FLIGHT: DealStatus[] = ["open", "accepted", "disputed"];

export interface InFlightSummary {
  count: number;
}

/**
 * Open/accepted/disputed deals the user is party to. Deletion is refused while
 * any exist so nobody is left hanging mid-trade.
 */
export async function dealsInFlight(userId: string): Promise<InFlightSummary> {
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(deals)
    .where(
      and(
        or(eq(deals.proposerId, userId), eq(deals.ownerId, userId)),
        inArray(deals.status, IN_FLIGHT),
      ),
    );
  return { count: row?.n ?? 0 };
}

/**
 * Everything Poachland holds about a user, assembled for a data-portability
 * download. Read-only. Timestamps are left as ISO strings via JSON.stringify.
 */
export async function exportUserData(userId: string): Promise<Record<string, unknown>> {
  const db = await getDb();
  const [account] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!account) throw new Error("User not found");

  const viewerDeals = or(eq(deals.proposerId, userId), eq(deals.ownerId, userId));
  const viewerThreads = sql`(${threads.participantIds}->>0 = ${userId} or ${threads.participantIds}->>1 = ${userId})`;

  const [
    myListings,
    myIso,
    myDeals,
    myOffers,
    myThreads,
    myMessages,
    ratingsGiven,
    ratingsReceived,
    mySaves,
    myBlocks,
    myIdentities,
    myPayments,
    myNotifications,
    myReports,
    myHaulPosts,
    myHaulComments,
    myHaulReactions,
  ] = await Promise.all([
    db.select().from(listings).where(eq(listings.sellerId, userId)),
    db.select().from(isoPosts).where(eq(isoPosts.userId, userId)),
    db.select().from(deals).where(viewerDeals),
    db
      .select()
      .from(offers)
      .where(inArray(offers.dealId, db.select({ id: deals.id }).from(deals).where(viewerDeals))),
    db.select().from(threads).where(viewerThreads),
    db
      .select()
      .from(messages)
      .where(inArray(messages.threadId, db.select({ id: threads.id }).from(threads).where(viewerThreads))),
    db.select().from(ratings).where(eq(ratings.fromUserId, userId)),
    db.select().from(ratings).where(eq(ratings.toUserId, userId)),
    db.select().from(saves).where(eq(saves.userId, userId)),
    db.select().from(blocks).where(eq(blocks.blockerId, userId)),
    db.select().from(identities).where(eq(identities.userId, userId)),
    db.select().from(paymentMethods).where(eq(paymentMethods.userId, userId)),
    db.select().from(notifications).where(eq(notifications.userId, userId)),
    db.select().from(reports).where(eq(reports.reporterId, userId)),
    db.select().from(haulPosts).where(or(eq(haulPosts.proposerId, userId), eq(haulPosts.ownerId, userId))),
    db.select().from(haulComments).where(eq(haulComments.userId, userId)),
    db.select().from(haulReactions).where(eq(haulReactions.userId, userId)),
  ]);

  const { passwordHash: _pw, emailUnsubToken: _t, ...safeAccount } = account;
  return {
    exportedAt: new Date().toISOString(),
    note: "Your Poachland data. Payment handles and linked identities are included because they're yours; keep this file private.",
    account: safeAccount,
    listings: myListings,
    wantedPosts: myIso,
    deals: myDeals,
    offers: myOffers,
    threads: myThreads,
    messages: myMessages,
    ratingsGiven,
    ratingsReceived,
    saves: mySaves,
    blocks: myBlocks,
    linkedIdentities: myIdentities,
    paymentHandles: myPayments,
    notifications: myNotifications,
    reportsFiled: myReports,
    haulPosts: myHaulPosts,
    haulComments: myHaulComments,
    haulReactions: myHaulReactions,
  };
}

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; error: string; code?: "in_flight" | "confirm" | "not_found" };

/**
 * Permanently close an account: scrub all personal data, tombstone the row
 * (kept only so counterparties' completed deals and the ratings they left
 * still resolve), remove the user's listings and Haul posts, and destroy every
 * session. Refused while the user has a deal in flight or if the typed
 * confirmation doesn't match.
 */
export async function deleteAccount(
  userId: string,
  confirmUsername: string,
): Promise<DeleteAccountResult> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    if (!user || user.deletedAt) return { ok: false, error: "Account not found.", code: "not_found" };

    if (
      !user.username ||
      confirmUsername.trim().toLowerCase() !== user.username.toLowerCase()
    ) {
      return { ok: false, error: "The username you typed doesn't match.", code: "confirm" };
    }

    const [{ n: inFlight }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(deals)
      .where(
        and(
          or(eq(deals.proposerId, userId), eq(deals.ownerId, userId)),
          inArray(deals.status, IN_FLIGHT),
        ),
      );
    if (inFlight > 0) {
      return {
        ok: false,
        code: "in_flight",
        error:
          `You have ${inFlight} deal${inFlight === 1 ? "" : "s"} in progress. ` +
          "Wrap up or cancel them first so nobody's left hanging.",
      };
    }

    const now = new Date();
    const tag = randomBytes(4).toString("hex");

    // Scrub personal data; tombstone the row.
    await tx
      .update(users)
      .set({
        username: `deleted-${tag}`,
        displayName: "Former trader",
        avatar: "/placeholder-user.jpg",
        bio: "",
        location: "",
        favoriteTeams: [],
        history: [],
        gallery: [],
        email: `deleted+${userId}@deleted.invalid`,
        passwordHash: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        emailUnsubToken: null,
        isVerified: false,
        isAdmin: false,
        deletedAt: now,
      })
      .where(eq(users.id, userId));

    // Remove their listings from the market.
    await tx
      .update(listings)
      .set({ status: "removed", updatedAt: now })
      .where(and(eq(listings.sellerId, userId), sql`${listings.status} <> 'removed'`));

    // Close their wanted posts.
    await tx.update(isoPosts).set({ status: "closed" }).where(eq(isoPosts.userId, userId));

    // Hide their Haul posts.
    await tx
      .update(haulPosts)
      .set({ hidden: true, hiddenBy: userId })
      .where(or(eq(haulPosts.proposerId, userId), eq(haulPosts.ownerId, userId)));

    // Delete the purely personal rows.
    await tx.delete(paymentMethods).where(eq(paymentMethods.userId, userId));
    await tx.delete(identities).where(eq(identities.userId, userId));
    await tx.delete(saves).where(eq(saves.userId, userId));
    await tx.delete(blocks).where(or(eq(blocks.blockerId, userId), eq(blocks.blockedId, userId)));
    await tx.delete(notifications).where(eq(notifications.userId, userId));
    await tx.delete(haulReactions).where(eq(haulReactions.userId, userId));

    // Kill every session (including the current one).
    await tx.delete(sessions).where(eq(sessions.userId, userId));

    return { ok: true };
  });
}
