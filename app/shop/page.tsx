/**
 * Public, SEO-grade view of The Shop — the directory of gear brands backing
 * ultimate at /shop.
 *
 * Server component: fetches the active partners for metadata (a live count
 * folded into the description). The visible page is rendered client-side from
 * the public store snapshot.
 */

import type { Metadata } from "next";
import { getPublicPartners } from "@/lib/server/public";
import { PublicShop } from "./shop-client";

export const revalidate = 300;

const TITLE = "The Shop — gear brands backing ultimate frisbee | Poachland";

export async function generateMetadata(): Promise<Metadata> {
  let count = 0;
  try {
    count = (await getPublicPartners("vendor")).length;
  } catch {
    count = 0;
  }

  const tail = count > 0 ? ` ${count} brands and counting.` : "";
  const description = `Jersey makers, disc brands, and gear companies that back the ultimate community. Shop direct.${tail}`;

  return {
    title: TITLE,
    description,
    alternates: { canonical: "/shop" },
    openGraph: {
      title: TITLE,
      description,
      url: "/shop",
      type: "website",
      siteName: "Poachland",
    },
    twitter: {
      card: "summary_large_image",
      title: TITLE,
      description,
    },
  };
}

export default async function ShopPage() {
  return <PublicShop />;
}
