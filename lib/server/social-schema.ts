import { boolean, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { SocialCadence, SocialSource, SocialStatus } from "../social-types";

export const socialSettings = pgTable("social_settings", {
  id: text("id").primaryKey().default("instagram"),
  paused: boolean("paused").notNull().default(true),
  daily: boolean("daily").notNull().default(false),
  weekly: boolean("weekly").notNull().default(false),
  automatic: boolean("automatic").notNull().default(false),
  hourUtc: integer("hour_utc").notNull().default(15),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const socialPosts = pgTable("social_posts", {
  id: text("id").primaryKey(),
  windowKey: text("window_key").notNull().unique(),
  cadence: text("cadence").$type<SocialCadence>().notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
  status: text("status").$type<SocialStatus>().notNull().default("draft"),
  sources: jsonb("sources").$type<SocialSource[]>().notNull(),
  sourceFingerprint: text("source_fingerprint").notNull(),
  caption: text("caption").notNull(),
  imageToken: text("image_token").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  leaseToken: text("lease_token"),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  containerId: text("container_id"),
  mediaId: text("media_id"),
  publishAttemptedAt: timestamp("publish_attempted_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("social_posts_due_idx").on(t.status, t.scheduledAt), index("social_posts_lease_idx").on(t.leaseUntil)]);
