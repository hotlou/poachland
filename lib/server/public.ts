/**
 * Public profile data (server-only).
 *
 * Powers the SEO-facing pages (/u/[username], /traders, sitemap.xml) with
 * data that is safe to expose to signed-out visitors and crawlers: everything
 * a snapshot already publishes about a user, and NEVER the email or other
 * auth/private columns.
 */

import "server-only";

import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import type { Badge, HaulComment, HaulPost, HaulReactionEmoji, HistoryEntry, User } from "../types";
import { getDb } from "./db";
import { haulComments, haulPosts, haulReactions, users } from "./schema";

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
    })
    .from(users)
    .where(eq(users.username, uname))
    .limit(1);

  const row = rows[0];
  if (!row?.username) return null;
  // Moderated accounts have no public presence.
  if (row.status !== "active") return null;

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
    .where(and(isNotNull(users.username), eq(users.status, "active")))
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
