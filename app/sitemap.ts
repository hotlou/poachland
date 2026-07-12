/**
 * sitemap.xml — public, crawlable surface only: the landing page, login,
 * the traders directory, and every public trader profile.
 */

import type { MetadataRoute } from "next";
import { listPublicUsernames } from "@/lib/server/public";

export const revalidate = 3600;

const origin = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://poachland.com"
).replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const traders = await listPublicUsernames().catch(
    () => [] as Awaited<ReturnType<typeof listPublicUsernames>>,
  );
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
      url: `${origin}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    ...traders.map((t) => ({
      url: `${origin}/u/${encodeURIComponent(t.username)}`,
      lastModified: t.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
