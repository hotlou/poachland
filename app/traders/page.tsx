/**
 * Public traders directory at /traders — every onboarded collector with
 * their trust score, badges, and location, linking to /u/[username].
 * Server wrapper for metadata; the list itself renders client-side from the
 * public store snapshot.
 */

import type { Metadata } from "next";
import { TradersDirectory } from "./traders-client";

export const metadata: Metadata = {
  title: "Traders — Poachland",
  description:
    "Meet the collectors trading ultimate frisbee jerseys and discs on Poachland. Trust scores, badges, and completed trades — all public, all earned.",
  alternates: { canonical: "/traders" },
  openGraph: {
    title: "Traders — Poachland",
    description:
      "Meet the collectors trading ultimate frisbee jerseys and discs on Poachland.",
    url: "/traders",
    type: "website",
    siteName: "Poachland",
  },
  twitter: {
    card: "summary_large_image",
    title: "Traders — Poachland",
    description:
      "Meet the collectors trading ultimate frisbee jerseys and discs on Poachland.",
  },
};

export default function TradersPage() {
  return <TradersDirectory />;
}
