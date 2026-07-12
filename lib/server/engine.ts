/**
 * Poachland server engine — the authoritative port of lib/engine.ts.
 *
 * Every op from lib/shared/ops.ts is implemented here with the exact same
 * guards, status transitions, notification/message/activity copy and
 * reputation rules as the client engine. Every mutation runs inside a
 * db.transaction; deal mutations lock the deal row (SELECT ... FOR UPDATE)
 * first, and acceptOffer locks + re-checks every listing changing hands.
 * (FOR UPDATE is a no-op on single-connection PGlite; it matters on Neon.)
 */

import "server-only";

import { and, asc, count, eq, inArray, ne, or, sql } from "drizzle-orm";
import { OFFER_EXPIRY_DAYS } from "../constants";
import { CLIENT_ID_PATTERN, type OpMap, type OpName, type OfferTerms } from "../shared/ops";
import type {
  BadgeType,
  DealKind,
  DealStatus,
  FulfillmentState,
  ISOStatus,
  MessageKind,
  RatingSummary,
  ReportTargetType,
} from "../types";
import { uid, type SessionUser } from "./auth";
import { getDb, type Db } from "./db";
import { insertNotifications, notify } from "./notify";
import {
  activity,
  blocks,
  deals,
  identities,
  isoPosts,
  listings,
  listingViews,
  messages,
  notifications,
  offers,
  paymentMethods,
  ratings,
  reports,
  saves,
  threads,
  users,
  type DealRow,
  type IdentityProvider,
  type ListingRow,
  type OfferRow,
  type RatingRow,
  type UserRow,
} from "./schema";

const DAY_MS = 86_400_000;

export type Res = { ok: true; value?: unknown } | { ok: false; error: string };

const ok = (value?: unknown): Res => ({ ok: true, value });
const err = (error: string): Res => ({ ok: false, error });

// ─── Dispatch ─────────────────────────────────────────────────────────────────

type Handlers = {
  [K in OpName]: (db: Db, user: SessionUser, input: OpMap[K]) => Promise<Res>;
};

export async function executeOp<K extends OpName>(
  user: SessionUser,
  op: K,
  input: OpMap[K],
): Promise<Res> {
  const handler = handlers[op] as
    | ((db: Db, user: SessionUser, input: OpMap[K]) => Promise<Res>)
    | undefined;
  if (!handler) return err("Unknown operation");
  if (op.startsWith("admin") && !user.isAdmin) return err("Moderators only");
  if (op !== "completeOnboarding" && !user.username)
    return err("Complete onboarding first");
  const db = await getDb();
  return handler(db, user, input);
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const isClientId = (id: unknown): id is string =>
  typeof id === "string" && CLIENT_ID_PATTERN.test(id);

function sanitizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");
}

function otherParty(deal: { proposerId: string; ownerId: string }, userId: string): string {
  return deal.proposerId === userId ? deal.ownerId : deal.proposerId;
}

async function getListingRow(tx: Db, id: string): Promise<ListingRow | undefined> {
  const [row] = await tx.select().from(listings).where(eq(listings.id, id)).limit(1);
  return row;
}

async function getUserRow(tx: Db, id: string): Promise<UserRow | undefined> {
  const [row] = await tx.select().from(users).where(eq(users.id, id)).limit(1);
  return row;
}

async function getDealForUpdate(tx: Db, id: string): Promise<DealRow | undefined> {
  const [row] = await tx.select().from(deals).where(eq(deals.id, id)).for("update");
  return row;
}

async function latestOffer(tx: Db, dealId: string): Promise<OfferRow | undefined> {
  const [row] = await tx
    .select()
    .from(offers)
    .where(eq(offers.dealId, dealId))
    .orderBy(sql`${offers.position} desc`)
    .limit(1);
  return row;
}

/** Latest offer per deal, from one IN query. */
async function latestOffersByDeal(tx: Db, dealIds: string[]): Promise<Map<string, OfferRow>> {
  const map = new Map<string, OfferRow>();
  if (dealIds.length === 0) return map;
  const rows = await tx
    .select()
    .from(offers)
    .where(inArray(offers.dealId, dealIds))
    .orderBy(asc(offers.dealId), asc(offers.position));
  for (const row of rows) map.set(row.dealId, row); // ascending → last wins
  return map;
}

async function isBlockedPair(tx: Db, a: string, b: string): Promise<boolean> {
  const rows = await tx
    .select({ blockerId: blocks.blockerId })
    .from(blocks)
    .where(
      or(
        and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)),
        and(eq(blocks.blockerId, b), eq(blocks.blockedId, a)),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * The server twin of PoachStore.appendMessage: inserts the message and bumps
 * the thread's updatedAt + the sender's lastRead to the message timestamp.
 */
async function appendMessage(
  tx: Db,
  threadId: string,
  senderId: string,
  kind: MessageKind,
  content: string,
  opts: { offerId?: string; createdAt?: Date; id?: string } = {},
): Promise<string> {
  const at = opts.createdAt ?? new Date();
  const id = opts.id ?? uid("m");
  await tx.insert(messages).values({
    id,
    threadId,
    senderId,
    kind,
    content,
    offerId: opts.offerId ?? null,
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

async function pushActivity(
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

// ─── Reputation (exact port of ratingSummary / recomputeReputation / awardBadges)

function ratingOverall(r: { communication: number; shippingSpeed: number; itemAccuracy: number }): number {
  return (r.communication + r.shippingSpeed + r.itemAccuracy) / 3;
}

function ratingSummaryFrom(rows: RatingRow[], user: UserRow): RatingSummary {
  const cnt = rows.length;
  const baselineCount = user.baselineRatingCount;
  const baselineSum = user.baselineRatingSum;
  const totalCount = cnt + baselineCount;
  // Baseline history only recorded overall scores, so each dimension is
  // seeded with the baseline mean — keeps every figure on the same count.
  const avg = (pick: (r: RatingRow) => number) =>
    totalCount === 0
      ? 0
      : (rows.reduce((s, r) => s + pick(r), 0) + baselineSum) / totalCount;
  const overall =
    totalCount === 0
      ? 0
      : (rows.reduce((s, r) => s + ratingOverall(r), 0) + baselineSum) / totalCount;
  return {
    count: totalCount,
    overall: Math.round(overall * 10) / 10,
    communication: Math.round(avg((r) => r.communication) * 10) / 10,
    shippingSpeed: Math.round(avg((r) => r.shippingSpeed) * 10) / 10,
    itemAccuracy: Math.round(avg((r) => r.itemAccuracy) * 10) / 10,
    wouldTradeAgainPct:
      cnt === 0 ? 100 : Math.round((rows.filter((r) => r.wouldTradeAgain).length / cnt) * 100),
  };
}

async function recomputeReputation(tx: Db, userId: string): Promise<void> {
  const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
  if (!user) return;
  const userRatings = await tx.select().from(ratings).where(eq(ratings.toUserId, userId));
  const summary = ratingSummaryFrom(userRatings, user);
  const [{ n: completedInvolving }] = await tx
    .select({ n: count() })
    .from(deals)
    .where(
      and(
        eq(deals.status, "completed"),
        or(eq(deals.proposerId, userId), eq(deals.ownerId, userId)),
      ),
    );
  const trustScore = summary.overall;
  const ratingsCount = summary.count;
  const tradesCompleted = user.baselineTrades + completedInvolving;

  // awardBadges — same checks, same order, same copy.
  const [{ n: listingCount }] = await tx
    .select({ n: count() })
    .from(listings)
    .where(eq(listings.sellerId, userId));
  const [{ n: givenAway }] = await tx
    .select({ n: count() })
    .from(deals)
    .where(and(eq(deals.status, "completed"), eq(deals.kind, "claim"), eq(deals.ownerId, userId)));

  const badges = [...user.badges];
  const notifs: Parameters<typeof insertNotifications>[1] = [];
  const has = (t: BadgeType) => badges.some((b) => b.type === t);
  const award = (type: BadgeType, label: string) => {
    if (has(type)) return;
    badges.push({ id: uid("b"), label, type });
    notifs.push({
      userId,
      type: "badge_earned",
      title: `Badge earned: ${label}`,
      body: "It now shows on your profile. Wear it well.",
      linkTo: "/app/profile",
    });
  };
  if (tradesCompleted >= 1) award("first-trade", "First Trade");
  if (tradesCompleted >= 25) award("veteran", "Veteran Trader");
  if (tradesCompleted >= 10 && trustScore >= 4.5 && ratingsCount >= 5)
    award("trusted", "Trusted Trader");
  if (listingCount >= 8) award("collector", "Collector");
  const shipRatings = userRatings.map((r) => r.shippingSpeed);
  if (
    shipRatings.length >= 5 &&
    shipRatings.reduce((a, b) => a + b, 0) / shipRatings.length >= 4.7
  )
    award("quick-shipper", "Quick Shipper");
  if (givenAway >= 3) award("generous", "Community Giver");

  await tx
    .update(users)
    .set({ trustScore, ratingsCount, tradesCompleted, badges })
    .where(eq(users.id, userId));
  await insertNotifications(tx, notifs);
}

// ─── Offers: build / describe / validate / expire / close ────────────────────

type OfferTermsClean = {
  proposerListingIds: string[];
  ownerListingIds: string[];
  cashFromProposer: number;
  cashFromOwner: number;
  note: string;
};

function cleanTerms(terms: OfferTerms): OfferTermsClean {
  return {
    proposerListingIds: Array.isArray(terms.proposerListingIds)
      ? terms.proposerListingIds.map(String)
      : [],
    ownerListingIds: Array.isArray(terms.ownerListingIds)
      ? terms.ownerListingIds.map(String)
      : [],
    cashFromProposer: Number(terms.cashFromProposer) || 0,
    cashFromOwner: Number(terms.cashFromOwner) || 0,
    note: typeof terms.note === "string" ? terms.note : "",
  };
}

function makeOfferValues(byUserId: string, terms: OfferTermsClean, now: Date) {
  return {
    id: uid("of"),
    byUserId,
    proposerListingIds: terms.proposerListingIds,
    ownerListingIds: terms.ownerListingIds,
    cashFromProposer: Math.max(0, Math.round(terms.cashFromProposer)),
    cashFromOwner: Math.max(0, Math.round(terms.cashFromOwner)),
    note: terms.note.slice(0, 500),
    createdAt: now,
    expiresAt: new Date(now.getTime() + OFFER_EXPIRY_DAYS * DAY_MS),
    status: "pending" as const,
  };
}

/** Human-readable summary of an offer — same copy as PoachStore.describeOffer. */
function describeOffer(
  kind: DealKind,
  offer: {
    proposerListingIds: string[];
    ownerListingIds: string[];
    cashFromProposer: number;
    cashFromOwner: number;
  },
  titles: Map<string, string>,
): string {
  const names = (ids: string[]) =>
    ids.map((id) => `"${titles.get(id) ?? "an item"}"`).join(" + ");
  const proposerSide: string[] = [];
  if (offer.proposerListingIds.length) proposerSide.push(names(offer.proposerListingIds));
  if (offer.cashFromProposer > 0) proposerSide.push(`$${offer.cashFromProposer}`);
  const ownerSide: string[] = [];
  if (offer.ownerListingIds.length) ownerSide.push(names(offer.ownerListingIds));
  if (offer.cashFromOwner > 0) ownerSide.push(`$${offer.cashFromOwner}`);
  if (kind === "claim") return `wants to claim ${ownerSide.join(" + ") || "the item"}`;
  if (kind === "buy")
    return `offers $${offer.cashFromProposer} for ${ownerSide.join(" + ") || "the item"}`;
  return `${proposerSide.join(" + ") || "nothing"} ⇄ ${ownerSide.join(" + ") || "nothing"}`;
}

/**
 * Validates both sides of an offer against ownership and availability
 * (same errors as PoachStore.validateOfferListings). Returns the fetched
 * listing rows for reuse (titles, locking already-done by caller if needed).
 */
async function validateOfferListings(
  tx: Db,
  terms: OfferTermsClean,
  proposerId: string,
  ownerId: string,
): Promise<{ error: string } | { rows: Map<string, ListingRow> }> {
  const ids = [...new Set([...terms.proposerListingIds, ...terms.ownerListingIds])];
  const rows = new Map<string, ListingRow>();
  if (ids.length > 0) {
    const fetched = await tx.select().from(listings).where(inArray(listings.id, ids));
    for (const row of fetched) rows.set(row.id, row);
  }
  for (const id of terms.proposerListingIds) {
    const l = rows.get(id);
    if (!l || l.sellerId !== proposerId) return { error: "You can only offer your own listings" };
    if (l.status !== "active") return { error: `"${l.title}" is not available to offer` };
  }
  for (const id of terms.ownerListingIds) {
    const l = rows.get(id);
    if (!l || l.sellerId !== ownerId)
      return { error: "Requested items must belong to the listing owner" };
    if (l.status !== "active") return { error: `"${l.title}" is not available` };
  }
  return { rows };
}

/**
 * Lazily expire an open deal whose pending offer is past its deadline.
 * Performs the expiry writes + notifications; returns true if it expired.
 * Callers commit the expiry by returning an error WITHOUT throwing (the
 * client engine commits before erroring, and we mirror that).
 */
async function expireOfferIfPast(tx: Db, deal: DealRow, offer: OfferRow | undefined): Promise<boolean> {
  if (deal.status !== "open" || !offer) return false;
  if (offer.status !== "pending" || offer.expiresAt.getTime() >= Date.now()) return false;
  const now = new Date();
  await tx.update(offers).set({ status: "expired" }).where(eq(offers.id, offer.id));
  await tx
    .update(deals)
    .set({ status: "expired", closedAt: now, updatedAt: now })
    .where(eq(deals.id, deal.id));
  const listing = await getListingRow(tx, deal.listingId);
  await insertNotifications(
    tx,
    [deal.proposerId, deal.ownerId].map((userId) => ({
      userId,
      type: "system" as const,
      title: "Offer expired",
      body: `An offer on "${listing?.title ?? "a listing"}" expired after ${OFFER_EXPIRY_DAYS} days without a response.`,
      linkTo: `/app/trades/${deal.id}`,
    })),
  );
  return true;
}

/**
 * Sweep the viewer's open deals for expired offers — called by buildSnapshot
 * before reading, so long-lived tabs see expirations without a mutation.
 */
export async function sweepExpiredDealsForViewer(db: Db, viewerId: string): Promise<void> {
  const open = await db
    .select()
    .from(deals)
    .where(
      and(
        eq(deals.status, "open"),
        or(eq(deals.proposerId, viewerId), eq(deals.ownerId, viewerId)),
      ),
    );
  if (open.length === 0) return;
  const latest = await latestOffersByDeal(db, open.map((d) => d.id));
  const stale = open.filter((d) => {
    const o = latest.get(d.id);
    return o && o.status === "pending" && o.expiresAt.getTime() < Date.now();
  });
  if (stale.length === 0) return;
  await db.transaction(async (tx) => {
    for (const d of stale) {
      const [locked] = await tx.select().from(deals).where(eq(deals.id, d.id)).for("update");
      if (!locked) continue;
      await expireOfferIfPast(tx, locked, await latestOffer(tx, locked.id));
    }
  });
}

/** Port of PoachStore.closeDeal: terminal status + latest-offer bookkeeping. */
async function closeDeal(
  tx: Db,
  deal: DealRow,
  latest: OfferRow | undefined,
  status: DealStatus,
  reason?: string,
): Promise<void> {
  const now = new Date();
  await tx
    .update(deals)
    .set({
      status,
      closedAt: now,
      updatedAt: now,
      ...(reason ? { declineReason: reason } : {}),
    })
    .where(eq(deals.id, deal.id));
  if (latest && latest.status === "pending") {
    const offerStatus =
      status === "declined"
        ? ("declined" as const)
        : status === "withdrawn"
          ? ("withdrawn" as const)
          : status === "expired"
            ? ("expired" as const)
            : ("superseded" as const);
    await tx.update(offers).set({ status: offerStatus }).where(eq(offers.id, latest.id));
  }
}

/** Release pending listings held by a deal's latest offer (cancel/dispute paths). */
async function releaseDealListings(tx: Db, latest: OfferRow | undefined): Promise<void> {
  if (!latest) return;
  const ids = [...latest.proposerListingIds, ...latest.ownerListingIds];
  if (ids.length === 0) return;
  await tx
    .update(listings)
    .set({ status: "active", updatedAt: new Date() })
    .where(and(inArray(listings.id, ids), eq(listings.status, "pending")));
}

// ─── ISO matching (port of listingMatchesISO / matchListingToISOs) ────────────

function listingMatchesISO(
  listing: { type: string; team: string },
  iso: { itemType: string; team: string | null; description: string },
): boolean {
  if (listing.type !== iso.itemType) return false;
  const team = listing.team.toLowerCase();
  if (iso.team && (team.includes(iso.team.toLowerCase()) || iso.team.toLowerCase().includes(team)))
    return true;
  return iso.description.toLowerCase().includes(team) && team.length > 2;
}

// ─── Listing removal (shared by removeListing / admin ops) ────────────────────

async function removeListingCore(
  tx: Db,
  id: string,
  actor: SessionUser,
  opts: { byAdmin?: boolean; reason?: string } = {},
): Promise<Res> {
  const [record] = await tx.select().from(listings).where(eq(listings.id, id)).for("update");
  if (!record) return err("Listing not found");
  if (!opts.byAdmin && record.sellerId !== actor.id)
    return err("Only the owner can remove a listing");
  if (record.status === "pending")
    return err("This listing is locked in an accepted deal. Cancel the deal first.");
  const now = new Date();
  await tx.update(listings).set({ status: "removed", updatedAt: now }).where(eq(listings.id, id));
  // Close out any open negotiations that involve it.
  const openDeals = await tx.select().from(deals).where(eq(deals.status, "open"));
  const latest = await latestOffersByDeal(tx, openDeals.map((d) => d.id));
  for (const deal of openDeals) {
    const offer = latest.get(deal.id);
    const involved =
      deal.listingId === id ||
      (offer?.proposerListingIds.includes(id) ?? false) ||
      (offer?.ownerListingIds.includes(id) ?? false);
    if (!involved) continue;
    await closeDeal(tx, deal, offer, "declined", "The item is no longer available.");
    const other = deal.proposerId === record.sellerId ? deal.ownerId : deal.proposerId;
    await notify(
      tx,
      other,
      "offer_rejected",
      "Deal closed",
      "An item in your negotiation was removed, so the deal was closed.",
      `/app/trades/${deal.id}`,
    );
  }
  if (opts.byAdmin) {
    await notify(
      tx,
      record.sellerId,
      "listing_removed",
      "Listing removed by moderators",
      opts.reason ?? `Your listing "${record.title}" was removed for violating community guidelines.`,
    );
  }
  return ok(null);
}

// ─── Deal opening (shared by proposeTrade / makeBuyOffer / claimListing) ──────

async function openDeal(
  db: Db,
  user: SessionUser,
  kind: DealKind,
  ids: { dealId: string; threadId: string },
  listingId: string,
  terms: OfferTermsClean,
): Promise<Res> {
  return db.transaction(async (tx) => {
    if (!isClientId(ids.dealId) || !isClientId(ids.threadId)) return err("Invalid id");
    const [dupDeal] = await tx
      .select({ id: deals.id })
      .from(deals)
      .where(eq(deals.id, ids.dealId))
      .limit(1);
    if (dupDeal) return err("Duplicate id");
    const [dupThread] = await tx
      .select({ id: threads.id })
      .from(threads)
      .where(eq(threads.id, ids.threadId))
      .limit(1);
    if (dupThread) return err("Duplicate id");

    const [listing] = await tx
      .select()
      .from(listings)
      .where(eq(listings.id, listingId))
      .for("update");
    if (!listing) return err("Listing not found");
    if (listing.sellerId === user.id) return err("You can't open a deal on your own listing");
    if (listing.status !== "active") return err("This listing is no longer available");
    if (await isBlockedPair(tx, user.id, listing.sellerId))
      return err("You can't trade with this user");
    const [existing] = await tx
      .select({ id: deals.id })
      .from(deals)
      .where(
        and(
          eq(deals.listingId, listingId),
          eq(deals.proposerId, user.id),
          inArray(deals.status, ["open", "accepted"]),
        ),
      )
      .limit(1);
    if (existing) return err("You already have an active deal on this listing");
    const validated = await validateOfferListings(tx, terms, user.id, listing.sellerId);
    if ("error" in validated) return err(validated.error);

    const now = new Date();
    const offer = makeOfferValues(user.id, terms, now);
    await tx.insert(threads).values({
      id: ids.threadId,
      participantIds: [user.id, listing.sellerId],
      listingId,
      dealId: ids.dealId,
      createdAt: now,
      updatedAt: now,
      lastRead: { [user.id]: now.toISOString() },
    });
    await tx.insert(deals).values({
      id: ids.dealId,
      kind,
      listingId,
      proposerId: user.id,
      ownerId: listing.sellerId,
      status: "open",
      threadId: ids.threadId,
      createdAt: now,
      updatedAt: now,
      fulfillment: {},
    });
    await tx.insert(offers).values({ ...offer, dealId: ids.dealId, position: 0 });

    const titles = new Map<string, string>([[listing.id, listing.title]]);
    for (const [lid, row] of validated.rows) titles.set(lid, row.title);
    const summary = describeOffer(kind, offer, titles);
    await appendMessage(tx, ids.threadId, user.id, "offer", summary, {
      offerId: offer.id,
      createdAt: now,
    });
    if (terms.note.trim()) {
      await appendMessage(tx, ids.threadId, user.id, "text", terms.note.trim(), {
        createdAt: new Date(now.getTime() + 1),
      });
    }
    const notifType =
      kind === "trade"
        ? ("trade_proposal" as const)
        : kind === "buy"
          ? ("buy_offer" as const)
          : ("claim_request" as const);
    const title =
      kind === "trade"
        ? "New trade proposal"
        : kind === "buy"
          ? "New offer"
          : "Someone wants to claim your item";
    await notify(
      tx,
      listing.sellerId,
      notifType,
      title,
      `${user.username} → "${listing.title}": ${summary}`,
      `/app/trades/${ids.dealId}`,
    );
    return ok(ids.dealId);
  });
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

const handlers: Handlers = {
  // ── Session / profile ──────────────────────────────────────────────────────

  async completeOnboarding(db, user, input) {
    return db.transaction(async (tx) => {
      const [me] = await tx.select().from(users).where(eq(users.id, user.id)).for("update");
      if (!me) return err("Not signed in");
      if (me.username || me.onboardedAt) return err("Already onboarded");
      const username = sanitizeUsername(String(input.username ?? ""));
      if (username.length < 3) return err("Username must be at least 3 characters");
      const [taken] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.username, username), ne(users.id, me.id)))
        .limit(1);
      if (taken) return err("That username is taken");
      if (!String(input.displayName ?? "").trim()) return err("Display name is required");
      const now = new Date();
      await tx
        .update(users)
        .set({
          username,
          displayName: String(input.displayName).trim(),
          avatar: input.avatar || "/placeholder-user.jpg",
          bio: input.bio?.trim() ?? "",
          location: String(input.location ?? "").trim(),
          favoriteTeams: Array.isArray(input.favoriteTeams)
            ? input.favoriteTeams.map(String)
            : [],
          onboardedAt: now,
        })
        .where(eq(users.id, me.id));
      await pushActivity(
        tx,
        "new_member",
        me.id,
        undefined,
        `${username} joined Poachland`,
        `/app/u/${username}`,
      );
      await notify(
        tx,
        me.id,
        "system",
        "Welcome to Poachland",
        "Post your first listing or ISO to start building your trade rep.",
        "/app/create",
      );
      return ok(me.id);
    });
  },

  async updateProfile(db, user, { patch }) {
    return db.transaction(async (tx) => {
      const [me] = await tx.select().from(users).where(eq(users.id, user.id)).for("update");
      if (!me) return err("Not signed in");
      const set: Partial<typeof users.$inferInsert> = {};
      if (patch.username !== undefined) {
        const username = sanitizeUsername(String(patch.username));
        if (username.length < 3) return err("Username must be at least 3 characters");
        const [taken] = await tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.username, username), ne(users.id, me.id)))
          .limit(1);
        if (taken) return err("That username is taken");
        set.username = username;
      }
      if (patch.displayName !== undefined) {
        if (!String(patch.displayName).trim()) return err("Display name is required");
        set.displayName = String(patch.displayName).trim();
      }
      if (patch.bio !== undefined) set.bio = String(patch.bio).slice(0, 500);
      if (patch.location !== undefined) set.location = String(patch.location);
      if (patch.favoriteTeams !== undefined)
        set.favoriteTeams = Array.isArray(patch.favoriteTeams)
          ? patch.favoriteTeams.map(String)
          : [];
      if (patch.avatar !== undefined && patch.avatar) set.avatar = String(patch.avatar);
      if (patch.history !== undefined) {
        if (!Array.isArray(patch.history)) return err("Invalid history");
        if (patch.history.length > 12) return err("History is capped at 12 entries");
        const kinds = new Set(["team", "tournament", "league"]);
        const cleaned = [];
        for (const entry of patch.history) {
          const name = String(entry?.name ?? "").trim();
          if (!name) return err("History entries need a name");
          if (name.length > 80) return err("History names are capped at 80 characters");
          if (!kinds.has(String(entry?.kind))) return err("Invalid history kind");
          cleaned.push({
            id: isClientId(String(entry?.id)) ? String(entry.id) : uid("h"),
            kind: entry.kind as "team" | "tournament" | "league",
            name,
            years: entry?.years ? String(entry.years).slice(0, 24) : undefined,
            note: entry?.note ? String(entry.note).slice(0, 140) : undefined,
          });
        }
        set.history = cleaned;
      }
      if (patch.gallery !== undefined) {
        if (!Array.isArray(patch.gallery)) return err("Invalid gallery");
        const photos = patch.gallery.slice(0, 4).map(String);
        if (photos.some((p) => p.length > 400_000)) return err("A gallery photo is too large");
        set.gallery = photos;
      }
      if (Object.keys(set).length > 0) {
        await tx.update(users).set(set).where(eq(users.id, me.id));
      }
      return ok(me.id);
    });
  },

  // ── Listings ───────────────────────────────────────────────────────────────

  async createListing(db, user, { id, input }) {
    return db.transaction(async (tx) => {
      if (!isClientId(id)) return err("Invalid id");
      const [dup] = await tx
        .select({ id: listings.id })
        .from(listings)
        .where(eq(listings.id, id))
        .limit(1);
      if (dup) return err("Duplicate id");
      if (!String(input.title ?? "").trim()) return err("Title is required");
      if (!String(input.team ?? "").trim()) return err("Team is required");
      if (!Array.isArray(input.photos) || input.photos.length === 0)
        return err("Add at least one photo");
      if (input.listingType === "sell" && !input.askingPrice)
        return err("Set an asking price for a sale listing");
      const now = new Date();
      const record = {
        id,
        sellerId: user.id,
        type: input.type,
        title: String(input.title).trim(),
        team: String(input.team).trim(),
        year: input.year?.trim() || null,
        division: input.division ?? null,
        level: input.level,
        size: input.size?.trim() || null,
        condition: input.condition,
        listingType: input.listingType,
        askingPrice: input.listingType === "free" ? null : input.askingPrice ?? null,
        tradeFor: input.tradeFor?.trim() || null,
        photos: input.photos.slice(0, 4).map(String),
        description: String(input.description ?? "").trim(),
        views: 0,
        saves: 0,
        createdAt: now,
        updatedAt: now,
        shippingPreference: input.shippingPreference,
        tags: (Array.isArray(input.tags) ? input.tags : [])
          .map((t) => String(t).trim().toLowerCase())
          .filter(Boolean),
        isRare: input.isRare ?? false,
        isFeatured: false,
        status: "active" as const,
      };
      await tx.insert(listings).values(record);
      await pushActivity(
        tx,
        "new_listing",
        user.id,
        record.id,
        `${user.username} listed "${record.title}"`,
        `/app/listings/${record.id}`,
      );
      // matchListingToISOs: tell hunters whose active ISO matches.
      const activeISOs = await tx
        .select()
        .from(isoPosts)
        .where(and(eq(isoPosts.status, "active"), ne(isoPosts.userId, user.id)));
      const isoNotifs: Parameters<typeof insertNotifications>[1] = [];
      for (const iso of activeISOs) {
        if (await isBlockedPair(tx, iso.userId, user.id)) continue;
        if (listingMatchesISO(record, iso)) {
          isoNotifs.push({
            userId: iso.userId,
            type: "iso_match",
            title: "ISO match found",
            body: `A new ${record.type} listing matches your wanted post: "${record.title}".`,
            linkTo: `/app/listings/${record.id}`,
          });
        }
      }
      await insertNotifications(tx, isoNotifs);
      await recomputeReputation(tx, user.id); // collector badge
      return ok(record.id);
    });
  },

  async updateListing(db, user, { id, patch }) {
    return db.transaction(async (tx) => {
      const [record] = await tx.select().from(listings).where(eq(listings.id, id)).for("update");
      if (!record) return err("Listing not found");
      if (record.sellerId !== user.id) return err("Only the owner can edit a listing");
      if (record.status !== "active") return err("Only active listings can be edited");
      const set: Partial<typeof listings.$inferInsert> = { updatedAt: new Date() };
      const p = patch as Record<string, unknown>;
      if ("type" in p) set.type = patch.type ?? record.type;
      if ("title" in p) set.title = patch.title?.trim() ?? record.title;
      if ("team" in p) set.team = patch.team ?? record.team;
      if ("year" in p) set.year = patch.year ?? null;
      if ("division" in p) set.division = patch.division ?? null;
      if ("level" in p) set.level = patch.level ?? record.level;
      if ("size" in p) set.size = patch.size ?? null;
      if ("condition" in p) set.condition = patch.condition ?? record.condition;
      if ("listingType" in p) set.listingType = patch.listingType ?? record.listingType;
      if ("askingPrice" in p) set.askingPrice = patch.askingPrice ?? null;
      if ("tradeFor" in p) set.tradeFor = patch.tradeFor ?? null;
      if ("photos" in p && Array.isArray(patch.photos))
        set.photos = patch.photos.slice(0, 4).map(String);
      if ("description" in p) set.description = patch.description ?? record.description;
      if ("shippingPreference" in p)
        set.shippingPreference = patch.shippingPreference ?? record.shippingPreference;
      if ("tags" in p && Array.isArray(patch.tags)) set.tags = patch.tags.map(String);
      if ("isRare" in p) set.isRare = patch.isRare ?? false;
      const finalListingType = set.listingType ?? record.listingType;
      if (finalListingType === "free") set.askingPrice = null;
      await tx.update(listings).set(set).where(eq(listings.id, id));
      return ok(id);
    });
  },

  async removeListing(db, user, { id }) {
    return db.transaction(async (tx) => removeListingCore(tx, id, user));
  },

  async markListingViewed(db, user, { id }) {
    return db.transaction(async (tx) => {
      const [record] = await tx
        .select({ id: listings.id, sellerId: listings.sellerId })
        .from(listings)
        .where(eq(listings.id, id))
        .limit(1);
      if (!record) return ok(null);
      if (record.sellerId === user.id) return ok(null); // own views don't count
      const inserted = await tx
        .insert(listingViews)
        .values({ listingId: id, viewerId: user.id, createdAt: new Date() })
        .onConflictDoNothing()
        .returning({ listingId: listingViews.listingId });
      if (inserted.length > 0) {
        await tx
          .update(listings)
          .set({ views: sql`${listings.views} + 1` })
          .where(eq(listings.id, id));
      }
      return ok(null);
    });
  },

  async toggleSave(db, user, { targetType, targetId }) {
    return db.transaction(async (tx) => {
      if (targetType !== "listing" && targetType !== "iso") return err("Invalid target");
      const [existing] = await tx
        .select()
        .from(saves)
        .where(
          and(
            eq(saves.userId, user.id),
            eq(saves.targetType, targetType),
            eq(saves.targetId, targetId),
          ),
        )
        .limit(1);
      if (existing) {
        await tx
          .delete(saves)
          .where(
            and(
              eq(saves.userId, user.id),
              eq(saves.targetType, targetType),
              eq(saves.targetId, targetId),
            ),
          );
        if (targetType === "listing") {
          await tx
            .update(listings)
            .set({ saves: sql`greatest(0, ${listings.saves} - 1)` })
            .where(eq(listings.id, targetId));
        } else {
          await tx
            .update(isoPosts)
            .set({ saves: sql`greatest(0, ${isoPosts.saves} - 1)` })
            .where(eq(isoPosts.id, targetId));
        }
        return ok(false);
      }
      const ownerId =
        targetType === "listing"
          ? (await getListingRow(tx, targetId))?.sellerId
          : (
              await tx
                .select({ userId: isoPosts.userId })
                .from(isoPosts)
                .where(eq(isoPosts.id, targetId))
                .limit(1)
            )[0]?.userId;
      if (ownerId === user.id) return err("It's already yours — no need to save it");
      await tx.insert(saves).values({
        userId: user.id,
        targetType,
        targetId,
        createdAt: new Date(),
      });
      if (targetType === "listing") {
        await tx
          .update(listings)
          .set({ saves: sql`${listings.saves} + 1` })
          .where(eq(listings.id, targetId));
      } else {
        await tx
          .update(isoPosts)
          .set({ saves: sql`${isoPosts.saves} + 1` })
          .where(eq(isoPosts.id, targetId));
      }
      return ok(true);
    });
  },

  // ── Wanted board ───────────────────────────────────────────────────────────

  async createISOPost(db, user, { id, input }) {
    return db.transaction(async (tx) => {
      if (!isClientId(id)) return err("Invalid id");
      const [dup] = await tx
        .select({ id: isoPosts.id })
        .from(isoPosts)
        .where(eq(isoPosts.id, id))
        .limit(1);
      if (dup) return err("Duplicate id");
      const description = String(input.description ?? "").trim();
      if (description.length < 10)
        return err("Describe what you're hunting (at least 10 characters)");
      const now = new Date();
      const record = {
        id,
        userId: user.id,
        itemType: input.itemType,
        description,
        team: input.team?.trim() || null,
        size: input.size?.trim() || null,
        maxPrice: input.maxPrice ?? null,
        createdAt: now,
        saves: 0,
        status: "active" as const,
      };
      await tx.insert(isoPosts).values(record);
      await pushActivity(
        tx,
        "new_iso",
        user.id,
        record.id,
        `${user.username} is hunting: ${description.slice(0, 60)}${description.length > 60 ? "…" : ""}`,
        "/app/wanted",
      );
      // Tell the poster about existing listings that look like matches.
      const candidates = await tx
        .select()
        .from(listings)
        .where(and(eq(listings.status, "active"), ne(listings.sellerId, user.id)))
        .orderBy(asc(listings.createdAt));
      const matches = candidates.filter((l) => listingMatchesISO(l, record));
      if (matches.length > 0) {
        await notify(
          tx,
          user.id,
          "iso_match",
          `${matches.length} current listing${matches.length > 1 ? "s" : ""} might match your hunt`,
          `Check out "${matches[0].title}"${matches.length > 1 ? " and more" : ""}.`,
          matches.length === 1
            ? `/app/listings/${matches[0].id}`
            : `/app/browse?q=${encodeURIComponent(record.team ?? "")}`,
        );
      }
      return ok(record.id);
    });
  },

  async updateISOStatus(db, user, { id, status }) {
    return db.transaction(async (tx) => {
      const valid: ISOStatus[] = ["active", "found", "closed"];
      if (!valid.includes(status)) return err("Invalid status");
      const [record] = await tx.select().from(isoPosts).where(eq(isoPosts.id, id)).for("update");
      if (!record) return err("Post not found");
      if (record.userId !== user.id) return err("Only the poster can update this");
      await tx.update(isoPosts).set({ status }).where(eq(isoPosts.id, id));
      return ok(null);
    });
  },

  // ── Deals ──────────────────────────────────────────────────────────────────

  async proposeTrade(db, user, input) {
    const offered = Array.isArray(input.offeredListingIds)
      ? input.offeredListingIds.map(String)
      : [];
    if (offered.length === 0) return err("Pick at least one of your items to offer");
    return openDeal(
      db,
      user,
      "trade",
      { dealId: input.dealId, threadId: input.threadId },
      input.listingId,
      cleanTerms({
        proposerListingIds: offered,
        ownerListingIds: [input.listingId],
        cashFromProposer: input.cashAdded ?? 0,
        cashFromOwner: 0,
        note: input.note ?? "",
      }),
    );
  },

  async makeBuyOffer(db, user, input) {
    if (!input.amount || input.amount <= 0) return err("Enter an offer amount");
    return openDeal(
      db,
      user,
      "buy",
      { dealId: input.dealId, threadId: input.threadId },
      input.listingId,
      cleanTerms({
        proposerListingIds: [],
        ownerListingIds: [input.listingId],
        cashFromProposer: input.amount,
        cashFromOwner: 0,
        note: input.note ?? "",
      }),
    );
  },

  async claimListing(db, user, input) {
    const listing = await getListingRow(db, input.listingId);
    if (listing && listing.listingType !== "free")
      return err("Only free listings can be claimed");
    return openDeal(
      db,
      user,
      "claim",
      { dealId: input.dealId, threadId: input.threadId },
      input.listingId,
      cleanTerms({
        proposerListingIds: [],
        ownerListingIds: [input.listingId],
        cashFromProposer: 0,
        cashFromOwner: 0,
        note: input.note ?? "",
      }),
    );
  },

  async counterOffer(db, user, { dealId, terms: rawTerms }) {
    return db.transaction(async (tx) => {
      const terms = cleanTerms(rawTerms);
      const deal = await getDealForUpdate(tx, dealId);
      if (!deal) return err("Deal not found");
      if (deal.status !== "open") return err("This deal is no longer open to counters");
      if (deal.proposerId !== user.id && deal.ownerId !== user.id) return err("Not your deal");
      if (await isBlockedPair(tx, user.id, otherParty(deal, user.id)))
        return err("You can't trade with this user");
      const current = await latestOffer(tx, deal.id);
      if (await expireOfferIfPast(tx, deal, current))
        return err("This offer expired before a response");
      if (!current) return err("Deal not found");
      if (current.byUserId === user.id)
        return err("Your offer is already on the table — wait for a response or withdraw it");
      if (
        terms.proposerListingIds.length === 0 &&
        terms.cashFromProposer <= 0 &&
        deal.kind !== "claim"
      )
        return err("A counter needs items or cash on the proposer side");
      const validated = await validateOfferListings(tx, terms, deal.proposerId, deal.ownerId);
      if ("error" in validated) return err(validated.error);

      const now = new Date();
      await tx.update(offers).set({ status: "superseded" }).where(eq(offers.id, current.id));
      const offer = makeOfferValues(user.id, terms, now);
      await tx.insert(offers).values({ ...offer, dealId: deal.id, position: current.position + 1 });
      await tx.update(deals).set({ updatedAt: now }).where(eq(deals.id, deal.id));

      const titles = new Map<string, string>();
      for (const [lid, row] of validated.rows) titles.set(lid, row.title);
      if (!titles.has(deal.listingId)) {
        const primary = await getListingRow(tx, deal.listingId);
        if (primary) titles.set(primary.id, primary.title);
      }
      const summary = describeOffer(deal.kind, offer, titles);
      await appendMessage(tx, deal.threadId, user.id, "offer", summary, {
        offerId: offer.id,
        createdAt: now,
      });
      if (terms.note.trim()) {
        await appendMessage(tx, deal.threadId, user.id, "text", terms.note.trim(), {
          createdAt: new Date(now.getTime() + 1),
        });
      }
      await notify(
        tx,
        otherParty(deal, user.id),
        "offer_countered",
        "Counter-offer received",
        `${user.username} countered: ${summary}`,
        `/app/trades/${deal.id}`,
      );
      return ok(offer.id);
    });
  },

  async acceptOffer(db, user, { dealId }) {
    return db.transaction(async (tx) => {
      const deal = await getDealForUpdate(tx, dealId);
      if (!deal) return err("Deal not found");
      if (deal.status !== "open") return err("This deal is not open");
      const offer = await latestOffer(tx, deal.id);
      if (!offer) return err("Deal not found");
      if (offer.byUserId === user.id) return err("You can't accept your own offer");
      if (deal.proposerId !== user.id && deal.ownerId !== user.id) return err("Not your deal");
      if (await isBlockedPair(tx, user.id, otherParty(deal, user.id)))
        return err("You can't trade with this user");
      if (await expireOfferIfPast(tx, deal, offer))
        return err("This offer expired before a response");

      // Everything changing hands must still be available — lock and re-check.
      const lockedIds = [...offer.proposerListingIds, ...offer.ownerListingIds];
      const lockedRows =
        lockedIds.length > 0
          ? await tx.select().from(listings).where(inArray(listings.id, lockedIds)).for("update")
          : [];
      const byId = new Map(lockedRows.map((l) => [l.id, l]));
      for (const id of lockedIds) {
        const l = byId.get(id);
        if (!l || l.status !== "active")
          return err(`"${l?.title ?? "An item"}" is no longer available`);
      }

      const now = new Date();
      await tx.update(offers).set({ status: "accepted" }).where(eq(offers.id, offer.id));
      await tx
        .update(deals)
        .set({ status: "accepted", acceptedAt: now, updatedAt: now })
        .where(eq(deals.id, deal.id));
      if (lockedIds.length > 0) {
        await tx
          .update(listings)
          .set({ status: "pending", updatedAt: now })
          .where(inArray(listings.id, lockedIds));
      }

      // Close competing open deals that involve any locked item.
      const openDeals = await tx
        .select()
        .from(deals)
        .where(and(eq(deals.status, "open"), ne(deals.id, deal.id)));
      const latest = await latestOffersByDeal(tx, openDeals.map((d) => d.id));
      for (const otherDeal of openDeals) {
        const o = latest.get(otherDeal.id);
        const overlaps =
          lockedIds.includes(otherDeal.listingId) ||
          (o?.proposerListingIds.some((id) => lockedIds.includes(id)) ?? false) ||
          (o?.ownerListingIds.some((id) => lockedIds.includes(id)) ?? false);
        if (!overlaps) continue;
        await closeDeal(tx, otherDeal, o, "declined", "The item went to another trade.");
        // Notify every party of the competing deal (the accepter may not be
        // one of them when the same item was offered in two negotiations).
        for (const partyId of [otherDeal.proposerId, otherDeal.ownerId]) {
          if (partyId === user.id) continue;
          await notify(
            tx,
            partyId,
            "offer_rejected",
            "Item no longer available",
            "An item in your negotiation was committed to another deal.",
            `/app/trades/${otherDeal.id}`,
          );
        }
      }

      await appendMessage(
        tx,
        deal.threadId,
        user.id,
        "system",
        `${user.username} accepted the offer. Deal agreed — arrange shipping and mark it complete when your end arrives.`,
      );
      await notify(
        tx,
        otherParty(deal, user.id),
        "offer_accepted",
        "Offer accepted 🤝",
        `${user.username} accepted your offer. Time to ship.`,
        `/app/trades/${deal.id}`,
      );
      return ok(deal.id);
    });
  },

  async declineOffer(db, user, { dealId, reason }) {
    return db.transaction(async (tx) => {
      const deal = await getDealForUpdate(tx, dealId);
      if (!deal) return err("Deal not found");
      if (deal.status !== "open") return err("This deal is not open");
      if (deal.proposerId !== user.id && deal.ownerId !== user.id) return err("Not your deal");
      const offer = await latestOffer(tx, deal.id);
      if (await expireOfferIfPast(tx, deal, offer))
        return err("This offer already expired — no need to decline");
      if (!offer) return err("Deal not found");
      if (offer.byUserId === user.id) return err("Use withdraw to pull your own offer");
      await tx.update(offers).set({ status: "declined" }).where(eq(offers.id, offer.id));
      await closeDeal(tx, deal, { ...offer, status: "declined" }, "declined", reason);
      await appendMessage(
        tx,
        deal.threadId,
        user.id,
        "system",
        `${user.username} declined the offer.${reason ? ` "${reason}"` : ""}`,
      );
      await notify(
        tx,
        otherParty(deal, user.id),
        "offer_rejected",
        "Offer declined",
        `${user.username} passed on your offer${reason ? `: "${reason}"` : "."}`,
        `/app/trades/${deal.id}`,
      );
      return ok(null);
    });
  },

  async withdrawOffer(db, user, { dealId }) {
    return db.transaction(async (tx) => {
      const deal = await getDealForUpdate(tx, dealId);
      if (!deal) return err("Deal not found");
      if (deal.status !== "open") return err("This deal is not open");
      const offer = await latestOffer(tx, deal.id);
      if (!offer || offer.byUserId !== user.id)
        return err("You can only withdraw your own offer");
      await tx.update(offers).set({ status: "withdrawn" }).where(eq(offers.id, offer.id));
      await closeDeal(tx, deal, { ...offer, status: "withdrawn" }, "withdrawn");
      await appendMessage(
        tx,
        deal.threadId,
        user.id,
        "system",
        `${user.username} withdrew their offer.`,
      );
      const listing = await getListingRow(tx, deal.listingId);
      await notify(
        tx,
        otherParty(deal, user.id),
        "offer_withdrawn",
        "Offer withdrawn",
        `${user.username} withdrew their offer on "${listing?.title ?? "a listing"}".`,
        `/app/trades/${deal.id}`,
      );
      return ok(null);
    });
  },

  async cancelDeal(db, user, { dealId, reason }) {
    return db.transaction(async (tx) => {
      const deal = await getDealForUpdate(tx, dealId);
      if (!deal) return err("Deal not found");
      if (deal.status !== "accepted") return err("Only accepted deals can be cancelled");
      if (deal.proposerId !== user.id && deal.ownerId !== user.id) return err("Not your deal");
      const offer = await latestOffer(tx, deal.id);
      await releaseDealListings(tx, offer);
      await closeDeal(tx, deal, offer, "cancelled", reason);
      await appendMessage(
        tx,
        deal.threadId,
        user.id,
        "system",
        `${user.username} cancelled the deal.${reason ? ` "${reason}"` : ""}`,
      );
      await notify(
        tx,
        otherParty(deal, user.id),
        "deal_cancelled",
        "Deal cancelled",
        `${user.username} backed out of your deal${reason ? `: "${reason}"` : "."}`,
        `/app/trades/${deal.id}`,
      );
      return ok(null);
    });
  },

  async markShipped(db, user, { dealId, tracking }) {
    return db.transaction(async (tx) => {
      const deal = await getDealForUpdate(tx, dealId);
      if (!deal) return err("Deal not found");
      if (deal.status !== "accepted") return err("The deal isn't in the shipping stage");
      if (deal.proposerId !== user.id && deal.ownerId !== user.id) return err("Not your deal");
      const now = new Date();
      const f: FulfillmentState = { ...(deal.fulfillment[user.id] ?? {}) };
      f.shippedAt = now.toISOString();
      if (tracking?.trim()) f.tracking = tracking.trim();
      const fulfillment = { ...deal.fulfillment, [user.id]: f };
      await tx.update(deals).set({ fulfillment, updatedAt: now }).where(eq(deals.id, deal.id));
      await appendMessage(
        tx,
        deal.threadId,
        user.id,
        "system",
        `${user.username} marked their end shipped${tracking ? ` — tracking ${tracking}` : ""}.`,
      );
      await notify(
        tx,
        otherParty(deal, user.id),
        "shipped",
        "Shipment on the way 📦",
        `${user.username} shipped their end of the deal${tracking ? ` (tracking ${tracking})` : ""}.`,
        `/app/trades/${deal.id}`,
      );
      return ok(null);
    });
  },

  async confirmComplete(db, user, { dealId }) {
    return db.transaction(async (tx) => {
      const deal = await getDealForUpdate(tx, dealId);
      if (!deal) return err("Deal not found");
      if (deal.status !== "accepted") return err("The deal isn't awaiting completion");
      if (deal.proposerId !== user.id && deal.ownerId !== user.id) return err("Not your deal");
      const f: FulfillmentState = { ...(deal.fulfillment[user.id] ?? {}) };
      if (f.receivedAt) return err("You already confirmed this deal");
      const now = new Date();
      f.receivedAt = now.toISOString();
      const fulfillment = { ...deal.fulfillment, [user.id]: f };
      const other = otherParty(deal, user.id);
      const bothConfirmed = !!fulfillment[other]?.receivedAt;
      if (!bothConfirmed) {
        await tx.update(deals).set({ fulfillment, updatedAt: now }).where(eq(deals.id, deal.id));
        await appendMessage(
          tx,
          deal.threadId,
          user.id,
          "system",
          `${user.username} confirmed their end is complete. Waiting on the other side.`,
        );
        await notify(
          tx,
          other,
          "deal_complete",
          "Almost done",
          `${user.username} confirmed the deal. Confirm your end to complete it and unlock ratings.`,
          `/app/trades/${deal.id}`,
        );
        return ok({ completed: false });
      }
      // Both sides confirmed — complete the deal.
      await tx
        .update(deals)
        .set({ fulfillment, status: "completed", completedAt: now, updatedAt: now })
        .where(eq(deals.id, deal.id));
      const offer = await latestOffer(tx, deal.id);
      if (offer) {
        if (offer.proposerListingIds.length > 0) {
          await tx
            .update(listings)
            .set({ status: "traded", updatedAt: now })
            .where(inArray(listings.id, offer.proposerListingIds));
        }
        if (offer.ownerListingIds.length > 0) {
          const ownerStatus =
            deal.kind === "buy" ? ("sold" as const) : deal.kind === "claim" ? ("claimed" as const) : ("traded" as const);
          await tx
            .update(listings)
            .set({ status: ownerStatus, updatedAt: now })
            .where(inArray(listings.id, offer.ownerListingIds));
        }
      }
      const listing = await getListingRow(tx, deal.listingId);
      await appendMessage(
        tx,
        deal.threadId,
        user.id,
        "system",
        "Deal complete 🎉 Both sides confirmed. Rate each other to build trust.",
      );
      for (const userId of [deal.proposerId, deal.ownerId]) {
        await recomputeReputation(tx, userId);
        await notify(
          tx,
          userId,
          "deal_complete",
          "Deal complete 🎉",
          `Your ${deal.kind === "claim" ? "claim" : deal.kind === "buy" ? "purchase" : "trade"} of "${listing?.title ?? "an item"}" is done. Leave a rating.`,
          `/app/trades/${deal.id}`,
        );
      }
      const proposer = await getUserRow(tx, deal.proposerId);
      const owner = await getUserRow(tx, deal.ownerId);
      await pushActivity(
        tx,
        "deal_completed",
        deal.proposerId,
        deal.id,
        `${proposer?.username} and ${owner?.username} completed a ${deal.kind === "claim" ? "handoff" : deal.kind === "buy" ? "sale" : "trade"}: "${listing?.title ?? ""}"`,
        `/app/listings/${deal.listingId}`,
      );
      return ok({ completed: true });
    });
  },

  async openDispute(db, user, { dealId, reason }) {
    return db.transaction(async (tx) => {
      const deal = await getDealForUpdate(tx, dealId);
      if (!deal) return err("Deal not found");
      if (deal.status !== "accepted") return err("Only accepted deals can be disputed");
      if (deal.proposerId !== user.id && deal.ownerId !== user.id) return err("Not your deal");
      if (!String(reason ?? "").trim()) return err("Describe the problem");
      const trimmed = String(reason).trim();
      const now = new Date();
      await tx
        .update(deals)
        .set({ status: "disputed", disputeReason: trimmed, updatedAt: now })
        .where(eq(deals.id, deal.id));
      await tx.insert(reports).values({
        id: uid("r"),
        reporterId: user.id,
        targetType: "deal",
        targetId: deal.id,
        reason: "Deal dispute",
        details: trimmed,
        status: "pending",
        createdAt: now,
      });
      await appendMessage(
        tx,
        deal.threadId,
        user.id,
        "system",
        `${user.username} opened a dispute: "${trimmed}". Moderators will review.`,
      );
      await notify(
        tx,
        otherParty(deal, user.id),
        "deal_disputed",
        "Dispute opened",
        `${user.username} reported a problem with your deal. Moderators will review.`,
        `/app/trades/${deal.id}`,
      );
      return ok(null);
    });
  },

  async rateDeal(db, user, { dealId, input }) {
    return db.transaction(async (tx) => {
      const deal = await getDealForUpdate(tx, dealId);
      if (!deal) return err("Deal not found");
      if (deal.status !== "completed")
        return err("Ratings unlock once both parties complete the deal");
      if (deal.proposerId !== user.id && deal.ownerId !== user.id) return err("Not your deal");
      const [already] = await tx
        .select({ id: ratings.id })
        .from(ratings)
        .where(and(eq(ratings.dealId, dealId), eq(ratings.fromUserId, user.id)))
        .limit(1);
      if (already) return err("You already rated this deal");
      const clamp = (n: number) => Math.min(5, Math.max(1, Math.round(Number(n) || 0)));
      const now = new Date();
      const rating = {
        id: uid("rt"),
        dealId,
        fromUserId: user.id,
        toUserId: otherParty(deal, user.id),
        communication: clamp(input.communication),
        shippingSpeed: clamp(input.shippingSpeed),
        itemAccuracy: clamp(input.itemAccuracy),
        wouldTradeAgain: !!input.wouldTradeAgain,
        comment: input.comment?.trim() || null,
        createdAt: now,
      };
      await tx.insert(ratings).values(rating);
      await recomputeReputation(tx, rating.toUserId);
      const overall = ratingOverall(rating);
      await notify(
        tx,
        rating.toUserId,
        "new_rating",
        `New rating from ${user.username}`,
        `${overall.toFixed(1)} stars.${rating.comment ? ` "${rating.comment}"` : ""}${rating.wouldTradeAgain ? " Would trade again." : ""}`,
        "/app/ratings",
      );
      const toUser = await getUserRow(tx, rating.toUserId);
      await pushActivity(
        tx,
        "new_rating",
        user.id,
        rating.toUserId,
        `${user.username} rated ${toUser?.username} ${overall.toFixed(1)}★`,
        `/app/u/${toUser?.username}`,
      );
      return ok(rating.id);
    });
  },

  // ── Messaging ──────────────────────────────────────────────────────────────

  async getOrCreateThread(db, user, { threadId, otherUserId, context: rawContext }) {
    const context = rawContext ?? {};
    return db.transaction(async (tx) => {
      if (otherUserId === user.id) return err("That's you");
      const other = await getUserRow(tx, otherUserId);
      if (!other) return err("User not found");
      if (await isBlockedPair(tx, user.id, otherUserId))
        return err("You can't message this user");
      const mine = await tx
        .select()
        .from(threads)
        .where(
          and(
            sql`${threads.dealId} is null`,
            sql`(${threads.participantIds}->>0 = ${user.id} or ${threads.participantIds}->>1 = ${user.id})`,
          ),
        )
        .orderBy(asc(threads.createdAt));
      const existing = mine.find(
        (t) =>
          t.participantIds.includes(otherUserId) &&
          (context.listingId ? t.listingId === context.listingId : true) &&
          (context.isoPostId ? t.isoPostId === context.isoPostId : true),
      );
      if (existing) return ok(existing.id);
      if (!isClientId(threadId)) return err("Invalid id");
      const [dup] = await tx
        .select({ id: threads.id })
        .from(threads)
        .where(eq(threads.id, threadId))
        .limit(1);
      if (dup) return err("Duplicate id");
      const now = new Date();
      await tx.insert(threads).values({
        id: threadId,
        participantIds: [user.id, otherUserId],
        listingId: context.listingId ?? null,
        isoPostId: context.isoPostId ?? null,
        dealId: null,
        createdAt: now,
        updatedAt: now,
        lastRead: { [user.id]: now.toISOString() },
      });
      return ok(threadId);
    });
  },

  async sendMessage(db, user, { id, threadId, content }) {
    return db.transaction(async (tx) => {
      if (!isClientId(id)) return err("Invalid id");
      const [dup] = await tx
        .select({ id: messages.id })
        .from(messages)
        .where(eq(messages.id, id))
        .limit(1);
      if (dup) return err("Duplicate id");
      const [thread] = await tx.select().from(threads).where(eq(threads.id, threadId)).limit(1);
      if (!thread || !thread.participantIds.includes(user.id)) return err("Thread not found");
      const trimmed = String(content ?? "").trim();
      if (!trimmed) return err("Message is empty");
      const other = thread.participantIds.find((p) => p !== user.id)!;
      if (await isBlockedPair(tx, user.id, other)) return err("You can't message this user");
      await appendMessage(tx, threadId, user.id, "text", trimmed.slice(0, 2000), { id });
      // Collapse per-thread message notifications so they don't stack up.
      await tx
        .delete(notifications)
        .where(
          and(
            eq(notifications.userId, other),
            eq(notifications.type, "new_message"),
            eq(notifications.linkTo, `/app/inbox/${threadId}`),
            eq(notifications.read, false),
          ),
        );
      await notify(
        tx,
        other,
        "new_message",
        `Message from ${user.username}`,
        trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed,
        `/app/inbox/${threadId}`,
      );
      return ok(id);
    });
  },

  async markThreadRead(db, user, { threadId }) {
    return db.transaction(async (tx) => {
      const [thread] = await tx.select().from(threads).where(eq(threads.id, threadId)).limit(1);
      if (!thread) return ok(null);
      const [last] = await tx
        .select({ createdAt: messages.createdAt })
        .from(messages)
        .where(eq(messages.threadId, threadId))
        .orderBy(sql`${messages.createdAt} desc`)
        .limit(1);
      const current = thread.lastRead[user.id] ?? "";
      const target = last?.createdAt.toISOString() ?? new Date().toISOString();
      if (current >= target) return ok(null);
      await tx
        .update(threads)
        .set({
          lastRead: sql`${threads.lastRead} || ${JSON.stringify({ [user.id]: target })}::jsonb`,
        })
        .where(eq(threads.id, threadId));
      return ok(null);
    });
  },

  // ── Notifications ──────────────────────────────────────────────────────────

  async markNotificationRead(db, user, { id }) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, user.id),
          eq(notifications.read, false),
        ),
      );
    return ok(null);
  },

  async markAllNotificationsRead(db, user) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, user.id), eq(notifications.read, false)));
    return ok(null);
  },

  // ── Moderation (user-level) ────────────────────────────────────────────────

  async reportTarget(db, user, { targetType, targetId, reason, details }) {
    const valid: ReportTargetType[] = ["listing", "user", "deal"];
    if (!valid.includes(targetType)) return err("Invalid target");
    if (!String(reason ?? "").trim()) return err("Pick a reason");
    await db.insert(reports).values({
      id: uid("r"),
      reporterId: user.id,
      targetType,
      targetId: String(targetId),
      reason: String(reason).trim(),
      details: details?.trim() || null,
      status: "pending",
      createdAt: new Date(),
    });
    return ok(null);
  },

  async blockUser(db, user, { targetId }) {
    return db.transaction(async (tx) => {
      if (targetId === user.id) return err("You can't block yourself");
      const [existing] = await tx
        .select({ blockerId: blocks.blockerId })
        .from(blocks)
        .where(and(eq(blocks.blockerId, user.id), eq(blocks.blockedId, targetId)))
        .limit(1);
      if (existing) return err("Already blocked");
      await tx.insert(blocks).values({
        blockerId: user.id,
        blockedId: targetId,
        createdAt: new Date(),
      });
      return ok(null);
    });
  },

  async unblockUser(db, user, { targetId }) {
    const deleted = await db
      .delete(blocks)
      .where(and(eq(blocks.blockerId, user.id), eq(blocks.blockedId, targetId)))
      .returning({ blockerId: blocks.blockerId });
    if (deleted.length === 0) return err("Not blocked");
    return ok(null);
  },

  // ── Identity scaffolding ───────────────────────────────────────────────────

  async linkIdentity(db, user, { id, provider, handle, url }) {
    return db.transaction(async (tx) => {
      if (!isClientId(id)) return err("Invalid id");
      const [dup] = await tx
        .select({ id: identities.id })
        .from(identities)
        .where(eq(identities.id, id))
        .limit(1);
      if (dup) return err("Duplicate id");
      const validProviders: IdentityProvider[] = ["instagram", "facebook", "usau", "other"];
      if (!validProviders.includes(provider)) return err("Invalid provider");
      const cleanHandle = String(handle ?? "").trim();
      if (!cleanHandle) return err("Enter a handle");
      if (cleanHandle.length > 80) return err("Handle is too long (80 characters max)");
      let cleanUrl: string | null = null;
      if (url !== undefined && String(url).trim()) {
        cleanUrl = String(url).trim();
        if (!/^https?:\/\//i.test(cleanUrl)) return err("Link must start with http:// or https://");
      }
      const mine = await tx
        .select({ id: identities.id, provider: identities.provider, handle: identities.handle })
        .from(identities)
        .where(eq(identities.userId, user.id));
      if (mine.length >= 5) return err("You can link up to 5 identities");
      if (mine.some((i) => i.provider === provider && i.handle === cleanHandle))
        return err("You already linked that handle");
      await tx.insert(identities).values({
        id,
        userId: user.id,
        provider,
        handle: cleanHandle,
        url: cleanUrl,
        status: "unverified",
        submittedAt: new Date(),
      });
      return ok(id);
    });
  },

  async removeIdentity(db, user, { id }) {
    const deleted = await db
      .delete(identities)
      .where(and(eq(identities.id, id), eq(identities.userId, user.id)))
      .returning({ id: identities.id });
    if (deleted.length === 0) return err("Identity not found");
    return ok(null);
  },

  // ── Payment handles (private) ──────────────────────────────────────────────

  async addPaymentMethod(db, user, { id, kind, label, value }) {
    return db.transaction(async (tx) => {
      if (!isClientId(id)) return err("Invalid id");
      const validKinds = ["venmo", "paypal", "cashapp", "zelle", "crypto", "other"];
      if (!validKinds.includes(kind)) return err("Invalid payment type");
      const cleanValue = String(value ?? "").trim();
      if (!cleanValue) return err("Enter the handle or address");
      if (cleanValue.length > 120) return err("Handle is too long (120 characters max)");
      const cleanLabel = label !== undefined && String(label).trim()
        ? String(label).trim().slice(0, 40)
        : null;
      const mine = await tx
        .select({ id: paymentMethods.id, kind: paymentMethods.kind, value: paymentMethods.value })
        .from(paymentMethods)
        .where(eq(paymentMethods.userId, user.id));
      if (mine.length >= 6) return err("You can save up to 6 payment handles");
      if (mine.some((m) => m.kind === kind && m.value === cleanValue))
        return err("You already saved that handle");
      await tx.insert(paymentMethods).values({
        id,
        userId: user.id,
        kind,
        label: cleanLabel,
        value: cleanValue,
        createdAt: new Date(),
      });
      return ok(id);
    });
  },

  async removePaymentMethod(db, user, { id }) {
    const deleted = await db
      .delete(paymentMethods)
      .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, user.id)))
      .returning({ id: paymentMethods.id });
    if (deleted.length === 0) return err("Payment handle not found");
    return ok(null);
  },

  // ── Deal proof (shipping photos / receipts) ────────────────────────────────

  async attachProof(db, user, { dealId, photos }) {
    return db.transaction(async (tx) => {
      const deal = await getDealForUpdate(tx, dealId);
      if (!deal) return err("Deal not found");
      if (deal.proposerId !== user.id && deal.ownerId !== user.id) return err("Not your deal");
      if (deal.status !== "accepted" && deal.status !== "disputed")
        return err("Proof can be added while a deal is in progress");
      if (!Array.isArray(photos) || photos.length === 0) return err("Add at least one photo");
      if (photos.some((p) => String(p).length > 400_000)) return err("A photo is too large");
      const f: FulfillmentState = { ...(deal.fulfillment[user.id] ?? {}) };
      const existing = f.proofPhotos ?? [];
      const merged = [...existing, ...photos.map(String)].slice(0, 4);
      if (existing.length >= 4) return err("Proof is capped at 4 photos");
      f.proofPhotos = merged;
      const now = new Date();
      const fulfillment = { ...deal.fulfillment, [user.id]: f };
      await tx.update(deals).set({ fulfillment, updatedAt: now }).where(eq(deals.id, deal.id));
      await appendMessage(
        tx,
        deal.threadId,
        user.id,
        "system",
        `${user.username} added ${photos.length} proof photo${photos.length > 1 ? "s" : ""} to the deal.`,
      );
      await notify(
        tx,
        otherParty(deal, user.id),
        "system",
        "Proof added",
        `${user.username} attached proof photos to your deal.`,
        `/app/trades/${deal.id}`,
      );
      return ok(null);
    });
  },

  // ── Admin ──────────────────────────────────────────────────────────────────

  async adminResolveReport(db, user, { reportId, action, note }) {
    return db.transaction(async (tx) => {
      const [report] = await tx.select().from(reports).where(eq(reports.id, reportId)).for("update");
      if (!report) return err("Report not found");
      if (report.status !== "pending") return err("Already handled");
      const now = new Date();
      if (action === "dismiss") {
        await tx
          .update(reports)
          .set({
            status: "dismissed",
            resolution: note ?? "Dismissed — no action needed",
            resolvedAt: now,
          })
          .where(eq(reports.id, reportId));
        return ok(null);
      }
      if (action === "remove-listing") {
        if (report.targetType !== "listing") return err("Not a listing report");
        const res = await removeListingCore(tx, report.targetId, user, {
          byAdmin: true,
          reason: note,
        });
        if (!res.ok) return res;
        await tx
          .update(reports)
          .set({ status: "resolved", resolution: note ?? "Listing removed", resolvedAt: now })
          .where(eq(reports.id, reportId));
        return ok(null);
      }
      if (action === "warn-user") {
        const targetUserId =
          report.targetType === "user"
            ? report.targetId
            : report.targetType === "listing"
              ? (await getListingRow(tx, report.targetId))?.sellerId
              : undefined;
        if (!targetUserId) return err("No user to warn for this report");
        await notify(
          tx,
          targetUserId,
          "system",
          "Community guidelines warning",
          note ?? "A moderator reviewed a report about your activity. Keep it clean out there.",
        );
        await tx
          .update(reports)
          .set({ status: "resolved", resolution: note ?? "User warned", resolvedAt: now })
          .where(eq(reports.id, reportId));
        return ok(null);
      }
      return err("Unknown action");
    });
  },

  async adminResolveDispute(db, user, { dealId, outcome, note }) {
    return db.transaction(async (tx) => {
      if (outcome !== "cancelled" && outcome !== "completed") return err("Unknown outcome");
      const deal = await getDealForUpdate(tx, dealId);
      if (!deal) return err("Deal not found");
      if (deal.status !== "disputed") return err("Deal is not disputed");
      const now = new Date();
      const offer = await latestOffer(tx, deal.id);
      if (outcome === "cancelled") {
        await releaseDealListings(tx, offer);
        await closeDeal(
          tx,
          deal,
          offer,
          "cancelled",
          note ?? "Cancelled by moderators after dispute review",
        );
      } else {
        const fulfillment: Record<string, FulfillmentState> = {
          ...deal.fulfillment,
          [deal.proposerId]: {
            ...deal.fulfillment[deal.proposerId],
            receivedAt: now.toISOString(),
          },
          [deal.ownerId]: {
            ...deal.fulfillment[deal.ownerId],
            receivedAt: now.toISOString(),
          },
        };
        await tx
          .update(deals)
          .set({ fulfillment, status: "completed", completedAt: now })
          .where(eq(deals.id, deal.id));
        if (offer) {
          for (const id of [...offer.proposerListingIds, ...offer.ownerListingIds]) {
            const l = await getListingRow(tx, id);
            if (l && l.status === "pending") {
              const status =
                deal.kind === "buy" && offer.ownerListingIds.includes(id)
                  ? ("sold" as const)
                  : deal.kind === "claim" && offer.ownerListingIds.includes(id)
                    ? ("claimed" as const)
                    : ("traded" as const);
              await tx.update(listings).set({ status }).where(eq(listings.id, id));
            }
          }
        }
        await recomputeReputation(tx, deal.proposerId);
        await recomputeReputation(tx, deal.ownerId);
      }
      await insertNotifications(
        tx,
        [deal.proposerId, deal.ownerId].map((userId) => ({
          userId,
          type: "system" as const,
          title: "Dispute resolved",
          body: `Moderators resolved the dispute: deal ${outcome}.${note ? ` ${note}` : ""}`,
          linkTo: `/app/trades/${deal.id}`,
        })),
      );
      await appendMessage(
        tx,
        deal.threadId,
        deal.ownerId,
        "system",
        `Moderators resolved the dispute — deal ${outcome}.`,
      );
      return ok(null);
    });
  },

  async adminSetUserVerified(db, user, { userId, verified }) {
    return db.transaction(async (tx) => {
      const target = await getUserRow(tx, userId);
      if (!target) return err("User not found");
      await tx.update(users).set({ isVerified: !!verified }).where(eq(users.id, userId));
      if (verified) {
        await notify(
          tx,
          userId,
          "system",
          "You're verified ✓",
          "Your account passed identity review.",
        );
      }
      return ok(null);
    });
  },

  async adminSetListingFeatured(db, user, { id, featured }) {
    return db.transaction(async (tx) => {
      const record = await getListingRow(tx, id);
      if (!record) return err("Listing not found");
      await tx.update(listings).set({ isFeatured: !!featured }).where(eq(listings.id, id));
      return ok(null);
    });
  },

  async adminRemoveListing(db, user, { id, reason }) {
    return db.transaction(async (tx) =>
      removeListingCore(tx, id, user, { byAdmin: true, reason }),
    );
  },

  async adminReviewIdentity(db, user, { identityId, status, note }) {
    return db.transaction(async (tx) => {
      if (status !== "verified" && status !== "rejected" && status !== "pending")
        return err("Invalid status");
      const [identity] = await tx
        .select()
        .from(identities)
        .where(eq(identities.id, identityId))
        .for("update");
      if (!identity) return err("Identity not found");
      const now = new Date();
      await tx
        .update(identities)
        .set({
          status,
          verifiedAt: status === "verified" ? now : null,
          reviewerNote: note?.trim() || null,
        })
        .where(eq(identities.id, identityId));
      if (status === "verified") {
        await notify(
          tx,
          identity.userId,
          "system",
          "Identity verified ✓",
          `Your ${identity.provider} handle now shows verified on your profile.`,
          "/app/profile",
        );
      } else if (status === "rejected") {
        await notify(
          tx,
          identity.userId,
          "system",
          "Identity review update",
          `Your ${identity.provider} handle could not be verified.${note?.trim() ? ` ${note.trim()}` : ""}`,
          "/app/profile",
        );
      }
      return ok(null);
    });
  },
};
