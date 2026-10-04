import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, unique, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./schema";

/** A single row serializes trust graph mutations and issuance limits. */
export const trustPolicyLock = pgTable("trust_policy_lock", { id: text("id").primaryKey() });
export const trustVouches = pgTable("trust_vouches", {
  id: text("id").primaryKey(),
  issuerId: text("issuer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetId: text("target_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  relationship: text("relationship").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
}, (t) => [unique("trust_vouches_pair_unique").on(t.issuerId, t.targetId), index("trust_vouches_target_idx").on(t.targetId)]);
export const trustDmChallenges = pgTable("trust_dm_challenges", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  handle: text("handle").notNull(),
  codeHash: text("code_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "date" }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "date" }),
}, (t) => [index("trust_dm_challenges_user_idx").on(t.userId)]);
export const trustEvidence = pgTable("trust_evidence", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").$type<"instagram">().notNull().default("instagram"),
  handle: text("handle").notNull(),
  externalSenderId: text("external_sender_id"),
  challengeId: text("challenge_id").notNull().references(() => trustDmChallenges.id, { onDelete: "cascade" }).unique(),
  status: text("status").$type<"pending" | "confirmed" | "revoked">().notNull().default("pending"),
  source: text("source").$type<"manual_dm" | "webhook_dm">().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true, mode: "date" }),
  note: text("note"),
}, (t) => [uniqueIndex("trust_evidence_active_handle_unique").on(t.provider, t.handle).where(sql`${t.status} <> 'revoked'`), uniqueIndex("trust_evidence_active_sender_unique").on(t.externalSenderId).where(sql`${t.status} <> 'revoked'`), index("trust_evidence_user_idx").on(t.userId)]);
export const trustDmReceipts = pgTable("trust_dm_receipts", {
  messageId: text("message_id").primaryKey(),
  receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});
