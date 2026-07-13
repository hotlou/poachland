/**
 * sitemap.xml — public, crawlable surface only: the landing page, login,
 * the traders directory, and every public trader profile.
 */

import type { MetadataRoute } from "next";
import {
  getPublicPartners,
  listPublicListingIds,
  listPublicUsernames,
} from "@/lib/server/public";

export const revalidate = 3600;

const origin = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://poachland.com"
).replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [traders, listingIds, vendors] = await Promise.all([
    listPublicUsernames().catch(
      () => [] as Awaited<ReturnType<typeof listPublicUsernames>>,
    ),
    listPublicListingIds().catch(
      () => [] as Awaited<ReturnType<typeof listPublicListingIds>>,
    ),
    getPublicPartners("vendor").catch(
      () => [] as Awaited<ReturnType<typeof getPublicPartners>>,
    ),
  ]);
  const now = new Date();

  return [
    {
      url: `${origin}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${origin}/traders`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${origin}/haul`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${origin}/browse`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${origin}/wanted`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${origin}/shop`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${origin}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${origin}/terms`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.2,
    },
    {
      url: `${origin}/privacy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.2,
    },
    {
      url: `${origin}/accessibility`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.2,
    },
    ...traders.map((t) => ({
      url: `${origin}/u/${encodeURIComponent(t.username)}`,
      lastModified: t.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...listingIds.map((l) => ({
      url: `${origin}/l/${l.id}`,
      lastModified: l.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...vendors.map((v) => ({
      url: `${origin}/vendors/${encodeURIComponent(v.slug)}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
