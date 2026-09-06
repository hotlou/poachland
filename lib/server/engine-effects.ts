import "server-only";

import { and, count, eq, or, sql } from "drizzle-orm";
import { BADGE_BY_TYPE, qualifyingBadges, type BadgeStats } from "../badges";
import { ratingSummaryFrom } from "../reputation";
import type { BadgeType, MessageKind } from "../types";
import { uid } from "./auth";
import type { Db } from "./db";
import { insertNotifications, notify } from "./notify";
import { activity, deals, identities, isoPosts, listings, messages, ratings, threads, users } from "./schema";

export async function appendMessage(
  tx: Db,
  threadId: string,
  senderId: string,
  kind: MessageKind,
  content: string,
  options: { offerId?: string; createdAt?: Date; id?: string } = {},
): Promise<string> {
  const at = options.createdAt ?? new Date();
  const id = options.id ?? uid("m");
  await tx.insert(messages).values({
    id,
    threadId,
    senderId,
    kind,
    content,
    offerId: options.offerId ?? null,
    createdAt: at,
  });
  await tx
    .update(threads)
    .set({
      updatedAt: at,
      lastRead: sql`${threads.lastRead} || ${JSON.stringify({ [senderId]: at.toISOString() })}::jsonb`,
    })
    .where(eq(threads.id, threadId));
  return id;
}

export async function pushActivity(
  tx: Db,
  type: "new_listing" | "new_iso" | "deal_completed" | "new_rating" | "new_member",
  actorId: string,
  targetId: string | undefined,
  summary: string,
  linkTo?: string,
): Promise<void> {
  await tx.insert(activity).values({
    id: uid("a"),
    type,
    actorId,
    targetId: targetId ?? null,
    summary,
    createdAt: new Date(),
    linkTo: linkTo ?? null,
  });
}

export async function recomputeReputation(tx: Db, userId: string): Promise<void> {
  const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
  if (!user) return;
  const userRatings = await tx.select().from(ratings).where(eq(ratings.toUserId, userId));
  const summary = ratingSummaryFrom(userRatings, user);
  const [{ n: completedInvolving }] = await tx
    .select({ n: count() })
    .from(deals)
    .where(and(eq(deals.status, "completed"), or(eq(deals.proposerId, userId), eq(deals.ownerId, userId))));
  const [{ n: listingCount }] = await tx.select({ n: count() }).from(listings).where(eq(listings.sellerId, userId));
  const [{ n: givenAway }] = await tx
    .select({ n: count() })
    .from(deals)
    .where(and(eq(deals.status, "completed"), eq(deals.kind, "claim"), eq(deals.ownerId, userId)));
  const [{ n: isoCount }] = await tx.select({ n: count() }).from(isoPosts).where(eq(isoPosts.userId, userId));

  const shippingRatings = userRatings.map((rating) => rating.shippingSpeed);
  const stats: BadgeStats = {
    tradesCompleted: user.baselineTrades + completedInvolving,
    trustScore: summary.overall,
    ratingsCount: summary.count,
    ratingsReceived: userRatings.length,
    allFiveStar: userRatings.length > 0 && userRatings.every(
      (rating) => rating.communication === 5 && rating.shippingSpeed === 5 && rating.itemAccuracy === 5,
    ),
    shippingAvg: shippingRatings.length
      ? shippingRatings.reduce((total, rating) => total + rating, 0) / shippingRatings.length
      : 0,
    shippingCount: shippingRatings.length,
    listingCount: Number(listingCount),
    givenAway: Number(givenAway),
    isoCount: Number(isoCount),
  };

  const badges = [...user.badges];
  const notifications: Parameters<typeof insertNotifications>[1] = [];
  const has = (type: BadgeType) => badges.some((badge) => badge.type === type);
  for (const type of qualifyingBadges(stats)) {
    if (has(type)) continue;
    badges.push({ id: uid("b"), label: BADGE_BY_TYPE[type].label, type });
    notifications.push({
      userId,
      type: "badge_earned",
      title: `Badge earned: ${BADGE_BY_TYPE[type].label}`,
      body: "It now shows on your profile. Wear it well.",
      linkTo: "/app/badges",
    });
  }

  await tx.update(users).set({
    trustScore: stats.trustScore,
    ratingsCount: stats.ratingsCount,
    tradesCompleted: stats.tradesCompleted,
    badges,
  }).where(eq(users.id, userId));
  await insertNotifications(tx, notifications);
}

export async function awardEventBadge(tx: Db, userId: string, type: BadgeType): Promise<void> {
  const [user] = await tx.select({ badges: users.badges }).from(users).where(eq(users.id, userId)).for("update");
  if (!user || user.badges.some((badge) => badge.type === type)) return;
  const definition = BADGE_BY_TYPE[type];
  await tx.update(users).set({
    badges: [...user.badges, { id: uid("b"), label: definition.label, type }],
  }).where(eq(users.id, userId));
  await insertNotifications(tx, [{
    userId,
    type: "badge_earned",
    title: `Badge earned: ${definition.label}`,
    body: definition.description,
    linkTo: "/app/badges",
  }]);
}

export async function syncVerifiedIdentityBadge(tx: Db, userId: string): Promise<void> {
  const [{ n }] = await tx
    .select({ n: count() })
    .from(identities)
    .where(and(eq(identities.userId, userId), eq(identities.status, "verified")));
  if (Number(n) > 0) {
    await awardEventBadge(tx, userId, "verified");
    return;
  }
  const [target] = await tx.select({ badges: users.badges }).from(users).where(eq(users.id, userId)).for("update");
  if (!target?.badges.some((badge) => badge.type === "verified")) return;
  await tx.update(users).set({
    badges: target.badges.filter((badge) => badge.type !== "verified"),
  }).where(eq(users.id, userId));
  await notify(
    tx,
    userId,
    "system",
    "Identity badge removed",
    "Your Verified badge was removed because no confirmed linked identity remains.",
    "/app/profile",
  );
}
