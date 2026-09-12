/**
 * Public traders directory at /traders — every onboarded collector with
 * their trust score, badges, and location, linking to /u/[username].
 * Server wrapper for metadata; the list itself renders client-side from the
 * public store snapshot.
 */

import { pageMetadata } from "@/lib/metadata";
import type { Metadata } from "next";
import { TradersDirectory } from "./traders-client";

export const metadata: Metadata = pageMetadata({
  title: "Traders — Poachland",
  description: "Meet the collectors trading ultimate frisbee jerseys and discs on Poachland. Explore public profiles, ratings, and completed trades.",
  path: "/traders",
  image: "/traders/opengraph-image",
});

export default function TradersPage() {
  return <TradersDirectory />;
}
