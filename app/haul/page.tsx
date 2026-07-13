/**
 * Public, SEO-grade view of The Haul — the community wall of completed trades
 * at /haul.
 *
 * Server component: fetches a small slice of the public wall for metadata (a
 * live count folded into the description — the OG image comes from the sibling
 * opengraph-image.tsx automatically). The visible page is rendered
 * client-side from the public store snapshot.
 */

import type { Metadata } from "next";
import { getPublicHaul } from "@/lib/server/public";
import { PublicHaul } from "./haul-client";

export const revalidate = 300;

const TITLE = "The Haul — real ultimate frisbee trades, celebrated | Poachland";

export async function generateMetadata(): Promise<Metadata> {
  let count = 0;
  try {
    count = (await getPublicHaul(30)).length;
  } catch {
    count = 0;
  }

  const tail = count > 0 ? ` ${count} trades and counting.` : "";
  const description = `See what ultimate frisbee players are trading on Poachland — jerseys and discs swapped, celebrated by the community.${tail} Join free.`;

  return {
    title: TITLE,
    description,
    alternates: { canonical: "/haul" },
    openGraph: {
      title: TITLE,
      description,
      url: "/haul",
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

export default async function HaulPage() {
  return <PublicHaul />;
}
