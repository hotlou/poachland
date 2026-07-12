/**
 * Public profile data (server-only).
 *
 * Powers the SEO-facing pages (/u/[username], /traders, sitemap.xml) with
 * data that is safe to expose to signed-out visitors and crawlers: everything
 * a snapshot already publishes about a user, and NEVER the email or other
 * auth/private columns.
 */

import "server-only";

import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import type { Badge, HistoryEntry } from "../types";
import { getDb } from "./db";
import { users } from "./schema";

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
