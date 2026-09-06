"use server";

import { queryMarketplaceListing, queryMarketplacePage, type MarketplacePage, type MarketplaceQuery } from "@/lib/server/marketplace-query";
import type { DealStatus, Listing } from "@/lib/types";
import { queryDealById, queryDealPage, type DealPage, type DealQueryItem } from "@/lib/server/deal-query";
import { queryNotificationPage, queryThreadById, queryThreadMessagePage, queryThreadPage, type MessagePage, type NotificationPage, type ThreadPage, type ThreadSummary } from "@/lib/server/private-query";
import { queryWantedPage, type WantedPage, type WantedQuery } from "@/lib/server/wanted-query";
import { getPublicProfile, queryHaulPage, type HaulPage, type PublicProfile } from "@/lib/server/public";
import { readSessionContext } from "@/lib/server/session";

export async function searchMarketplace(input: MarketplaceQuery): Promise<MarketplacePage> {
  return queryMarketplacePage(input);
}

export async function fetchMarketplaceListing(id: string): Promise<Listing | null> {
  const context = await readSessionContext();
  return queryMarketplaceListing(id, context?.effectiveUser.id);
}

export async function fetchWantedPage(input: WantedQuery): Promise<WantedPage> {
  const context = await readSessionContext();
  return queryWantedPage(input, context?.effectiveUser.id);
}

export async function fetchHaulPage(cursor?: string, limit = 20): Promise<HaulPage> {
  const context = await readSessionContext();
  return queryHaulPage({ cursor, limit }, context?.effectiveUser.id);
}

export async function fetchPublicProfile(username: string): Promise<PublicProfile | null> {
  return getPublicProfile(username);
}

export async function fetchNotificationPage(cursor?: string, limit = 30): Promise<NotificationPage> {
  const context = await readSessionContext();
  if (!context) return { items: [], unreadCount: 0 };
  return queryNotificationPage(context.effectiveUser.id, cursor, limit);
}

export async function fetchThreadMessagePage(threadId: string, cursor?: string, limit = 50): Promise<MessagePage> {
  const context = await readSessionContext();
  if (!context) return { items: [] };
  return queryThreadMessagePage(context.effectiveUser.id, threadId, cursor, limit);
}

export async function fetchThreadPage(cursor?: string, limit = 30): Promise<ThreadPage> {
  const context = await readSessionContext();
  if (!context) return { items: [], unreadCount: 0 };
  return queryThreadPage(context.effectiveUser.id, cursor, limit);
}

export async function fetchDealPage(statuses?: DealStatus[], cursor?: string, limit = 20): Promise<DealPage> {
  const context = await readSessionContext();
  if (!context) return { items: [] };
  return queryDealPage(context.effectiveUser.id, statuses, cursor, limit);
}

export async function fetchDeal(id: string): Promise<DealQueryItem | null> {
  const context = await readSessionContext();
  return context ? queryDealById(context.effectiveUser.id, id) : null;
}

export async function fetchThread(id: string): Promise<ThreadSummary | null> {
  const context = await readSessionContext();
  return context ? queryThreadById(context.effectiveUser.id, id) : null;
}
