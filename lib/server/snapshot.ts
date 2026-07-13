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
  HaulComment,
  HaulCommentRecord,
  HaulPost,
  HaulPostRecord,
  HaulReactionEmoji,
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
  threads,
  type ActivityRow,
  type BlockRow,
  type DealRow,
  type HaulCommentRow,
  type HaulPostRow,
  type HaulReactionRow,
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

function toHaulPostRecord(row: HaulPostRow): HaulPostRecord {
  return {
    id: row.id,
    dealId: row.dealId,
    kind: row.kind,
    proposerId: row.proposerId,
    ownerId: row.ownerId,
    sharedBy: row.sharedBy,
    proposerSide: row.proposerSide,
    ownerSide: row.ownerSide,
    note: row.note ?? undefined,
    commentsEnabled: row.commentsEnabled,
    hidden: row.hidden,
    hiddenBy: row.hiddenBy ?? undefined,
    createdAt: iso(row.createdAt),
  };
}

function toHaulCommentRecord(row: HaulCommentRow): HaulCommentRecord {
  return {
    id: row.id,
    haulId: row.haulId,
    userId: row.userId,
    body: row.body,
    createdAt: iso(row.createdAt),
    hidden: row.hidden,
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

export async function buildSnapshot(
  viewerId: string | null,
  impersonatorUsername?: string,
): Promise<WorldSnapshot> {
  const db = await getDb();

  // Lazy expiry: sweep the viewer's open deals before reading.
  if (viewerId) {
    await sweepExpiredDealsForViewer(db, viewerId);
  }

  // Public collections.
  const [userRows, listingRows, isoRows, ratingRows, activityRows, identityRows, haulPostRows] =
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
      db.select().from(haulPosts).orderBy(desc(haulPosts.createdAt), desc(haulPosts.id)),
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
  const viewerIsAdmin = !!viewerRow?.isAdmin;
  const referralCount = viewerId ? userRows.filter((u) => u.referredBy === viewerId).length : 0;
  const viewerOnboarded = viewerRow?.onboardedAt?.getTime();
  const memberNumber = viewerOnboarded
    ? userRows.filter((u) => u.onboardedAt && u.onboardedAt.getTime() <= viewerOnboarded).length
    : 0;
  const me: SessionMe | null = viewerRow
    ? {
        ...toUserRecord(viewerRow),
        email: viewerRow.email,
        isAdmin: viewerRow.isAdmin,
        needsOnboarding: !viewerRow.username,
        hasPassword: !!viewerRow.passwordHash,
        // Shadowban is masked to "active" for the user's own payload — they
        // must never learn they're shadowbanned.
        accountStatus:
          viewerRow.status === "suspended"
            ? "suspended"
            : viewerRow.status === "banned"
              ? "banned"
              : "active",
        suspendedUntil: viewerRow.suspendedUntil ? iso(viewerRow.suspendedUntil) : undefined,
        moderationNote:
          viewerRow.status === "suspended" || viewerRow.status === "banned"
            ? viewerRow.moderationNote ?? undefined
            : undefined,
        impersonatedByAdmin: impersonatorUsername,
        emailPrefs: viewerRow.emailPrefs ?? {
          deals: true,
          messages: true,
          community: true,
          account: true,
        },
        referralCount,
        memberNumber,
      }
    : null;

  const offersByDeal = groupOffersByDeal(offerRows);

  // Content hiding: shadowbanned/suspended/banned users vanish from public
  // discovery (browse, wanted board, activity, directory, spotlight) for
  // everyone except themselves — and admins, who must see everything to
  // moderate. Existing relationships (the viewer's own deals/threads) keep
  // resolving via a relationship allowlist so nothing breaks mid-trade.
  const hidden = new Set<string>();
  if (!viewerIsAdmin) {
    for (const u of userRows) {
      if (u.id === viewerId) continue;
      if (u.status === "shadowbanned" || u.status === "banned" || u.status === "suspended") {
        hidden.add(u.id);
      }
    }
  }
  // Deleted accounts vanish from discovery for everyone (even admins); they
  // stay resolvable only via the relationship allowlist so a counterparty's
  // completed deals and the ratings they left still render.
  for (const u of userRows) {
    if (u.deletedAt && u.id !== viewerId) hidden.add(u.id);
  }
  const related = new Set<string>();
  if (viewerId) {
    related.add(viewerId);
    for (const d of dealRows) {
      related.add(d.proposerId);
      related.add(d.ownerId);
    }
    for (const t of threadRows) {
      for (const p of t.participantIds) related.add(p);
    }
  }
  const userVisible = (id: string) => !hidden.has(id) || related.has(id);

  // ── The Haul: hydrate the public wall ──────────────────────────────────────
  // A post is public when it isn't hidden, both traders are visible, and the
  // viewer doesn't have a block with either trader. Parties always see their
  // own posts (even hidden ones) so the deal room can reflect Haul state.
  const blockedWith = new Set<string>();
  if (viewerId) {
    for (const b of blockRows) {
      blockedWith.add(b.blockerId === viewerId ? b.blockedId : b.blockerId);
    }
  }
  const isHaulParty = (p: HaulPostRow) =>
    !!viewerId && (p.proposerId === viewerId || p.ownerId === viewerId);
  const visibleHaul = haulPostRows.filter((p) => {
    if (isHaulParty(p)) return true;
    if (p.hidden) return false;
    if (!userVisible(p.proposerId) || !userVisible(p.ownerId)) return false;
    if (blockedWith.has(p.proposerId) || blockedWith.has(p.ownerId)) return false;
    return true;
  });

  let reactionRows: HaulReactionRow[] = [];
  let commentRows: HaulCommentRow[] = [];
  if (visibleHaul.length) {
    const ids = visibleHaul.map((p) => p.id);
    [reactionRows, commentRows] = await Promise.all([
      db.select().from(haulReactions).where(inArray(haulReactions.haulId, ids)),
      db
        .select()
        .from(haulComments)
        .where(and(inArray(haulComments.haulId, ids), eq(haulComments.hidden, false)))
        .orderBy(asc(haulComments.createdAt), asc(haulComments.id)),
    ]);
  }

  const userById = new Map(userRows.map((u) => [u.id, u]));
  const countsByHaul = new Map<string, Partial<Record<HaulReactionEmoji, number>>>();
  const myReactionByHaul = new Map<string, HaulReactionEmoji>();
  for (const r of reactionRows) {
    const c = countsByHaul.get(r.haulId) ?? {};
    c[r.emoji] = (c[r.emoji] ?? 0) + 1;
    countsByHaul.set(r.haulId, c);
    if (r.userId === viewerId) myReactionByHaul.set(r.haulId, r.emoji);
  }
  const commentsByHaul = new Map<string, HaulComment[]>();
  for (const c of commentRows) {
    const author = userById.get(c.userId);
    if (!author || !userVisible(c.userId)) continue; // drop shadowbanned authors
    const list = commentsByHaul.get(c.haulId) ?? [];
    list.push({ ...toHaulCommentRecord(c), user: toUserRecord(author) });
    commentsByHaul.set(c.haulId, list);
  }
  const hydratedHaul: HaulPost[] = visibleHaul
    .filter((p) => userById.has(p.proposerId) && userById.has(p.ownerId))
    .map((p) => {
      const counts = countsByHaul.get(p.id) ?? {};
      const total = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);
      const comments = commentsByHaul.get(p.id) ?? [];
      return {
        ...toHaulPostRecord(p),
        proposer: toUserRecord(userById.get(p.proposerId)!),
        owner: toUserRecord(userById.get(p.ownerId)!),
        reactionCounts: counts,
        totalReactions: total,
        myReaction: myReactionByHaul.get(p.id),
        comments,
        commentCount: comments.length,
      };
    });

  return {
    v: 1,
    serverTime: new Date().toISOString(),
    me,
    // Public profiles: onboarded users only, emails stripped, hidden users
    // dropped (kept only if the viewer has a live relationship with them).
    users: userRows
      .filter((u) => u.username !== null && userVisible(u.id))
      .map(toUserRecord),
    listings: listingRows.filter((l) => userVisible(l.sellerId)).map(toListingRecord),
    isoPosts: isoRows.filter((p) => !hidden.has(p.userId)).map(toISORecord),
    deals: dealRows.map((d) => toDealRecord(d, offersByDeal.get(d.id) ?? [])),
    threads: threadRows.map(toThreadRecord),
    messages: messageRows.map(toMessageRecord),
    ratings: ratingRows.map(toRating),
    notifications: notificationRows.map(toNotification),
    saves: saveRows.map(toSave),
    reports: reportRows.map(toReport),
    blocks: blockRows.map(toBlock),
    activity: activityRows
      .filter((a) => !hidden.has(a.actorId))
      .map(toActivityEvent)
      .reverse(), // chronological
    identities: identityRows.map(toIdentityRecord),
    paymentMethods: paymentRows.map(toPaymentMethod),
    haulPosts: hydratedHaul,
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
    users: userRows.map((u) => ({
      ...toUserRecord(u),
      email: u.email,
      status: u.status,
      suspendedUntil: u.suspendedUntil ? iso(u.suspendedUntil) : undefined,
      moderationNote: u.moderationNote ?? undefined,
      isAdmin: u.isAdmin,
    })),
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
