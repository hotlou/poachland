import "server-only";

import { and, asc, desc, eq, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import type { Condition, ItemType, Listing, ListingType } from "../types";
import { getDb } from "./db";
import { blocks, listings, users } from "./schema";
import { hydratePublicUser, publicUserColumns } from "./public-user";
import { sampleVisible } from "./sample-visibility";

export type ListingSort = "newest" | "most-saved" | "most-viewed" | "price-low" | "price-high";
export type MarketplaceQuery = {
  query?: string;
  itemType?: "all" | ItemType;
  listingType?: "all" | ListingType;
  conditions?: Condition[];
  minPrice?: number;
  maxPrice?: number;
  team?: string;
  size?: string;
  sort?: ListingSort;
  cursor?: string;
  limit?: number;
};

type Cursor = { value: string | number; id: string };

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(raw?: string): Cursor | undefined {
  if (!raw || raw.length > 300) return undefined;
  try {
    const value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Cursor;
    return typeof value.id === "string" && (typeof value.value === "string" || typeof value.value === "number") ? value : undefined;
  } catch {
    return undefined;
  }
}

export type MarketplacePage = { items: Listing[]; nextCursor?: string };

export function hydrateMarketplaceListing(row: typeof listings.$inferSelect, user: Record<keyof typeof publicUserColumns, unknown>): Listing {
  return {
    sampleBatchId: row.sampleBatchId ?? undefined, hiddenAt: row.hiddenAt?.toISOString(),
    id: row.id, sellerId: row.sellerId, type: row.type, title: row.title, team: row.team,
    year: row.year ?? undefined, division: row.division ?? undefined, level: row.level, size: row.size ?? undefined,
    condition: row.condition, listingType: row.listingType, askingPrice: row.askingPrice ?? undefined,
    tradeFor: row.tradeFor ?? undefined, photos: row.photos, description: row.description, views: row.views,
    saves: row.saves, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    shippingPreference: row.shippingPreference, tags: row.tags, isRare: row.isRare,
    isFeatured: row.isFeatured, status: row.status, seller: hydratePublicUser(user),
  };
}

/** Exact deep-link read; removed listings remain visible only to their owner. */
export async function queryMarketplaceListing(id: string, viewerId?: string): Promise<Listing | null> {
  if (!id || id.length > 80) return null;
  const db = await getDb();
  const filters: SQL[] = [eq(listings.id, id), eq(users.status, "active"), isNull(users.deletedAt), isNull(listings.hiddenAt), sampleVisible(listings.sampleBatchId), sampleVisible(users.sampleBatchId)];
  if (viewerId) {
    filters.push(or(ne(listings.status, "removed"), eq(listings.sellerId, viewerId))!);
  } else {
    filters.push(ne(listings.status, "removed"));
  }
  const [row] = await db.select({ listing: listings, seller: publicUserColumns }).from(listings)
    .innerJoin(users, eq(listings.sellerId, users.id)).where(and(...filters)).limit(1);
  if (row && viewerId && row.listing.sellerId !== viewerId) {
    const relationship = await db.select({ blockerId: blocks.blockerId }).from(blocks).where(or(
      and(eq(blocks.blockerId, viewerId), eq(blocks.blockedId, row.listing.sellerId)),
      and(eq(blocks.blockedId, viewerId), eq(blocks.blockerId, row.listing.sellerId)),
    )).limit(1);
    if (relationship.length) return null;
  }
  return row ? hydrateMarketplaceListing(row.listing, row.seller as never) : null;
}

export async function queryMarketplacePage(input: MarketplaceQuery): Promise<MarketplacePage> {
  const db = await getDb();
  const sort = input.sort ?? "newest";
  const limit = Math.max(1, Math.min(Math.trunc(input.limit ?? 24), 48));
  const cursor = decodeCursor(input.cursor);
  const filters: SQL[] = [eq(listings.status, "active"), eq(users.status, "active"), isNull(users.deletedAt), isNull(listings.hiddenAt), sampleVisible(listings.sampleBatchId), sampleVisible(users.sampleBatchId)];
  if (input.itemType && input.itemType !== "all") filters.push(eq(listings.type, input.itemType));
  if (input.listingType && input.listingType !== "all") filters.push(eq(listings.listingType, input.listingType));
  if (input.conditions?.length) filters.push(inArray(listings.condition, input.conditions));
  if (Number.isFinite(input.minPrice)) filters.push(sql`${listings.askingPrice} >= ${input.minPrice!}`);
  if (Number.isFinite(input.maxPrice)) filters.push(sql`${listings.askingPrice} <= ${input.maxPrice!}`);
  if (input.team?.trim()) filters.push(sql`${listings.team} ilike ${`%${input.team.trim().slice(0, 80)}%`}`);
  if (input.size?.trim()) filters.push(eq(listings.size, input.size.trim().slice(0, 20)));
  if (input.query?.trim()) {
    const query = input.query.trim().slice(0, 100);
    filters.push(sql`to_tsvector('simple', coalesce(${listings.title}, '') || ' ' || coalesce(${listings.team}, '') || ' ' || coalesce(${listings.description}, '') || ' ' || coalesce(${listings.tags}::text, '')) @@ websearch_to_tsquery('simple', ${query})`);
  }

  let valueExpr: SQL;
  let order: SQL[];
  if (sort === "most-saved") { valueExpr = sql`${listings.saves}`; order = [desc(listings.saves), desc(listings.id)]; }
  else if (sort === "most-viewed") { valueExpr = sql`${listings.views}`; order = [desc(listings.views), desc(listings.id)]; }
  else if (sort === "price-low") { valueExpr = sql`coalesce(${listings.askingPrice}, 2147483647)`; order = [asc(valueExpr), asc(listings.id)]; }
  else if (sort === "price-high") { valueExpr = sql`coalesce(${listings.askingPrice}, -1)`; order = [desc(valueExpr), desc(listings.id)]; }
  else { valueExpr = sql`${listings.createdAt}`; order = [desc(listings.createdAt), desc(listings.id)]; }

  if (cursor) {
    const ascending = sort === "price-low";
    const value = sort === "newest" ? new Date(String(cursor.value)) : Number(cursor.value);
    filters.push(ascending
      ? sql`(${valueExpr} > ${value} or (${valueExpr} = ${value} and ${listings.id} > ${cursor.id}))`
      : sql`(${valueExpr} < ${value} or (${valueExpr} = ${value} and ${listings.id} < ${cursor.id}))`);
  }

  const rows = await db.select({ listing: listings, seller: publicUserColumns }).from(listings)
    .innerJoin(users, eq(listings.sellerId, users.id)).where(and(...filters)).orderBy(...order).limit(limit + 1);
  const pageRows = rows.slice(0, limit);
  const items = pageRows.map(({ listing: row, seller: user }) => hydrateMarketplaceListing(row, user as never));
  const last = pageRows.at(-1)?.listing;
  const value = last ? (sort === "newest" ? last.createdAt.toISOString() : sort === "most-saved" ? last.saves : sort === "most-viewed" ? last.views : last.askingPrice ?? (sort === "price-low" ? 2147483647 : -1)) : undefined;
  return { items, nextCursor: rows.length > limit && last && value !== undefined ? encodeCursor({ value, id: last.id }) : undefined };
}
