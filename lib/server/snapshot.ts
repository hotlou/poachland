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

import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { sampleVisible, visibleSampleBatchIds } from "./sample-visibility";
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
  Partner,
  Rating,
  Report,
  Save,
  ThreadRecord,
  UserRecord,
} from "../types";
import { getDb } from "./db";
import { sweepExpiredDealsForViewer } from "./engine";
import {
  activity,
  blocks,
  deals,
  emailOutbox,
  haulComments,
  haulPosts,
  haulReactions,
  identities,
  isoPosts,
  listings,
  messages,
  notifications,
  offers,
  partners,
  paymentMethods,
  productEvents,
  ratings,
  reports,
  saves,
  savedSearches,
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
  type PartnerRow,
  type PaymentMethodRow,
  type RatingRow,
  type ReportRow,
  type SaveRow,
  type SavedSearchRow,
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
    sampleBatchId: row.sampleBatchId ?? undefined,
    managedByUserId: row.managedByUserId ?? undefined,
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
    sampleBatchId: row.sampleBatchId ?? undefined,
    hiddenAt: row.hiddenAt?.toISOString(),
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
    sampleBatchId: row.sampleBatchId ?? undefined,
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
    sampleBatchId: row.sampleBatchId ?? undefined,
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

function toIdentityRecord(row: IdentityRow, includeReviewerNote = false): IdentityRecord {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider,
    handle: row.handle,
    url: row.url ?? undefined,
    status: row.status,
    submittedAt: iso(row.submittedAt),
    verifiedAt: isoOpt(row.verifiedAt),
    reviewerNote: includeReviewerNote ? row.reviewerNote ?? undefined : undefined,
  };
}

function toPartner(row: PartnerRow): Partner {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    slug: row.slug,
    tagline: row.tagline,
    description: row.description,
    logo: row.logo,
    url: row.url,
    category: row.category,
    featured: row.featured,
    active: row.active,
    createdAt: iso(row.createdAt),
  };
}

function toHaulPostRecord(row: HaulPostRow): HaulPostRecord {
  return {
    id: row.id,
    sampleBatchId: row.sampleBatchId ?? undefined,
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
const BOOTSTRAP_USER_LIMIT = 200;
const BOOTSTRAP_LISTING_LIMIT = 120;
const BOOTSTRAP_ISO_LIMIT = 60;
const BOOTSTRAP_RATING_LIMIT = 200;
const BOOTSTRAP_IDENTITY_LIMIT = 200;
const BOOTSTRAP_HAUL_LIMIT = 20;
const BOOTSTRAP_DEAL_LIMIT = 100;
const BOOTSTRAP_THREAD_LIMIT = 100;

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
  const [
    recentUserRows,
    recentListingRows,
    recentIsoRows,
    recentRatingRows,
    activityRows,
    recentIdentityRows,
    recentHaulPostRows,
    partnerRows,
  ] = await Promise.all([
      db.select().from(users).where(sampleVisible(users.sampleBatchId)).orderBy(desc(users.memberSince), desc(users.id)).limit(BOOTSTRAP_USER_LIMIT),
      viewerId
        ? db
            .select()
            .from(listings)
            .where(and(or(ne(listings.status, "removed"), eq(listings.sellerId, viewerId)), isNull(listings.hiddenAt), sampleVisible(listings.sampleBatchId)))
            .orderBy(desc(listings.createdAt), desc(listings.id))
            .limit(BOOTSTRAP_LISTING_LIMIT)
        : db
            .select()
            .from(listings)
            .where(and(ne(listings.status, "removed"), isNull(listings.hiddenAt), sampleVisible(listings.sampleBatchId)))
            .orderBy(desc(listings.createdAt), desc(listings.id))
            .limit(BOOTSTRAP_LISTING_LIMIT),
      db.select().from(isoPosts).where(isNull(isoPosts.hiddenAt)).orderBy(desc(isoPosts.createdAt), desc(isoPosts.id)).limit(BOOTSTRAP_ISO_LIMIT),
      db.select().from(ratings).where(and(isNull(ratings.hiddenAt), sampleVisible(ratings.sampleBatchId))).orderBy(desc(ratings.createdAt), desc(ratings.id)).limit(BOOTSTRAP_RATING_LIMIT),
      db
        .select()
        .from(activity)
        .orderBy(desc(activity.createdAt), desc(activity.id))
        .limit(ACTIVITY_LIMIT),
      db
        .select()
        .from(identities)
        .where(
          viewerId
            ? or(eq(identities.status, "verified"), eq(identities.userId, viewerId))
            : eq(identities.status, "verified"),
        )
        .orderBy(desc(identities.submittedAt), desc(identities.id))
        .limit(BOOTSTRAP_IDENTITY_LIMIT),
      db.select().from(haulPosts).where(sampleVisible(haulPosts.sampleBatchId)).orderBy(desc(haulPosts.createdAt), desc(haulPosts.id)).limit(BOOTSTRAP_HAUL_LIMIT),
      db
        .select()
        .from(partners)
        .where(eq(partners.active, true))
        .orderBy(desc(partners.featured), asc(partners.sortOrder), asc(partners.createdAt)),
    ]);

  // Private collections (viewer-scoped). Signed-out viewers get empty ones.
  let dealRows: DealRow[] = [];
  let offerRows: OfferRow[] = [];
  let threadRows: ThreadRow[] = [];
  let messageRows: MessageRow[] = [];
  let notificationRows: NotificationRow[] = [];
  let saveRows: SaveRow[] = [];
  let savedSearchRows: SavedSearchRow[] = [];
  let reportRows: ReportRow[] = [];
  let blockRows: BlockRow[] = [];
  let paymentRows: PaymentMethodRow[] = [];

  if (viewerId) {
    const viewerDeals = or(eq(deals.proposerId, viewerId), eq(deals.ownerId, viewerId));
    const viewerThreads = sql`(${threads.participantIds}->>0 = ${viewerId} or ${threads.participantIds}->>1 = ${viewerId})`;
    [dealRows, threadRows, notificationRows, saveRows, reportRows, blockRows] =
      await Promise.all([
        db
          .select()
          .from(deals)
          .where(viewerDeals)
          .orderBy(desc(deals.updatedAt), desc(deals.id))
          .limit(BOOTSTRAP_DEAL_LIMIT),
        db
          .select()
          .from(threads)
          .where(viewerThreads)
          .orderBy(desc(threads.updatedAt), desc(threads.id))
          .limit(BOOTSTRAP_THREAD_LIMIT),
        db
          .select()
          .from(notifications)
          .where(eq(notifications.userId, viewerId))
          .orderBy(desc(notifications.createdAt), desc(notifications.id))
          .limit(50),
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
    const dealIds = dealRows.map((row) => row.id);
    const threadIds = threadRows.map((row) => row.id);
    [offerRows, messageRows] = await Promise.all([
      dealIds.length
        ? db.select().from(offers).where(inArray(offers.dealId, dealIds)).orderBy(asc(offers.dealId), asc(offers.position))
        : [],
      threadIds.length
        ? db.select().from(messages).where(inArray(messages.threadId, threadIds)).orderBy(desc(messages.createdAt), desc(messages.id)).limit(50)
        : [],
    ]);
    // Bounded queries read newest-first for efficient indexes; the legacy
    // snapshot contract remains chronological for the optimistic engine.
    dealRows.reverse();
    threadRows.reverse();
    messageRows.reverse();
    notificationRows.reverse();

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
    savedSearchRows = await db
      .select()
      .from(savedSearches)
      .where(eq(savedSearches.userId, viewerId))
      .orderBy(asc(savedSearches.createdAt), asc(savedSearches.id));
  }

  // Bootstrap carries a bounded discovery window plus every entity required
  // to render the viewer's private relationships. Screen feeds fetch their
  // own cursor pages; this payload is not a catalog export.
  const relevantUserIds = new Set<string>();
  if (viewerId) relevantUserIds.add(viewerId);
  for (const row of recentListingRows) relevantUserIds.add(row.sellerId);
  for (const row of recentIsoRows) relevantUserIds.add(row.userId);
  for (const row of recentRatingRows) { relevantUserIds.add(row.fromUserId); relevantUserIds.add(row.toUserId); }
  for (const row of recentIdentityRows) relevantUserIds.add(row.userId);
  for (const row of recentHaulPostRows) { relevantUserIds.add(row.proposerId); relevantUserIds.add(row.ownerId); }
  for (const row of activityRows) relevantUserIds.add(row.actorId);
  for (const row of dealRows) { relevantUserIds.add(row.proposerId); relevantUserIds.add(row.ownerId); }
  for (const row of threadRows) for (const id of row.participantIds) relevantUserIds.add(id);
  for (const row of messageRows) relevantUserIds.add(row.senderId);

  const knownUserIds = new Set(recentUserRows.map((row) => row.id));
  const missingUserIds = [...relevantUserIds].filter((id) => !knownUserIds.has(id));
  const relationshipUserRows = missingUserIds.length
    ? await db.select().from(users).where(inArray(users.id, missingUserIds))
    : [];
  let userRows = [...recentUserRows, ...relationshipUserRows];

  const relevantListingIds = new Set<string>();
  for (const row of dealRows) relevantListingIds.add(row.listingId);
  for (const row of offerRows) {
    for (const id of row.proposerListingIds) relevantListingIds.add(id);
    for (const id of row.ownerListingIds) relevantListingIds.add(id);
  }
  const privateDealListingIds = new Set(relevantListingIds);
  for (const row of saveRows) if (row.targetType === "listing") relevantListingIds.add(row.targetId);
  const viewerListingRows = viewerId
    ? await db.select().from(listings).where(eq(listings.sellerId, viewerId))
        .orderBy(desc(listings.createdAt), desc(listings.id)).limit(200)
    : [];
  const baseListingRows = [...recentListingRows];
  const baseListingIds = new Set(baseListingRows.map((row) => row.id));
  for (const row of viewerListingRows) if (!baseListingIds.has(row.id)) { baseListingRows.push(row); baseListingIds.add(row.id); }
  const knownListingIds = new Set(baseListingRows.map((row) => row.id));
  const missingListingIds = [...relevantListingIds].filter((id) => !knownListingIds.has(id));
  const relationshipListingRows = missingListingIds.length
    ? await db.select().from(listings).where(inArray(listings.id, missingListingIds))
    : [];
  const listingRows = [...baseListingRows, ...relationshipListingRows];

  const relevantIsoIds = saveRows.filter((row) => row.targetType === "iso").map((row) => row.targetId);
  const viewerIsoRows = viewerId
    ? await db.select().from(isoPosts).where(eq(isoPosts.userId, viewerId))
        .orderBy(desc(isoPosts.createdAt), desc(isoPosts.id)).limit(100)
    : [];
  const baseIsoRows = [...recentIsoRows];
  const baseIsoIds = new Set(baseIsoRows.map((row) => row.id));
  for (const row of viewerIsoRows) if (!baseIsoIds.has(row.id)) { baseIsoRows.push(row); baseIsoIds.add(row.id); }
  const knownIsoIds = new Set(baseIsoRows.map((row) => row.id));
  const missingIsoIds = relevantIsoIds.filter((id) => !knownIsoIds.has(id));
  const relationshipIsoRows = missingIsoIds.length
    ? await db.select().from(isoPosts).where(inArray(isoPosts.id, missingIsoIds))
    : [];
  const isoRows = [...baseIsoRows, ...relationshipIsoRows];
  const referencedOwnerIds = new Set([
    ...relationshipListingRows.map((row) => row.sellerId),
    ...relationshipIsoRows.map((row) => row.userId),
  ]);
  const hydratedUserIds = new Set(userRows.map((row) => row.id));
  const missingOwnerIds = [...referencedOwnerIds].filter((id) => !hydratedUserIds.has(id));
  if (missingOwnerIds.length) {
    userRows = [...userRows, ...await db.select().from(users).where(inArray(users.id, missingOwnerIds))];
  }
  const ratingRows = [...recentRatingRows];
  const identityRows = [...recentIdentityRows];
  const haulPostRows = [...recentHaulPostRows];

  const viewerRow = viewerId ? userRows.find((u) => u.id === viewerId) ?? null : null;
  const viewerIsAdmin = !!viewerRow?.isAdmin;
  const [referralResult] = viewerId
    ? await db.select({ value: sql<number>`count(*)::int` }).from(users).where(and(eq(users.referredBy, viewerId), isNull(users.sampleBatchId), isNull(users.managedByUserId)))
    : [{ value: 0 }];
  const referralCount = Number(referralResult?.value ?? 0);
  const viewerOnboarded = viewerRow?.onboardedAt?.getTime();
  const [memberResult] = viewerOnboarded
    ? await db.select({ value: sql<number>`count(*)::int` }).from(users)
        .where(sql`${users.sampleBatchId} is null and ${users.managedByUserId} is null and ${users.onboardedAt} is not null and ${users.onboardedAt} <= ${new Date(viewerOnboarded)}`)
    : [{ value: 0 }];
  const memberNumber = Number(memberResult?.value ?? 0);
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
  const visibleBatches = await visibleSampleBatchIds(db);
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
    if (u.id !== viewerId && u.sampleBatchId && !visibleBatches.has(u.sampleBatchId)) hidden.add(u.id);
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
    listings: listingRows.filter((l) =>
      (!l.hiddenAt || l.sellerId === viewerId || privateDealListingIds.has(l.id)) &&
      (l.sellerId === viewerId || !l.sampleBatchId || visibleBatches.has(l.sampleBatchId)) && userVisible(l.sellerId)
    ).map(toListingRecord),
    isoPosts: isoRows.filter((p) => !p.hiddenAt && !hidden.has(p.userId)).map(toISORecord),
    deals: dealRows.map((d) => toDealRecord(d, offersByDeal.get(d.id) ?? [])),
    threads: threadRows.map(toThreadRecord),
    messages: messageRows.map(toMessageRecord),
    ratings: ratingRows.filter((r) => !r.hiddenAt && userVisible(r.fromUserId) && userVisible(r.toUserId) && (!r.sampleBatchId || visibleBatches.has(r.sampleBatchId))).map(toRating),
    notifications: notificationRows.map(toNotification),
    saves: saveRows.map(toSave),
    savedSearches: savedSearchRows.map((row) => ({
      id: row.id,
      userId: row.userId,
      name: row.name,
      query: row.query ?? undefined,
      itemType: row.itemType ?? undefined,
      listingType: row.listingType ?? undefined,
      condition: row.condition ?? undefined,
      team: row.team ?? undefined,
      size: row.size ?? undefined,
      maxPrice: row.maxPrice ?? undefined,
      notificationsEnabled: row.notificationsEnabled,
      createdAt: iso(row.createdAt),
      lastMatchedAt: row.lastMatchedAt ? iso(row.lastMatchedAt) : undefined,
    })),
    reports: reportRows.map(toReport),
    blocks: blockRows.map(toBlock),
    activity: activityRows
      .filter((a) => !hidden.has(a.actorId))
      .map(toActivityEvent)
      .reverse(), // chronological
    identities: identityRows.map((row) => toIdentityRecord(row, row.userId === viewerId)),
    paymentMethods: paymentRows.map(toPaymentMethod),
    haulPosts: hydratedHaul,
    partners: partnerRows.map(toPartner),
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
    productEventCounts,
    [productAudience],
    [deliveryHealth],
  ] = await Promise.all([
    db.select().from(users).orderBy(asc(users.memberSince), asc(users.id)),
    db.select().from(reports).orderBy(desc(reports.createdAt), desc(reports.id)),
    db
      .select()
      .from(deals)
      .where(eq(deals.status, "disputed"))
      .orderBy(asc(deals.createdAt), asc(deals.id)),
    db.select().from(identities).orderBy(asc(identities.submittedAt), asc(identities.id)),
    db.select({ status: deals.status, n: sql<number>`count(*)::int` }).from(deals).where(isNull(deals.sampleBatchId)).groupBy(deals.status),
    db
      .select({ status: listings.status, n: sql<number>`count(*)::int` })
      .from(listings)
      .where(and(isNull(listings.sampleBatchId), isNull(listings.hiddenAt)))
      .groupBy(listings.status),
    db.select({ n: sql<number>`count(*)::int` }).from(isoPosts).where(eq(isoPosts.status, "active")),
    db.select({ n: sql<number>`count(*)::int` }).from(ratings).where(and(isNull(ratings.sampleBatchId), isNull(ratings.hiddenAt))),
    db.select({ n: sql<number>`count(*)::int` }).from(messages).where(sql`not exists (select 1 from users mu where mu.id = ${messages.senderId} and mu.sample_batch_id is not null)`),
    db
      .select({ name: productEvents.name, n: sql<number>`count(*)::int` })
      .from(productEvents)
      .where(sql`not exists (select 1 from users eu where eu.id = ${productEvents.userId} and eu.sample_batch_id is not null)`)
      .groupBy(productEvents.name),
    db.select({
      activatedListers: sql<number>`count(distinct ${productEvents.userId}) filter (where ${productEvents.name} = 'listing_created')::int`,
      activeUsers7d: sql<number>`count(distinct ${productEvents.userId}) filter (where ${productEvents.createdAt} >= now() - interval '7 days')::int`,
      activeUsers30d: sql<number>`count(distinct ${productEvents.userId}) filter (where ${productEvents.createdAt} >= now() - interval '30 days')::int`,
    }).from(productEvents).where(sql`not exists (select 1 from users eu where eu.id = ${productEvents.userId} and eu.sample_batch_id is not null)`),
    db.select({
      ready: sql<number>`count(*) filter (where ${emailOutbox.sentAt} is null and ${emailOutbox.deadLetteredAt} is null)::int`,
      dead: sql<number>`count(*) filter (where ${emailOutbox.deadLetteredAt} is not null)::int`,
      oldestReadyMinutes: sql<number>`coalesce(extract(epoch from (now() - min(${emailOutbox.createdAt}) filter (where ${emailOutbox.sentAt} is null and ${emailOutbox.deadLetteredAt} is null))) / 60, 0)::int`,
    }).from(emailOutbox),
  ]);

  const partnerRows = await db
    .select()
    .from(partners)
    .orderBy(desc(partners.featured), asc(partners.sortOrder), asc(partners.createdAt));

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
  const eventCount = (name: string) =>
    productEventCounts.find((row) => row.name === name)?.n ?? 0;

  const identityQueue = identityRows.filter(
    (i) => i.status === "pending" || i.status === "unverified",
  );
  const realUsers = userRows.filter((u) => !u.sampleBatchId && !u.managedByUserId && !u.deletedAt);
  const [sampleCounts] = await db.select({
    listings: sql<number>`(select count(*)::int from listings where sample_batch_id is not null)`,
    deals: sql<number>`(select count(*)::int from deals where sample_batch_id is not null)`,
  }).from(users).limit(1);
  const since = (days: number) => Date.now() - days * 86_400_000;

  return {
    reports: reportRows.map(toReport),
    disputedDeals: disputedRows.map((d) => toDealRecord(d, offersByDeal.get(d.id) ?? [])),
    identityQueue: identityQueue.map((row) => toIdentityRecord(row, true)),
    partners: partnerRows.map(toPartner),
    users: userRows.map((u) => ({
      ...toUserRecord(u),
      email: u.email,
      status: u.status,
      suspendedUntil: u.suspendedUntil ? iso(u.suspendedUntil) : undefined,
      moderationNote: u.moderationNote ?? undefined,
      isAdmin: u.isAdmin,
      lastActiveAt: u.lastActiveAt?.toISOString(),
      deletedAt: u.deletedAt?.toISOString(),
    })),
    stats: {
      samples: { users: userRows.filter((u) => !!u.sampleBatchId).length, listings: Number(sampleCounts?.listings ?? 0), deals: Number(sampleCounts?.deals ?? 0) },
      visits: {
        signedIn7d: realUsers.filter((u) => u.lastActiveAt && u.lastActiveAt.getTime() >= since(7)).length,
        signedIn30d: realUsers.filter((u) => u.lastActiveAt && u.lastActiveAt.getTime() >= since(30)).length,
        newMembers7d: realUsers.filter((u) => u.onboardedAt && u.onboardedAt.getTime() >= since(7)).length,
        newMembers30d: realUsers.filter((u) => u.onboardedAt && u.onboardedAt.getTime() >= since(30)).length,
      },
      users: realUsers.length,
      verifiedUsers: realUsers.filter((u) => u.isVerified).length,
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
      emailReady: deliveryHealth.ready,
      emailDeadLetters: deliveryHealth.dead,
      oldestReadyEmailMinutes: deliveryHealth.oldestReadyMinutes,
      oldestPendingReportHours: Math.max(
        0,
        Math.floor(
          (Date.now() - (reportRows
            .filter((row) => row.status === "pending")
            .reduce((oldest, row) => Math.min(oldest, row.createdAt.getTime()), Date.now()))) /
            3_600_000,
        ),
      ),
      acquisition: {
        referredMembers: realUsers.filter((user) => !!user.referredBy).length,
        directMembers: realUsers.filter((user) => !user.referredBy).length,
      },
      retention: {
        activeUsers7d: Number(productAudience?.activeUsers7d ?? 0),
        activeUsers30d: Number(productAudience?.activeUsers30d ?? 0),
      },
      funnel: {
        onboarded: eventCount("onboarding_completed"),
        activatedListers: Number(productAudience?.activatedListers ?? 0),
        listed: eventCount("listing_created"),
        offered: eventCount("offer_created"),
        accepted: eventCount("offer_accepted"),
        completed: eventCount("deal_completed"),
        disputed: eventCount("deal_disputed"),
      },
    },
  };
}
