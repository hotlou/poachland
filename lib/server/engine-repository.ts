import "server-only";

import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import type { Db } from "./db";
import {
  blocks,
  deals,
  listings,
  offers,
  users,
  type DealRow,
  type ListingRow,
  type OfferRow,
  type UserRow,
} from "./schema";

export async function getListingRow(tx: Db, id: string): Promise<ListingRow | undefined> {
  const [row] = await tx.select().from(listings).where(eq(listings.id, id)).limit(1);
  return row;
}

export async function getUserRow(tx: Db, id: string): Promise<UserRow | undefined> {
  const [row] = await tx.select().from(users).where(eq(users.id, id)).limit(1);
  return row;
}

export async function getDealForUpdate(tx: Db, id: string): Promise<DealRow | undefined> {
  const [row] = await tx.select().from(deals).where(eq(deals.id, id)).for("update");
  return row;
}

export async function latestOffer(tx: Db, dealId: string): Promise<OfferRow | undefined> {
  const [row] = await tx
    .select()
    .from(offers)
    .where(eq(offers.dealId, dealId))
    .orderBy(sql`${offers.position} desc`)
    .limit(1);
  return row;
}

/** Latest offer per deal, selected in one bounded query. */
export async function latestOffersByDeal(tx: Db, dealIds: string[]): Promise<Map<string, OfferRow>> {
  const latest = new Map<string, OfferRow>();
  if (dealIds.length === 0) return latest;
  const rows = await tx
    .select()
    .from(offers)
    .where(inArray(offers.dealId, dealIds))
    .orderBy(asc(offers.dealId), asc(offers.position));
  for (const row of rows) latest.set(row.dealId, row);
  return latest;
}

export async function isBlockedPair(tx: Db, firstUserId: string, secondUserId: string): Promise<boolean> {
  const rows = await tx
    .select({ blockerId: blocks.blockerId })
    .from(blocks)
    .where(
      or(
        and(eq(blocks.blockerId, firstUserId), eq(blocks.blockedId, secondUserId)),
        and(eq(blocks.blockerId, secondUserId), eq(blocks.blockedId, firstUserId)),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
