import "server-only";
import { and, eq, inArray, isNotNull, or } from "drizzle-orm";
import type { Db } from "./db";
import { deals, haulPosts, listings, ratings, threads, users } from "./schema";

function references(value: unknown, key = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => references(v, key));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => references(v, k));
  return typeof value === "string" && /(^id$|Id$|Ids$)/.test(key) ? [value] : [];
}

/** Sample history is for browsing/sharing, never a counterparty for real activity. */
export async function referencesSampleContent(db: Db, input: unknown): Promise<boolean> {
  const ids = [...new Set(references(input))];
  if (ids.length > 150) throw new Error("Too many record references in one request.");
  if (!ids.length) return false;
  const rows = await Promise.all([
    db.select({ id: users.id }).from(users).where(and(inArray(users.id, ids), isNotNull(users.sampleBatchId))).limit(1),
    db.select({ id: listings.id }).from(listings).where(and(inArray(listings.id, ids), isNotNull(listings.sampleBatchId))).limit(1),
    db.select({ id: deals.id }).from(deals).where(and(inArray(deals.id, ids), isNotNull(deals.sampleBatchId))).limit(1),
    db.select({ id: haulPosts.id }).from(haulPosts).where(and(inArray(haulPosts.id, ids), isNotNull(haulPosts.sampleBatchId))).limit(1),
    db.select({ id: ratings.id }).from(ratings).where(and(inArray(ratings.id, ids), isNotNull(ratings.sampleBatchId))).limit(1),
    db.select({ id: threads.id }).from(threads).innerJoin(deals, eq(threads.dealId, deals.id)).where(and(inArray(threads.id, ids), isNotNull(deals.sampleBatchId))).limit(1),
  ]);
  return rows.some((result) => result.length > 0);
}

export async function referencesHiddenListing(db: Db, input: unknown): Promise<boolean> {
  const ids = [...new Set(references(input))];
  if (ids.length > 150) throw new Error("Too many record references in one request.");
  if (!ids.length) return false;
  const [row] = await db.select({ id: listings.id }).from(listings).where(and(inArray(listings.id, ids), or(isNotNull(listings.hiddenAt), eq(listings.status, "removed")))).limit(1);
  return !!row;
}
