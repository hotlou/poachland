/**
 * The Poachland badge catalog — the single source of truth for every badge:
 * its label, emoji, meaning, category, and tier. Both engines award from the
 * same `qualifyingBadges` function so the client (optimistic) and server
 * (authoritative) never disagree.
 *
 * Two kinds of badge:
 *  - criteria badges are recomputed from a user's stats (`qualifyingBadges`),
 *  - event badges are granted at a specific moment (founding at onboarding,
 *    verified on identity review, show-off/crowd-pleaser/heist-legend on Haul
 *    activity, connector on a successful referral) and are NOT in the qualifier.
 */

import type { BadgeType } from "./types";

export type BadgeCategory =
  | "trading"
  | "trust"
  | "collecting"
  | "generosity"
  | "community"
  | "identity"
  | "founder";

export type BadgeTier = "bronze" | "silver" | "gold" | "special";

export interface BadgeDef {
  type: BadgeType;
  label: string;
  emoji: string;
  description: string;
  category: BadgeCategory;
  tier: BadgeTier;
  /** True for badges granted at an event rather than recomputed from stats. */
  event?: boolean;
}

export const BADGE_CATALOG: BadgeDef[] = [
  // ── Trading milestones ──
  { type: "first-trade", label: "First Trade", emoji: "🤝", category: "trading", tier: "bronze",
    description: "Closed your first deal." },
  { type: "regular", label: "Regular", emoji: "🔁", category: "trading", tier: "bronze",
    description: "Completed 5 deals." },
  { type: "veteran", label: "Veteran Trader", emoji: "🎖️", category: "trading", tier: "silver",
    description: "Completed 25 deals." },
  { type: "centurion", label: "Centurion", emoji: "💯", category: "trading", tier: "gold",
    description: "Completed 100 deals. A Poachland institution." },
  // ── Trust & quality ──
  { type: "trusted", label: "Trusted Trader", emoji: "⭐", category: "trust", tier: "gold",
    description: "10+ deals at a 4.5★+ trust score across 5+ ratings." },
  { type: "flawless", label: "Flawless", emoji: "✨", category: "trust", tier: "gold",
    description: "8+ ratings received — every single one a perfect 5 stars." },
  { type: "quick-shipper", label: "Quick Shipper", emoji: "📦", category: "trust", tier: "silver",
    description: "Ships fast: 4.7★+ on shipping over 5+ ratings." },
  // ── Collecting ──
  { type: "collector", label: "Collector", emoji: "🧢", category: "collecting", tier: "bronze",
    description: "Posted 8+ listings." },
  { type: "curator", label: "Curator", emoji: "🗃️", category: "collecting", tier: "silver",
    description: "Posted 25+ listings. A serious crate." },
  // ── Generosity ──
  { type: "generous", label: "Community Giver", emoji: "🎁", category: "generosity", tier: "silver",
    description: "Gave away 3+ items for free." },
  { type: "philanthropist", label: "Philanthropist", emoji: "💚", category: "generosity", tier: "gold",
    description: "Gave away 10+ items for free. A total mensch." },
  // ── Community ──
  { type: "hunter", label: "Hunter", emoji: "🎯", category: "community", tier: "bronze",
    description: "Posted a wanted (ISO) ad." },
  { type: "show-off", label: "Show-off", emoji: "🏆", category: "community", tier: "bronze", event: true,
    description: "Shared a completed trade to The Haul." },
  { type: "crowd-pleaser", label: "Crowd Pleaser", emoji: "🔥", category: "community", tier: "silver", event: true,
    description: "A trade you shared drew 10+ reactions on The Haul." },
  { type: "heist-legend", label: "Heist Legend", emoji: "🏴‍☠️", category: "community", tier: "gold", event: true,
    description: "The community crowned one of your trades a heist (5+ 🏴‍☠️)." },
  { type: "connector", label: "Connector", emoji: "🔗", category: "community", tier: "silver", event: true,
    description: "Brought a friend who joined Poachland." },
  // ── Identity & founder ──
  { type: "verified", label: "Verified", emoji: "✔️", category: "identity", tier: "special", event: true,
    description: "Identity confirmed by a moderator." },
  { type: "founding", label: "Founding Member", emoji: "🌱", category: "founder", tier: "special", event: true,
    description: "One of the very first traders on Poachland." },
];

export const BADGE_BY_TYPE: Record<BadgeType, BadgeDef> = Object.fromEntries(
  BADGE_CATALOG.map((b) => [b.type, b]),
) as Record<BadgeType, BadgeDef>;

export function badgeLabel(type: BadgeType): string {
  return BADGE_BY_TYPE[type]?.label ?? type;
}

/** Order used when displaying a user's earned badges (rarer/higher first). */
const TIER_RANK: Record<BadgeTier, number> = { special: 0, gold: 1, silver: 2, bronze: 3 };
export function badgeSortKey(type: BadgeType): number {
  return TIER_RANK[BADGE_BY_TYPE[type]?.tier ?? "bronze"];
}

/** How many onboarded members get the Founding Member badge. */
export const FOUNDER_LIMIT = 1000;

// ─── Criteria badges ─────────────────────────────────────────────────────────

export interface BadgeStats {
  tradesCompleted: number;
  trustScore: number;
  /** Total ratings incl. seed baseline (matches the trust score's denominator). */
  ratingsCount: number;
  /** Actual rating rows received (no baseline). */
  ratingsReceived: number;
  /** Every received rating's overall is a perfect 5. */
  allFiveStar: boolean;
  shippingAvg: number;
  shippingCount: number;
  listingCount: number;
  /** Completed claim giveaways where the user is the owner. */
  givenAway: number;
  /** Wanted (ISO) posts created. */
  isoCount: number;
}

/**
 * The criteria badge types a user currently qualifies for. Pure and shared by
 * both engines. Event badges are granted elsewhere and never revoked here.
 */
export function qualifyingBadges(s: BadgeStats): BadgeType[] {
  const out: BadgeType[] = [];
  if (s.tradesCompleted >= 1) out.push("first-trade");
  if (s.tradesCompleted >= 5) out.push("regular");
  if (s.tradesCompleted >= 25) out.push("veteran");
  if (s.tradesCompleted >= 100) out.push("centurion");
  if (s.tradesCompleted >= 10 && s.trustScore >= 4.5 && s.ratingsCount >= 5) out.push("trusted");
  if (s.ratingsReceived >= 8 && s.allFiveStar) out.push("flawless");
  if (s.shippingCount >= 5 && s.shippingAvg >= 4.7) out.push("quick-shipper");
  if (s.listingCount >= 8) out.push("collector");
  if (s.listingCount >= 25) out.push("curator");
  if (s.givenAway >= 3) out.push("generous");
  if (s.givenAway >= 10) out.push("philanthropist");
  if (s.isoCount >= 1) out.push("hunter");
  return out;
}
