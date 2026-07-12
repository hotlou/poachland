/**
 * WorldSnapshot / AdminData assembly (server-only).
 *
 * buildSnapshot returns the viewer's world per the contract in
 * lib/shared/ops.ts: public collections for everyone, private collections
 * (deals, threads, messages, notifications, saves, reports, blocks) scoped to
 * the viewer, emails stripped, all timestamps converted to ISO strings, and
 * DealRecord.offers rebuilt from the offers table ordered by position.
 * Before reading, the viewer's open deals are swept for expired offers.
 */

import "server-only";

import { and, asc, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import type { AdminData, SessionMe, WorldSnapshot } from "../shared/ops";
import type {
  ActivityEvent,
  Block,
  DealRecord,
  IdentityRecord,
  ISOPostRecord,
  ListingRecord,
  MessageRecord,
  Notification,
  Offer,
  Rating,
  Report,
  Save,
  ThreadRecord,
  UserRecord,
} from "../types";
import { getDb, type Db } from "./db";
import { sweepExpiredDealsForViewer } from "./engine";
import {
  activity,
  blocks,
  deals,
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
  threads,
  type ActivityRow,
  type BlockRow,
  type DealRow,
  type IdentityRow,
  type IsoPostRow,
  type ListingRow,
  type MessageRow,
  type NotificationRow,
  type OfferRow,
  type PaymentMethodRow,
  type RatingRow,
  type ReportRow,
  type SaveRow,
  type ThreadRow,
  type UserRow,
} from "./schema";
import { users } from "./schema";

// ─── Row → Record mappers (Dates become ISO strings at this boundary) ─────────

const iso = (d: Date): string => d.toISOString();
const isoOpt = (d: Date | null): string | undefined => (d ? d.toISOString() : undefined);

function toUserRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    username: row.username ?? "",
    displayName: row.displayName,
    avatar: row.avatar,
    bio: row.bio,
    location: row.location,
    favoriteTeams: row.favoriteTeams,
    history: row.history,
    gallery: row.gallery,
    memberSince: iso(row.memberSince),
    isVerified: row.isVerified,
    badges: row.badges,
    baselineTrades: row.baselineTrades,
    baselineRatingCount: row.baselineRatingCount,
    baselineRatingSum: row.baselineRatingSum,
    trustScore: row.trustScore,
    ratingsCount: row.ratingsCount,
    tradesCompleted: row.tradesCompleted,
  };
}

function toListingRecord(row: ListingRow): ListingRecord {
  return {
    id: row.id,
    sellerId: row.sellerId,
    type: row.type,
    title: row.title,
    team: row.team,
    year: row.year ?? undefined,
    division: row.division ?? undefined,
    level: row.level,
    size: row.size ?? undefined,
    condition: row.condition,
    listingType: row.listingType,
    askingPrice: row.askingPrice ?? undefined,
    tradeFor: row.tradeFor ?? undefined,
    photos: row.photos,
    description: row.description,
    views: row.views,
    saves: row.saves,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    shippingPreference: row.shippingPreference,
    tags: row.tags,
    isRare: row.isRare,
    isFeatured: row.isFeatured,
    status: row.status,
  };
}

function toISORecord(row: IsoPostRow): ISOPostRecord {
  return {
    id: row.id,
    userId: row.userId,
    itemType: row.itemType,
    description: row.description,
    team: row.team ?? undefined,
    size: row.size ?? undefined,
    maxPrice: row.maxPrice ?? undefined,
    createdAt: iso(row.createdAt),
    saves: row.saves,
    status: row.status,
  };
}

function toOffer(row: OfferRow): Offer {
  return {
    id: row.id,
    byUserId: row.byUserId,
    proposerListingIds: row.proposerListingIds,
    ownerListingIds: row.ownerListingIds,
    cashFromProposer: row.cashFromProposer,
    cashFromOwner: row.cashFromOwner,
    note: row.note,
    createdAt: iso(row.createdAt),
    expiresAt: iso(row.expiresAt),
    status: row.status,
  };
}

function toDealRecord(row: DealRow, offerRows: OfferRow[]): DealRecord {
  return {
    id: row.id,
    kind: row.kind,
    listingId: row.listingId,
    proposerId: row.proposerId,
    ownerId: row.ownerId,
    offers: offerRows.map(toOffer),
    status: row.status,
    threadId: row.threadId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    acceptedAt: isoOpt(row.acceptedAt),
    completedAt: isoOpt(row.completedAt),
    closedAt: isoOpt(row.closedAt),
    declineReason: row.declineReason ?? undefined,
    disputeReason: row.disputeReason ?? undefined,
    fulfillment: row.fulfillment,
  };
}

function toThreadRecord(row: ThreadRow): ThreadRecord {
  return {
    id: row.id,
    participantIds: row.participantIds,
    listingId: row.listingId ?? undefined,
    isoPostId: row.isoPostId ?? undefined,
    dealId: row.dealId ?? undefined,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    lastRead: row.lastRead,
  };
}

function toMessageRecord(row: MessageRow): MessageRecord {
  return {
    id: row.id,
    threadId: row.threadId,
    senderId: row.senderId,
    kind: row.kind,
    content: row.content,
    offerId: row.offerId ?? undefined,
    createdAt: iso(row.createdAt),
  };
}

function toRating(row: RatingRow): Rating {
  return {
    id: row.id,
    dealId: row.dealId,
    fromUserId: row.fromUserId,
    toUserId: row.toUserId,
    communication: row.communication,
    shippingSpeed: row.shippingSpeed,
    itemAccuracy: row.itemAccuracy,
    wouldTradeAgain: row.wouldTradeAgain,
    comment: row.comment ?? undefined,
    createdAt: iso(row.createdAt),
  };
}

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    body: row.body,
    read: row.read,
    createdAt: iso(row.createdAt),
    linkTo: row.linkTo ?? undefined,
  };
}

function toSave(row: SaveRow): Save {
  return {
    userId: row.userId,
    targetType: row.targetType,
    targetId: row.targetId,
    createdAt: iso(row.createdAt),
  };
}

function toReport(row: ReportRow): Report {
  return {
    id: row.id,
    reporterId: row.reporterId,
    targetType: row.targetType,
    targetId: row.targetId,
    reason: row.reason,
    details: row.details ?? undefined,
    status: row.status,
    resolution: row.resolution ?? undefined,
    createdAt: iso(row.createdAt),
    resolvedAt: isoOpt(row.resolvedAt),
  };
}

function toBlock(row: BlockRow): Block {
  return {
    blockerId: row.blockerId,
    blockedId: row.blockedId,
    createdAt: iso(row.createdAt),
  };
}

function toActivityEvent(row: ActivityRow): ActivityEvent {
  return {
    id: row.id,
    type: row.type,
    actorId: row.actorId,
    targetId: row.targetId ?? undefined,
    summary: row.summary,
    createdAt: iso(row.createdAt),
    linkTo: row.linkTo ?? undefined,
  };
}

function toIdentityRecord(row: IdentityRow): IdentityRecord {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider,
    handle: row.handle,
    url: row.url ?? undefined,
    status: row.status,
    submittedAt: iso(row.submittedAt),
    verifiedAt: isoOpt(row.verifiedAt),
    reviewerNote: row.reviewerNote ?? undefined,
  };
}

function groupOffersByDeal(rows: OfferRow[]): Map<string, OfferRow[]> {
  const map = new Map<string, OfferRow[]>();
  for (const row of rows) {
    const list = map.get(row.dealId);
    if (list) list.push(row);
    else map.set(row.dealId, [row]);
  }
  return map; // rows arrive ordered by (dealId, position)
}

// ─── buildSnapshot ────────────────────────────────────────────────────────────

const ACTIVITY_LIMIT = 50;

export async function buildSnapshot(viewerId: string | null): Promise<WorldSnapshot> {
  const db = await getDb();

  // Lazy expiry: sweep the viewer's open deals before reading.
  if (viewerId) {
    await sweepExpiredDealsForViewer(db, viewerId);
  }

  // Public collections.
  const [userRows, listingRows, isoRows, ratingRows, activityRows, identityRows] =
    await Promise.all([
      db.select().from(users).orderBy(asc(users.memberSince), asc(users.id)),
      viewerId
        ? db
            .select()
            .from(listings)
            .where(or(ne(listings.status, "removed"), eq(listings.sellerId, viewerId)))
            .orderBy(asc(listings.createdAt), asc(listings.id))
        : db
            .select()
            .from(listings)
            .where(ne(listings.status, "removed"))
            .orderBy(asc(listings.createdAt), asc(listings.id)),
      db.select().from(isoPosts).orderBy(asc(isoPosts.createdAt), asc(isoPosts.id)),
      db.select().from(ratings).orderBy(asc(ratings.createdAt), asc(ratings.id)),
      db
        .select()
        .from(activity)
        .orderBy(desc(activity.createdAt), desc(activity.id))
        .limit(ACTIVITY_LIMIT),
      db.select().from(identities).orderBy(asc(identities.submittedAt), asc(identities.id)),
    ]);

  // Private collections (viewer-scoped). Signed-out viewers get empty ones.
  let dealRows: DealRow[] = [];
  let offerRows: OfferRow[] = [];
  let threadRows: ThreadRow[] = [];
  let messageRows: MessageRow[] = [];
  let notificationRows: NotificationRow[] = [];
  let saveRows: SaveRow[] = [];
  let reportRows: ReportRow[] = [];
  let blockRows: BlockRow[] = [];
  let paymentRows: PaymentMethodRow[] = [];

  if (viewerId) {
    const viewerDeals = or(eq(deals.proposerId, viewerId), eq(deals.ownerId, viewerId));
    const viewerThreads = sql`(${threads.participantIds}->>0 = ${viewerId} or ${threads.participantIds}->>1 = ${viewerId})`;
    [dealRows, offerRows, threadRows, messageRows, notificationRows, saveRows, reportRows, blockRows] =
      await Promise.all([
        db.select().from(deals).where(viewerDeals).orderBy(asc(deals.createdAt), asc(deals.id)),
        db
          .select()
          .from(offers)
          .where(
            inArray(
              offers.dealId,
              db.select({ id: deals.id }).from(deals).where(viewerDeals),
            ),
          )
          .orderBy(asc(offers.dealId), asc(offers.position)),
        db
          .select()
          .from(threads)
          .where(viewerThreads)
          .orderBy(asc(threads.createdAt), asc(threads.id)),
        db
          .select()
          .from(messages)
          .where(
            inArray(
              messages.threadId,
              db.select({ id: threads.id }).from(threads).where(viewerThreads),
            ),
          )
          .orderBy(asc(messages.createdAt), asc(messages.id)),
        db
          .select()
          .from(notifications)
          .where(eq(notifications.userId, viewerId))
          .orderBy(asc(notifications.createdAt), asc(notifications.id)),
        db
          .select()
          .from(saves)
          .where(eq(saves.userId, viewerId))
          .orderBy(asc(saves.createdAt)),
        db
          .select()
          .from(reports)
          .where(eq(reports.reporterId, viewerId))
          .orderBy(asc(reports.createdAt), asc(reports.id)),
        db
          .select()
          .from(blocks)
          .where(or(eq(blocks.blockerId, viewerId), eq(blocks.blockedId, viewerId)))
          .orderBy(asc(blocks.createdAt)),
      ]);

    // Payment handles are PRIVATE: the viewer's own, plus those belonging to
    // counterparties in the viewer's ACCEPTED deals (settle-up reveal).
    const counterpartyIds = new Set<string>();
    for (const d of dealRows) {
      if (d.status !== "accepted") continue;
      counterpartyIds.add(d.proposerId === viewerId ? d.ownerId : d.proposerId);
    }
    paymentRows = await db
      .select()
      .from(paymentMethods)
      .where(inArray(paymentMethods.userId, [viewerId, ...counterpartyIds]))
      .orderBy(asc(paymentMethods.createdAt), asc(paymentMethods.id));
  }

  const viewerRow = viewerId ? userRows.find((u) => u.id === viewerId) ?? null : null;
  const me: SessionMe | null = viewerRow
    ? {
        ...toUserRecord(viewerRow),
        email: viewerRow.email,
        isAdmin: viewerRow.isAdmin,
        needsOnboarding: !viewerRow.username,
        hasPassword: !!viewerRow.passwordHash,
      }
    : null;

  const offersByDeal = groupOffersByDeal(offerRows);

  return {
    v: 1,
    serverTime: new Date().toISOString(),
    me,
    // Public profiles: onboarded users only, emails stripped.
    users: userRows.filter((u) => u.username !== null).map(toUserRecord),
    listings: listingRows.map(toListingRecord),
    isoPosts: isoRows.map(toISORecord),
    deals: dealRows.map((d) => toDealRecord(d, offersByDeal.get(d.id) ?? [])),
    threads: threadRows.map(toThreadRecord),
    messages: messageRows.map(toMessageRecord),
    ratings: ratingRows.map(toRating),
    notifications: notificationRows.map(toNotification),
    saves: saveRows.map(toSave),
    reports: reportRows.map(toReport),
    blocks: blockRows.map(toBlock),
    activity: activityRows.map(toActivityEvent).reverse(), // chronological
    identities: identityRows.map(toIdentityRecord),
    paymentMethods: paymentRows.map(toPaymentMethod),
  };
}

function toPaymentMethod(row: PaymentMethodRow) {
  return {
    id: row.id,
    userId: row.userId,
    kind: row.kind,
    label: row.label ?? undefined,
    value: row.value,
    createdAt: iso(row.createdAt),
  };
}

// ─── buildAdminData ───────────────────────────────────────────────────────────

export async function buildAdminData(): Promise<AdminData> {
  const db = await getDb();

  const [
    userRows,
    reportRows,
    disputedRows,
    identityRows,
    dealStatusCounts,
    listingStatusCounts,
    [{ n: isoActive }],
    [{ n: ratingCount }],
    [{ n: messageCount }],
  ] = await Promise.all([
    db.select().from(users).orderBy(asc(users.memberSince), asc(users.id)),
    db.select().from(reports).orderBy(desc(reports.createdAt), desc(reports.id)),
    db
      .select()
      .from(deals)
      .where(eq(deals.status, "disputed"))
      .orderBy(asc(deals.createdAt), asc(deals.id)),
    db.select().from(identities).orderBy(asc(identities.submittedAt), asc(identities.id)),
    db.select({ status: deals.status, n: sql<number>`count(*)::int` }).from(deals).groupBy(deals.status),
    db
      .select({ status: listings.status, n: sql<number>`count(*)::int` })
      .from(listings)
      .groupBy(listings.status),
    db.select({ n: sql<number>`count(*)::int` }).from(isoPosts).where(eq(isoPosts.status, "active")),
    db.select({ n: sql<number>`count(*)::int` }).from(ratings),
    db.select({ n: sql<number>`count(*)::int` }).from(messages),
  ]);

  const disputedOffers =
    disputedRows.length > 0
      ? await db
          .select()
          .from(offers)
          .where(inArray(offers.dealId, disputedRows.map((d) => d.id)))
          .orderBy(asc(offers.dealId), asc(offers.position))
      : [];
  const offersByDeal = groupOffersByDeal(disputedOffers);

  const dealCount = (status: string) =>
    dealStatusCounts.find((r) => r.status === status)?.n ?? 0;
  const listingCount = (status: string) =>
    listingStatusCounts.find((r) => r.status === status)?.n ?? 0;
  const dealsTotal = dealStatusCounts.reduce((s, r) => s + r.n, 0);
  const listingsTotal = listingStatusCounts.reduce((s, r) => s + r.n, 0);

  const identityQueue = identityRows.filter(
    (i) => i.status === "pending" || i.status === "unverified",
  );

  return {
    reports: reportRows.map(toReport),
    disputedDeals: disputedRows.map((d) => toDealRecord(d, offersByDeal.get(d.id) ?? [])),
    identityQueue: identityQueue.map(toIdentityRecord),
    users: userRows.map((u) => ({ ...toUserRecord(u), email: u.email })),
    stats: {
      users: userRows.length,
      verifiedUsers: userRows.filter((u) => u.isVerified).length,
      listings: listingsTotal - listingCount("removed"),
      activeListings: listingCount("active"),
      isoPosts: isoActive,
      dealsTotal,
      dealsOpen: dealCount("open"),
      dealsAccepted: dealCount("accepted"),
      dealsCompleted: dealCount("completed"),
      dealsDisputed: dealCount("disputed"),
      pendingReports: reportRows.filter((r) => r.status === "pending").length,
      pendingIdentities: identityQueue.length,
      ratings: ratingCount,
      messages: messageCount,
    },
  };
}
