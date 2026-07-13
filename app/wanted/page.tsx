/**
 * Public, SEO-grade view of the Wanted Board — the signed-out-friendly page at
 * /wanted. Server component: owns metadata only; the board renders client-side
 * from the public store snapshot (the bootstrap ships active ISO posts with
 * me:null when signed out, so it works without auth).
 */

import type { Metadata } from "next";
import { PublicWanted } from "./wanted-client";

export const revalidate = 120;

const TITLE = "Wanted: ultimate frisbee gear people are hunting | Poachland";
const DESCRIPTION =
  "See what jerseys and discs ultimate players are hunting for on Poachland. Have one? Join free to make the trade.";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "/wanted" },
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      url: "/wanted",
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

export default async function WantedPage() {
  return <PublicWanted />;
}
