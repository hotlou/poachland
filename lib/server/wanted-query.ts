import "server-only";

import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { ISOPost, ItemType } from "../types";
import { getDb } from "./db";
import { blocks, isoPosts, users } from "./schema";
import { hydratePublicUser, publicUserColumns } from "./public-user";
import { sampleVisible } from "./sample-visibility";

export type WantedSort = "newest" | "most-saved";
export type WantedQuery = {
  itemType?: "all" | ItemType;
  sort?: WantedSort;
  cursor?: string;
  limit?: number;
};
export type WantedPage = { items: ISOPost[]; nextCursor?: string };

type Cursor = { value: string | number; id: string };

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(raw?: string): Cursor | undefined {
  if (!raw || raw.length > 300) return undefined;
  try {
    const value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Cursor;
    return typeof value.id === "string" &&
      (typeof value.value === "string" || typeof value.value === "number")
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

export async function queryWantedPage(input: WantedQuery, viewerId?: string): Promise<WantedPage> {
  const db = await getDb();
  const sort = input.sort ?? "newest";
  const limit = Math.max(1, Math.min(Math.trunc(input.limit ?? 24), 48));
  const cursor = decodeCursor(input.cursor);
  const filters: SQL[] = [eq(isoPosts.status, "active"), eq(users.status, "active"), isNull(users.deletedAt), isNull(isoPosts.hiddenAt), sampleVisible(users.sampleBatchId)];
  if (input.itemType && input.itemType !== "all") filters.push(eq(isoPosts.itemType, input.itemType));
  if (viewerId) {
    filters.push(sql`not exists (select 1 from ${blocks} b where
      (b.blocker_id = ${viewerId} and b.blocked_id = ${isoPosts.userId}) or
      (b.blocker_id = ${isoPosts.userId} and b.blocked_id = ${viewerId}))`);
  }

  const valueExpr = sort === "most-saved" ? sql`${isoPosts.saves}` : sql`${isoPosts.createdAt}`;
  if (cursor) {
    if (sort === "newest") {
      const value = new Date(String(cursor.value));
      if (Number.isFinite(value.getTime())) {
        filters.push(sql`(${valueExpr} < ${value} or (${valueExpr} = ${value} and ${isoPosts.id} < ${cursor.id}))`);
      }
    } else {
      const value = Number(cursor.value);
      if (Number.isFinite(value)) {
        filters.push(sql`(${valueExpr} < ${value} or (${valueExpr} = ${value} and ${isoPosts.id} < ${cursor.id}))`);
      }
    }
  }

  const order = sort === "most-saved"
    ? [desc(isoPosts.saves), desc(isoPosts.id)]
    : [desc(isoPosts.createdAt), desc(isoPosts.id)];
  const rows = await db.select({ post: isoPosts, user: publicUserColumns }).from(isoPosts)
    .innerJoin(users, eq(isoPosts.userId, users.id))
    .where(and(...filters)).orderBy(...order).limit(limit + 1);
  const pageRows = rows.slice(0, limit);
  const items = pageRows.map(({ post, user }) => ({
    id: post.id, userId: post.userId, itemType: post.itemType, description: post.description,
    team: post.team ?? undefined, size: post.size ?? undefined, maxPrice: post.maxPrice ?? undefined,
    createdAt: post.createdAt.toISOString(), saves: post.saves, status: post.status,
    user: hydratePublicUser(user as never),
  }));
  const last = pageRows.at(-1)?.post;
  const value = last ? (sort === "newest" ? last.createdAt.toISOString() : last.saves) : undefined;
  return { items, nextCursor: rows.length > limit && last && value !== undefined ? encodeCursor({ value, id: last.id }) : undefined };
}
