/**
 * Public profile data (server-only).
 *
 * Powers the SEO-facing pages (/u/[username], /traders, sitemap.xml) with
 * data that is safe to expose to signed-out visitors and crawlers: everything
 * a snapshot already publishes about a user, and NEVER the email or other
 * auth/private columns.
 */

import "server-only";

import { and, asc, desc, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import type {
  Badge,
  Condition,
  Division,
  HaulComment,
  HaulPost,
  HaulReactionEmoji,
  HistoryEntry,
  ItemType,
  Level,
  ListingStatus,
  ListingType,
  Partner,
  PartnerKind,
  ShippingPreference,
  User,
} from "../types";
import { getDb } from "./db";
import { haulComments, haulPosts, haulReactions, listings, partners, users } from "./schema";

export interface PublicProfile {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  location: string;
  favoriteTeams: string[];
  history: HistoryEntry[];
  gallery: string[];
  trustScore: number;
  ratingsCount: number;
  tradesCompleted: number;
  isVerified: boolean;
  /** ISO timestamp. */
  memberSince: string;
  badges: Badge[];
}

/**
 * A single onboarded user's public profile by username (case-insensitive —
 * usernames are stored lowercased). Returns null for unknown usernames and
 * for accounts that haven't finished onboarding. No email, ever.
 */
export async function getPublicProfile(
  username: string,
): Promise<PublicProfile | null> {
  const uname = username.trim().toLowerCase();
  if (!uname) return null;

  const db = await getDb();
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatar: users.avatar,
      bio: users.bio,
      location: users.location,
      favoriteTeams: users.favoriteTeams,
      history: users.history,
      gallery: users.gallery,
      trustScore: users.trustScore,
      ratingsCount: users.ratingsCount,
      tradesCompleted: users.tradesCompleted,
      isVerified: users.isVerified,
      memberSince: users.memberSince,
      badges: users.badges,
      status: users.status,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.username, uname))
    .limit(1);

  const row = rows[0];
  if (!row?.username) return null;
  // Moderated or deleted accounts have no public presence.
  if (row.status !== "active" || row.deletedAt) return null;

  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    avatar: row.avatar,
    bio: row.bio,
    location: row.location,
    favoriteTeams: row.favoriteTeams,
    history: row.history,
    gallery: row.gallery,
    trustScore: row.trustScore,
    ratingsCount: row.ratingsCount,
    tradesCompleted: row.tradesCompleted,
    isVerified: row.isVerified,
    memberSince: row.memberSince.toISOString(),
    badges: row.badges,
  };
}

export interface PublicUsernameEntry {
  username: string;
  /** Best-available "last updated" signal for the sitemap. */
  updatedAt: Date;
}

/**
 * Usernames of every onboarded user (most-traded first), for the sitemap.
 * The users table has no updated_at column, so onboardedAt (falling back to
 * memberSince) stands in as the freshness signal.
 */
export async function listPublicUsernames(
  limit = 500,
): Promise<PublicUsernameEntry[]> {
  const db = await getDb();
  const rows = await db
    .select({
      username: users.username,
      memberSince: users.memberSince,
      onboardedAt: users.onboardedAt,
    })
    .from(users)
    .where(
      and(isNotNull(users.username), eq(users.status, "active"), isNull(users.deletedAt)),
    )
    .orderBy(desc(users.tradesCompleted), asc(users.memberSince), asc(users.id))
    .limit(limit);

  return rows
    .filter((r): r is typeof r & { username: string } => r.username !== null)
    .map((r) => ({
      username: r.username,
      updatedAt: r.onboardedAt ?? r.memberSince,
    }));
}

// ─── The Haul (public wall) ──────────────────────────────────────────────────

const publicUserColumns = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  avatar: users.avatar,
  bio: users.bio,
  location: users.location,
  favoriteTeams: users.favoriteTeams,
  history: users.history,
  gallery: users.gallery,
  memberSince: users.memberSince,
  isVerified: users.isVerified,
  badges: users.badges,
  baselineTrades: users.baselineTrades,
  baselineRatingCount: users.baselineRatingCount,
  baselineRatingSum: users.baselineRatingSum,
  trustScore: users.trustScore,
  ratingsCount: users.ratingsCount,
  tradesCompleted: users.tradesCompleted,
  status: users.status,
};

/**
 * The public wall of shared completed trades, newest first — safe for
 * signed-out visitors and crawlers. Hidden posts and posts involving a
 * moderated (non-active) trader are dropped; so are comments from moderated
 * authors. No viewer context, so `myReaction` is always undefined.
 */
export async function getPublicHaul(limit = 30): Promise<HaulPost[]> {
  const db = await getDb();
  const postRows = await db
    .select()
    .from(haulPosts)
    .where(eq(haulPosts.hidden, false))
    .orderBy(desc(haulPosts.createdAt), desc(haulPosts.id))
    .limit(limit);
  if (postRows.length === 0) return [];

  const ids = postRows.map((p) => p.id);
  const [reactionRows, commentRows] = await Promise.all([
    db.select().from(haulReactions).where(inArray(haulReactions.haulId, ids)),
    db
      .select()
      .from(haulComments)
      .where(and(inArray(haulComments.haulId, ids), eq(haulComments.hidden, false)))
      .orderBy(asc(haulComments.createdAt), asc(haulComments.id)),
  ]);

  const userIds = new Set<string>();
  for (const p of postRows) {
    userIds.add(p.proposerId);
    userIds.add(p.ownerId);
  }
  for (const c of commentRows) userIds.add(c.userId);

  const userRows = userIds.size
    ? await db.select(publicUserColumns).from(users).where(inArray(users.id, [...userIds]))
    : [];
  const activeUsers = new Map<string, User>();
  for (const u of userRows) {
    if (u.status !== "active" || !u.username) continue;
    activeUsers.set(u.id, {
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatar: u.avatar,
      bio: u.bio,
      location: u.location,
      favoriteTeams: u.favoriteTeams,
      history: u.history,
      gallery: u.gallery,
      memberSince: u.memberSince.toISOString(),
      isVerified: u.isVerified,
      badges: u.badges,
      baselineTrades: u.baselineTrades,
      baselineRatingCount: u.baselineRatingCount,
      baselineRatingSum: u.baselineRatingSum,
      trustScore: u.trustScore,
      ratingsCount: u.ratingsCount,
      tradesCompleted: u.tradesCompleted,
    });
  }

  const countsByHaul = new Map<string, Partial<Record<HaulReactionEmoji, number>>>();
  for (const r of reactionRows) {
    const c = countsByHaul.get(r.haulId) ?? {};
    c[r.emoji] = (c[r.emoji] ?? 0) + 1;
    countsByHaul.set(r.haulId, c);
  }

  const commentsByHaul = new Map<string, HaulComment[]>();
  for (const c of commentRows) {
    const author = activeUsers.get(c.userId);
    if (!author) continue;
    const list = commentsByHaul.get(c.haulId) ?? [];
    list.push({
      id: c.id,
      haulId: c.haulId,
      userId: c.userId,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      hidden: false,
      user: author,
    });
    commentsByHaul.set(c.haulId, list);
  }

  return postRows
    .filter((p) => activeUsers.has(p.proposerId) && activeUsers.has(p.ownerId))
    .map((p) => {
      const counts = countsByHaul.get(p.id) ?? {};
      const total = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);
      const comments = commentsByHaul.get(p.id) ?? [];
      return {
        id: p.id,
        dealId: p.dealId,
        kind: p.kind,
        proposerId: p.proposerId,
        ownerId: p.ownerId,
        sharedBy: p.sharedBy,
        proposerSide: p.proposerSide,
        ownerSide: p.ownerSide,
        note: p.note ?? undefined,
        commentsEnabled: p.commentsEnabled,
        hidden: false,
        hiddenBy: p.hiddenBy ?? undefined,
        createdAt: p.createdAt.toISOString(),
        proposer: activeUsers.get(p.proposerId)!,
        owner: activeUsers.get(p.ownerId)!,
        reactionCounts: counts,
        totalReactions: total,
        myReaction: undefined,
        comments,
        commentCount: comments.length,
      };
    });
}

// ─── Public listing pages ────────────────────────────────────────────────────

export interface PublicListing {
  id: string;
  sellerId: string;
  type: ItemType;
  title: string;
  team: string;
  year?: string;
  division?: Division;
  level: Level;
  size?: string;
  condition: Condition;
  listingType: ListingType;
  askingPrice?: number;
  tradeFor?: string;
  photos: string[];
  description: string;
  shippingPreference: ShippingPreference;
  tags: string[];
  status: ListingStatus;
  createdAt: string;
  seller: {
    username: string;
    displayName: string;
    avatar: string;
    location: string;
    trustScore: number;
    tradesCompleted: number;
    isVerified: boolean;
  };
}

/**
 * A single listing for its public, shareable page — safe for signed-out
 * visitors and crawlers. Returns null for unknown/removed listings and for
 * listings whose seller is moderated (not active). No private data.
 */
export async function getPublicListing(id: string): Promise<PublicListing | null> {
  if (!id) return null;
  const db = await getDb();
  const [row] = await db
    .select({
      l: listings,
      username: users.username,
      displayName: users.displayName,
      avatar: users.avatar,
      location: users.location,
      trustScore: users.trustScore,
      tradesCompleted: users.tradesCompleted,
      isVerified: users.isVerified,
      sellerStatus: users.status,
      sellerDeletedAt: users.deletedAt,
    })
    .from(listings)
    .innerJoin(users, eq(listings.sellerId, users.id))
    .where(eq(listings.id, id))
    .limit(1);

  if (!row) return null;
  const l = row.l;
  if (l.status === "removed") return null;
  if (row.sellerStatus !== "active" || !row.username || row.sellerDeletedAt) return null;

  return {
    id: l.id,
    sellerId: l.sellerId,
    type: l.type,
    title: l.title,
    team: l.team,
    year: l.year ?? undefined,
    division: l.division ?? undefined,
    level: l.level,
    size: l.size ?? undefined,
    condition: l.condition,
    listingType: l.listingType,
    askingPrice: l.askingPrice ?? undefined,
    tradeFor: l.tradeFor ?? undefined,
    photos: l.photos,
    description: l.description,
    shippingPreference: l.shippingPreference,
    tags: l.tags,
    status: l.status,
    createdAt: l.createdAt.toISOString(),
    seller: {
      username: row.username,
      displayName: row.displayName,
      avatar: row.avatar,
      location: row.location,
      trustScore: row.trustScore,
      tradesCompleted: row.tradesCompleted,
      isVerified: row.isVerified,
    },
  };
}

/** Non-removed listings by active sellers (newest first), for the sitemap. */
export async function listPublicListingIds(
  limit = 1000,
): Promise<{ id: string; updatedAt: Date }[]> {
  const db = await getDb();
  const rows = await db
    .select({ id: listings.id, updatedAt: listings.updatedAt })
    .from(listings)
    .innerJoin(users, eq(listings.sellerId, users.id))
    .where(
      and(ne(listings.status, "removed"), eq(users.status, "active"), isNull(users.deletedAt)),
    )
    .orderBy(desc(listings.createdAt))
    .limit(limit);
  return rows;
}

// ─── Sponsors & vendors ──────────────────────────────────────────────────────

function toPublicPartner(row: typeof partners.$inferSelect): Partner {
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
    createdAt: row.createdAt.toISOString(),
  };
}

/** Active partners (optionally filtered by kind), featured first. Public. */
export async function getPublicPartners(kind?: PartnerKind): Promise<Partner[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(partners)
    .where(kind ? and(eq(partners.active, true), eq(partners.kind, kind)) : eq(partners.active, true))
    .orderBy(desc(partners.featured), asc(partners.sortOrder), asc(partners.createdAt));
  return rows.map(toPublicPartner);
}

/** A single active partner by slug, for /vendors/[slug]. Null when unknown. */
export async function getPublicPartner(slug: string): Promise<Partner | null> {
  const s = slug.trim().toLowerCase();
  if (!s) return null;
  const db = await getDb();
  const [row] = await db
    .select()
    .from(partners)
    .where(and(eq(partners.slug, s), eq(partners.active, true)))
    .limit(1);
  return row ? toPublicPartner(row) : null;
}
