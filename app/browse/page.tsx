/**
 * Public, SEO-grade view of the marketplace — the signed-out-friendly browse
 * page at /browse. Server component: owns metadata only; the interactive grid
 * renders client-side from the public store snapshot (the bootstrap ships all
 * active listings with me:null when signed out, so it works without auth).
 */

import type { Metadata } from "next";
import { PublicBrowse } from "./browse-client";

export const revalidate = 120;

const TITLE = "Browse ultimate frisbee jerseys & discs | Poachland";
const DESCRIPTION =
  "See jerseys and discs ultimate players are trading, selling, and giving away on Poachland. Free to join — no fees, no middleman.";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "/browse" },
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      url: "/browse",
      type: "website",
      siteName: "Poachland",
    },
    twitter: {
      card: "summary_large_image",
      title: TITLE,
      description: DESCRIPTION,
    },
  };
}

export default async function BrowsePage() {
  return <PublicBrowse />;
}
