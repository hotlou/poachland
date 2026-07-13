/**
 * Public, SEO-grade listing page at /l/[id].
 *
 * Server component: fetches the listing for metadata (title, description,
 * canonical, OG/Twitter — the OG image comes from the sibling
 * opengraph-image.tsx automatically) and 404s unknown/removed listings and
 * moderated sellers. The visible page is rendered client-side from the public
 * store snapshot.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicListing, type PublicListing } from "@/lib/server/public";
import { LISTING_TYPE_LABELS } from "@/lib/constants";
import { PublicListingView } from "./listing-public";

export const revalidate = 120;

type PageProps = { params: Promise<{ id: string }> };

function listingDescription(l: PublicListing): string {
  const pricePrefix =
    l.listingType === "sell" && l.askingPrice != null
      ? `$${l.askingPrice} · `
      : l.listingType === "free"
        ? "Free · "
        : "";
  const raw =
    `${pricePrefix}${l.condition} ${l.team} ${l.type} — ` +
    `${LISTING_TYPE_LABELS[l.listingType]} on Poachland. ${l.description}`;
  const trimmed = raw.trim();
  return trimmed.length > 200 ? `${trimmed.slice(0, 199).trimEnd()}…` : trimmed;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const l = await getPublicListing(id);
  if (!l) {
    return {
      title: "Listing not found — Poachland",
      robots: { index: false },
    };
  }

  const title = `${l.title} — Poachland`;
  const description = listingDescription(l);
  const path = `/l/${l.id}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      type: "website",
      siteName: "Poachland",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function PublicListingPage({ params }: PageProps) {
  const { id } = await params;
  const l = await getPublicListing(id);
  if (!l) notFound();

  return <PublicListingView id={l.id} />;
}
