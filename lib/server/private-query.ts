import "server-only";

import { and, count, desc, eq, inArray, lt, notInArray, or } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { DealStatus, Message, Notification, Thread, User } from "../types";
import { getDb } from "./db";
import { blocks, deals, listings, messages, notifications, threads, users } from "./schema";
import { hydrateMarketplaceListing } from "./marketplace-query";
import { hydratePublicUser, publicUserColumns } from "./public-user";

type TimeCursor = { createdAt: string; id: string };

function encode(cursor: TimeCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decode(raw?: string): TimeCursor | undefined {
  if (!raw || raw.length > 300) return undefined;
  try {
    const cursor = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as TimeCursor;
    return typeof cursor.createdAt === "string" && typeof cursor.id === "string" && Number.isFinite(new Date(cursor.createdAt).getTime()) ? cursor : undefined;
  } catch {
    return undefined;
  }
}

export type NotificationPage = { items: Notification[]; unreadCount: number; nextCursor?: string };

export async function queryNotificationPage(userId: string, cursorRaw?: string, requestedLimit = 30): Promise<NotificationPage> {
  const db = await getDb();
  const limit = Math.max(1, Math.min(Math.trunc(requestedLimit), 50));
  const cursor = decode(cursorRaw);
  const pageFilter = cursor
    ? and(eq(notifications.userId, userId), or(lt(notifications.createdAt, new Date(cursor.createdAt)), and(eq(notifications.createdAt, new Date(cursor.createdAt)), lt(notifications.id, cursor.id))))
    : eq(notifications.userId, userId);
  const [rows, [unread]] = await Promise.all([
    db.select().from(notifications).where(pageFilter).orderBy(desc(notifications.createdAt), desc(notifications.id)).limit(limit + 1),
    db.select({ value: count() }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.read, false))),
  ]);
  const pageRows = rows.slice(0, limit);
  const items = pageRows.map((row) => ({
    id: row.id, userId: row.userId, type: row.type, title: row.title, body: row.body,
    read: row.read, createdAt: row.createdAt.toISOString(), linkTo: row.linkTo ?? undefined,
  }));
  const last = pageRows.at(-1);
  return { items, unreadCount: Number(unread?.value ?? 0), nextCursor: rows.length > limit && last ? encode({ createdAt: last.createdAt.toISOString(), id: last.id }) : undefined };
}

export type MessagePage = { items: Message[]; nextCursor?: string };

export type ThreadSummary = Omit<Thread, "deal"> & { dealStatus?: DealStatus };
export type ThreadPage = { items: ThreadSummary[]; nextCursor?: string; unreadCount: number };

export async function queryThreadPage(userId: string, cursorRaw?: string, requestedLimit = 30, exactId?: string): Promise<ThreadPage> {
  const db = await getDb();
  const limit = Math.max(1, Math.min(Math.trunc(requestedLimit), 50));
  const cursor = decode(cursorRaw);
  const participation = sql`(${threads.participantIds}->>0 = ${userId} or ${threads.participantIds}->>1 = ${userId})`;
  const filters = [participation];
  if (exactId) filters.push(eq(threads.id, exactId));
  if (cursor) filters.push(or(lt(threads.updatedAt, new Date(cursor.createdAt)), and(eq(threads.updatedAt, new Date(cursor.createdAt)), lt(threads.id, cursor.id)))!);
  const blockRows = exactId ? [] : await db.select().from(blocks).where(or(eq(blocks.blockerId, userId), eq(blocks.blockedId, userId)));
  const blockedIds = [...new Set(blockRows.map((row) => row.blockerId === userId ? row.blockedId : row.blockerId))];
  if (blockedIds.length) {
    filters.push(notInArray(sql<string>`${threads.participantIds}->>0`, blockedIds));
    filters.push(notInArray(sql<string>`${threads.participantIds}->>1`, blockedIds));
  }
  const rows = await db.select({
    thread: threads,
    unread: sql<number>`(select count(*)::int from ${messages} m where m.thread_id = ${threads.id} and m.sender_id <> ${userId} and m.created_at > coalesce((${threads.lastRead}->>${userId})::timestamptz, to_timestamp(0)))`,
  }).from(threads).where(and(...filters)).orderBy(desc(threads.updatedAt), desc(threads.id)).limit(limit + 1);
  const pageRows = rows.slice(0, limit);
  if (!pageRows.length) return { items: [], unreadCount: 0 };

  const threadIds = pageRows.map(({ thread }) => thread.id);
  const participantIds = [...new Set(pageRows.flatMap(({ thread }) => thread.participantIds))];
  const listingIds = [...new Set(pageRows.flatMap(({ thread }) => thread.listingId ? [thread.listingId] : []))];
  const dealIds = [...new Set(pageRows.flatMap(({ thread }) => thread.dealId ? [thread.dealId] : []))];
  const [userRows, listingRows, dealRows, lastMessages] = await Promise.all([
    db.select(publicUserColumns).from(users).where(inArray(users.id, participantIds)),
    listingIds.length ? db.select({ listing: listings, seller: publicUserColumns }).from(listings).innerJoin(users, eq(listings.sellerId, users.id)).where(inArray(listings.id, listingIds)) : [],
    dealIds.length ? db.select({ id: deals.id, status: deals.status }).from(deals).where(inArray(deals.id, dealIds)) : [],
    Promise.all(threadIds.map(async (threadId) => (await db.select().from(messages).where(eq(messages.threadId, threadId)).orderBy(desc(messages.createdAt), desc(messages.id)).limit(1))[0])),
  ]);
  const userById = new Map(userRows.map((row) => [String(row.id), hydratePublicUser(row as never)]));
  const listingById = new Map(listingRows.map((row) => [row.listing.id, hydrateMarketplaceListing(row.listing, row.seller as never)]));
  const dealStatusById = new Map(dealRows.map((row) => [row.id, row.status]));
  const lastByThread = new Map(lastMessages.filter(Boolean).map((row) => [row.threadId, {
    id: row.id, threadId: row.threadId, senderId: row.senderId, kind: row.kind, content: row.content,
    offerId: row.offerId ?? undefined, createdAt: row.createdAt.toISOString(),
  }]));
  const items = pageRows.flatMap(({ thread, unread }) => {
    const otherId = thread.participantIds.find((id) => id !== userId) ?? thread.participantIds[0];
    const otherUser = userById.get(otherId);
    if (!otherUser) return [];
    return [{
      id: thread.id, participantIds: thread.participantIds, listingId: thread.listingId ?? undefined,
      isoPostId: thread.isoPostId ?? undefined, dealId: thread.dealId ?? undefined,
      createdAt: thread.createdAt.toISOString(), updatedAt: thread.updatedAt.toISOString(), lastRead: thread.lastRead,
      participants: thread.participantIds.map((id) => userById.get(id)).filter((entry): entry is User => !!entry),
      otherUser, lastMessage: lastByThread.get(thread.id), unreadCount: Number(unread),
      listing: thread.listingId ? listingById.get(thread.listingId) : undefined,
      dealStatus: thread.dealId ? dealStatusById.get(thread.dealId) : undefined,
    } satisfies ThreadSummary];
  });
  const last = pageRows.at(-1)?.thread;
  const nextCursor = rows.length > limit && last ? encode({ createdAt: last.updatedAt.toISOString(), id: last.id }) : undefined;
  return { items, nextCursor, unreadCount: items.reduce((sum, item) => sum + item.unreadCount, 0) };
}

export async function queryThreadById(userId: string, id: string): Promise<ThreadSummary | null> {
  if (!id || id.length > 80) return null;
  return (await queryThreadPage(userId, undefined, 1, id)).items[0] ?? null;
}

export async function queryThreadMessagePage(userId: string, threadId: string, cursorRaw?: string, requestedLimit = 50): Promise<MessagePage> {
  const db = await getDb();
  const [thread] = await db.select({ id: threads.id }).from(threads)
    .where(and(eq(threads.id, threadId), sql`(${threads.participantIds}->>0 = ${userId} or ${threads.participantIds}->>1 = ${userId})`)).limit(1);
  if (!thread) return { items: [] };
  const limit = Math.max(1, Math.min(Math.trunc(requestedLimit), 100));
  const cursor = decode(cursorRaw);
  const filter = cursor
    ? and(eq(messages.threadId, threadId), or(lt(messages.createdAt, new Date(cursor.createdAt)), and(eq(messages.createdAt, new Date(cursor.createdAt)), lt(messages.id, cursor.id))))
    : eq(messages.threadId, threadId);
  const rows = await db.select().from(messages).where(filter).orderBy(desc(messages.createdAt), desc(messages.id)).limit(limit + 1);
  const pageRows = rows.slice(0, limit);
  const items = pageRows.reverse().map((row) => ({
    id: row.id, threadId: row.threadId, senderId: row.senderId, kind: row.kind,
    content: row.content, offerId: row.offerId ?? undefined, createdAt: row.createdAt.toISOString(),
  }));
  const oldest = items[0];
  return { items, nextCursor: rows.length > limit && oldest ? encode({ createdAt: oldest.createdAt, id: oldest.id }) : undefined };
}
