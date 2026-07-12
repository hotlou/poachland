/**
 * Poachland Postgres schema (Drizzle).
 *
 * Maps lib/types.ts 1:1 — camelCase fields in TS, snake_case columns in SQL.
 * Primary keys stay app-generated text ids (uid pattern like "l_abc123").
 *
 * Differences from the client `*Record` types are limited to what a real
 * multi-user backend requires:
 *   - users gains auth/identity columns (email, isAdmin, onboardedAt) and
 *     username becomes nullable until onboarding completes.
 *   - DealRecord.offers (embedded array) is normalized into the `offers`
 *     table, ordered by (dealId, position).
 *   - login_tokens / sessions / identities are new server-only tables.
 */

import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import type {
  ActivityType,
  Badge,
  Condition,
  DealKind,
  DealStatus,
  Division,
  FulfillmentState,
  ISOStatus,
  ItemType,
  Level,
  ListingStatus,
  ListingType,
  MessageKind,
  NotificationType,
  OfferStatus,
  ReportStatus,
  ReportTargetType,
  SaveTargetType,
  ShippingPreference,
} from "../types";

// ─── Identity scaffolding enums (server-only, not part of lib/types.ts) ──────

export type IdentityProvider = "instagram" | "facebook" | "usau" | "other";
export type IdentityStatus = "unverified" | "pending" | "verified" | "rejected";

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(), // stored lowercased
  username: text("username").unique(), // NULL until onboarding completes
  displayName: text("display_name").notNull(),
  avatar: text("avatar").notNull().default("/placeholder-user.jpg"),
  bio: text("bio").notNull().default(""),
  location: text("location").notNull().default(""),
  favoriteTeams: jsonb("favorite_teams").$type<string[]>().notNull().default([]),
  memberSince: timestamp("member_since", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  isVerified: boolean("is_verified").notNull().default(false),
  isAdmin: boolean("is_admin").notNull().default(false),
  badges: jsonb("badges").$type<Badge[]>().notNull().default([]),
  baselineTrades: integer("baseline_trades").notNull().default(0),
  baselineRatingCount: integer("baseline_rating_count").notNull().default(0),
  baselineRatingSum: doublePrecision("baseline_rating_sum").notNull().default(0),
  trustScore: doublePrecision("trust_score").notNull().default(0),
  ratingsCount: integer("ratings_count").notNull().default(0),
  tradesCompleted: integer("trades_completed").notNull().default(0),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true, mode: "date" }),
});

// ─── Listings ────────────────────────────────────────────────────────────────

export const listings = pgTable(
  "listings",
  {
    id: text("id").primaryKey(),
    sellerId: text("seller_id")
      .notNull()
      .references(() => users.id),
    type: text("type").$type<ItemType>().notNull(),
    title: text("title").notNull(),
    team: text("team").notNull(),
    year: text("year"),
    division: text("division").$type<Division>(),
    level: text("level").$type<Level>().notNull(),
    size: text("size"),
    condition: text("condition").$type<Condition>().notNull(),
    listingType: text("listing_type").$type<ListingType>().notNull(),
    askingPrice: doublePrecision("asking_price"),
    tradeFor: text("trade_for"),
    photos: jsonb("photos").$type<string[]>().notNull().default([]),
    description: text("description").notNull().default(""),
    views: integer("views").notNull().default(0),
    saves: integer("saves").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    shippingPreference: text("shipping_preference")
      .$type<ShippingPreference>()
      .notNull(),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    isRare: boolean("is_rare").notNull().default(false),
    isFeatured: boolean("is_featured").notNull().default(false),
    status: text("status").$type<ListingStatus>().notNull().default("active"),
  },
  (t) => [
    index("listings_status_idx").on(t.status),
    index("listings_seller_id_idx").on(t.sellerId),
  ],
);

// ─── Wanted board (ISO posts) ────────────────────────────────────────────────

export const isoPosts = pgTable("iso_posts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  itemType: text("item_type").$type<ItemType>().notNull(),
  description: text("description").notNull(),
  team: text("team"),
  size: text("size"),
  maxPrice: doublePrecision("max_price"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  saves: integer("saves").notNull().default(0),
  status: text("status").$type<ISOStatus>().notNull().default("active"),
});

// ─── Deals & offers ──────────────────────────────────────────────────────────

export const deals = pgTable(
  "deals",
  {
    id: text("id").primaryKey(),
    kind: text("kind").$type<DealKind>().notNull(),
    listingId: text("listing_id").notNull(),
    proposerId: text("proposer_id")
      .notNull()
      .references(() => users.id),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    status: text("status").$type<DealStatus>().notNull().default("open"),
    threadId: text("thread_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
    declineReason: text("decline_reason"),
    disputeReason: text("dispute_reason"),
    fulfillment: jsonb("fulfillment")
      .$type<Record<string, FulfillmentState>>()
      .notNull()
      .default({}),
  },
  (t) => [
    index("deals_proposer_id_idx").on(t.proposerId),
    index("deals_owner_id_idx").on(t.ownerId),
    index("deals_listing_id_idx").on(t.listingId),
    index("deals_status_idx").on(t.status),
  ],
);

/** DealRecord.offers, normalized. `position` preserves chronological order. */
export const offers = pgTable(
  "offers",
  {
    id: text("id").primaryKey(),
    dealId: text("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    byUserId: text("by_user_id").notNull(),
    proposerListingIds: jsonb("proposer_listing_ids")
      .$type<string[]>()
      .notNull()
      .default([]),
    ownerListingIds: jsonb("owner_listing_ids")
      .$type<string[]>()
      .notNull()
      .default([]),
    cashFromProposer: doublePrecision("cash_from_proposer").notNull().default(0),
    cashFromOwner: doublePrecision("cash_from_owner").notNull().default(0),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    status: text("status").$type<OfferStatus>().notNull().default("pending"),
  },
  (t) => [unique("offers_deal_id_position_unique").on(t.dealId, t.position)],
);

// ─── Messaging ───────────────────────────────────────────────────────────────

export const threads = pgTable("threads", {
  id: text("id").primaryKey(),
  participantIds: jsonb("participant_ids").$type<[string, string]>().notNull(),
  listingId: text("listing_id"),
  isoPostId: text("iso_post_id"),
  dealId: text("deal_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  /** userId -> ISO timestamp of the last time they viewed the thread. */
  lastRead: jsonb("last_read").$type<Record<string, string>>().notNull().default({}),
});

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => threads.id),
    senderId: text("sender_id").notNull(),
    kind: text("kind").$type<MessageKind>().notNull(),
    content: text("content").notNull(),
    offerId: text("offer_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("messages_thread_id_idx").on(t.threadId)],
);

// ─── Ratings ─────────────────────────────────────────────────────────────────

export const ratings = pgTable(
  "ratings",
  {
    id: text("id").primaryKey(),
    dealId: text("deal_id").notNull(),
    fromUserId: text("from_user_id").notNull(),
    toUserId: text("to_user_id").notNull(),
    communication: integer("communication").notNull(),
    shippingSpeed: integer("shipping_speed").notNull(),
    itemAccuracy: integer("item_accuracy").notNull(),
    wouldTradeAgain: boolean("would_trade_again").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("ratings_deal_id_from_user_id_unique").on(t.dealId, t.fromUserId),
    index("ratings_to_user_id_idx").on(t.toUserId),
  ],
);

// ─── Notifications ───────────────────────────────────────────────────────────

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    type: text("type").$type<NotificationType>().notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    linkTo: text("link_to"),
  },
  (t) => [index("notifications_user_id_read_idx").on(t.userId, t.read)],
);

// ─── Saves, moderation, activity ─────────────────────────────────────────────

export const saves = pgTable(
  "saves",
  {
    userId: text("user_id").notNull(),
    targetType: text("target_type").$type<SaveTargetType>().notNull(),
    targetId: text("target_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.targetType, t.targetId] })],
);

export const reports = pgTable("reports", {
  id: text("id").primaryKey(),
  reporterId: text("reporter_id").notNull(),
  targetType: text("target_type").$type<ReportTargetType>().notNull(),
  targetId: text("target_id").notNull(),
  reason: text("reason").notNull(),
  details: text("details"),
  status: text("status").$type<ReportStatus>().notNull().default("pending"),
  resolution: text("resolution"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
});

export const blocks = pgTable(
  "blocks",
  {
    blockerId: text("blocker_id").notNull(),
    blockedId: text("blocked_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })],
);

export const activity = pgTable("activity", {
  id: text("id").primaryKey(),
  type: text("type").$type<ActivityType>().notNull(),
  actorId: text("actor_id").notNull(),
  targetId: text("target_id"),
  summary: text("summary").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  linkTo: text("link_to"),
});

// ─── Auth ────────────────────────────────────────────────────────────────────

export const loginTokens = pgTable(
  "login_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    email: text("email").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("login_tokens_email_idx").on(t.email)],
);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

// ─── Identity scaffolding (future real-life reputation binding) ──────────────

export const identities = pgTable(
  "identities",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").$type<IdentityProvider>().notNull(),
    handle: text("handle").notNull(),
    url: text("url"),
    status: text("status").$type<IdentityStatus>().notNull().default("unverified"),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "date" }),
    reviewerNote: text("reviewer_note"),
  },
  (t) => [
    unique("identities_user_id_provider_handle_unique").on(
      t.userId,
      t.provider,
      t.handle,
    ),
  ],
);

// ─── Inferred row types ──────────────────────────────────────────────────────

export type UserRow = typeof users.$inferSelect;
export type ListingRow = typeof listings.$inferSelect;
export type IsoPostRow = typeof isoPosts.$inferSelect;
export type DealRow = typeof deals.$inferSelect;
export type OfferRow = typeof offers.$inferSelect;
export type ThreadRow = typeof threads.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type RatingRow = typeof ratings.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
export type SaveRow = typeof saves.$inferSelect;
export type ReportRow = typeof reports.$inferSelect;
export type BlockRow = typeof blocks.$inferSelect;
export type ActivityRow = typeof activity.$inferSelect;
export type LoginTokenRow = typeof loginTokens.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type IdentityRow = typeof identities.$inferSelect;
