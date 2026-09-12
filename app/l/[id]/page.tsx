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
import { getPublicListing } from "@/lib/server/public";
import { pageMetadata } from "@/lib/metadata";
import { listingShareContent, shorten } from "@/lib/sharing";
import { PublicListingView } from "./listing-public";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const l = await getPublicListing(id);
  if (!l) {
    return pageMetadata({ title: "Listing unavailable — Poachland", description: "This listing is no longer public. Discover more ultimate frisbee gear on Poachland.", noIndex: true });
  }

  const content = listingShareContent(l);
  return pageMetadata({ title: `${content.title} — Poachland`, description: shorten(content.text, 220), path: content.path, image: content.imagePath, noIndex: !!l.sampleBatchId, imageAlt: `${content.title} — ${l.condition}${l.size ? `, size ${l.size}` : ""}` });
}

export default async function PublicListingPage({ params }: PageProps) {
  const { id } = await params;
  const l = await getPublicListing(id);
  if (!l) notFound();

  return <PublicListingView listing={l} />;
}
