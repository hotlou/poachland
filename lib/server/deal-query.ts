import "server-only";

import { and, asc, desc, eq, inArray, lt, or, type SQL } from "drizzle-orm";
import type { Deal, DealStatus, Listing, Offer } from "../types";
import { getDb } from "./db";
import { deals, listings, offers, users } from "./schema";
import { hydrateMarketplaceListing } from "./marketplace-query";
import { hydratePublicUser, publicUserColumns } from "./public-user";

type Cursor = { updatedAt: string; id: string };
export type DealQueryItem = Deal & { relatedListings: Listing[] };
export type DealPage = { items: DealQueryItem[]; nextCursor?: string };

function decode(raw?: string): Cursor | undefined {
  if (!raw || raw.length > 300) return undefined;
  try {
    const cursor = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Cursor;
    return typeof cursor.id === "string" && Number.isFinite(new Date(cursor.updatedAt).getTime()) ? cursor : undefined;
  } catch { return undefined; }
}

function offer(row: typeof offers.$inferSelect): Offer {
  return {
    id: row.id, byUserId: row.byUserId, proposerListingIds: row.proposerListingIds,
    ownerListingIds: row.ownerListingIds, cashFromProposer: row.cashFromProposer,
    cashFromOwner: row.cashFromOwner, note: row.note, createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(), status: row.status,
  };
}

export async function queryDealPage(userId: string, statuses?: DealStatus[], cursorRaw?: string, requestedLimit = 20, exactId?: string): Promise<DealPage> {
  const db = await getDb();
  const limit = Math.max(1, Math.min(Math.trunc(requestedLimit), 40));
  const cursor = decode(cursorRaw);
  const filters: SQL[] = [or(eq(deals.proposerId, userId), eq(deals.ownerId, userId))!];
  if (exactId) filters.push(eq(deals.id, exactId));
  if (statuses?.length) filters.push(inArray(deals.status, statuses));
  if (cursor) filters.push(or(lt(deals.updatedAt, new Date(cursor.updatedAt)), and(eq(deals.updatedAt, new Date(cursor.updatedAt)), lt(deals.id, cursor.id)))!);
  const rows = await db.select().from(deals).where(and(...filters)).orderBy(desc(deals.updatedAt), desc(deals.id)).limit(limit + 1);
  const pageRows = rows.slice(0, limit);
  if (!pageRows.length) return { items: [] };
  const dealIds = pageRows.map((row) => row.id);
  const offerRows = await db.select().from(offers).where(inArray(offers.dealId, dealIds)).orderBy(asc(offers.dealId), asc(offers.position));
  const listingIds = [...new Set([...pageRows.map((row) => row.listingId), ...offerRows.flatMap((row) => [...row.proposerListingIds, ...row.ownerListingIds])])];
  const userIds = [...new Set(pageRows.flatMap((row) => [row.proposerId, row.ownerId]))];
  const [userRows, listingRows] = await Promise.all([
    db.select(publicUserColumns).from(users).where(inArray(users.id, userIds)),
    db.select({ listing: listings, seller: publicUserColumns }).from(listings).innerJoin(users, eq(listings.sellerId, users.id)).where(inArray(listings.id, listingIds)),
  ]);
  const userById = new Map(userRows.map((row) => [String(row.id), hydratePublicUser(row as never)]));
  const listingById = new Map(listingRows.map((row) => [row.listing.id, hydrateMarketplaceListing(row.listing, row.seller as never)]));
  const offersByDeal = new Map<string, Offer[]>();
  for (const row of offerRows) offersByDeal.set(row.dealId, [...(offersByDeal.get(row.dealId) ?? []), offer(row)]);
  const items = pageRows.flatMap((row) => {
    const listing = listingById.get(row.listingId);
    const proposer = userById.get(row.proposerId);
    const owner = userById.get(row.ownerId);
    const dealOffers = offersByDeal.get(row.id) ?? [];
    const currentOffer = dealOffers.at(-1);
    if (!listing || !proposer || !owner || !currentOffer) return [];
    return [{
      id: row.id, kind: row.kind, listingId: row.listingId, proposerId: row.proposerId, ownerId: row.ownerId,
      offers: dealOffers, status: row.status, threadId: row.threadId, createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(), acceptedAt: row.acceptedAt?.toISOString(), completedAt: row.completedAt?.toISOString(),
      closedAt: row.closedAt?.toISOString(), declineReason: row.declineReason ?? undefined,
      disputeReason: row.disputeReason ?? undefined, fulfillment: row.fulfillment,
      listing, proposer, owner, currentOffer,
      relatedListings: [...new Set([row.listingId, ...dealOffers.flatMap((entry) => [...entry.proposerListingIds, ...entry.ownerListingIds])])]
        .flatMap((id) => listingById.get(id) ?? []),
    } satisfies DealQueryItem];
  });
  const last = pageRows.at(-1);
  return {
    items,
    nextCursor: rows.length > limit && last
      ? Buffer.from(JSON.stringify({ updatedAt: last.updatedAt.toISOString(), id: last.id })).toString("base64url")
      : undefined,
  };
}

export async function queryDealById(userId: string, id: string): Promise<DealQueryItem | null> {
  if (!id || id.length > 80) return null;
  return (await queryDealPage(userId, undefined, undefined, 1, id)).items[0] ?? null;
}
