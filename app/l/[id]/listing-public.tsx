"use client";

/**
 * Public listing page — the SEO-facing, signed-out-friendly version of
 * /app/listings/[id]. Standalone page chrome (no app shell): the shared
 * wordmark header with a join CTA, the listing body, and a context-aware
 * call-to-action. Data comes from the public store snapshot (the bootstrap
 * ships every non-removed listing by a visible seller, so signed-out works).
 */

import Link from "next/link";
import { BadgeCheck, ChevronRight, MapPin, PackageX } from "lucide-react";
import { PhotoGallery } from "@/components/photo-gallery";
import { PublicSiteHeader } from "@/app/u/[username]/public-profile";
import { TrustScore } from "@/components/trust-badge";
import {
  CONDITION_COLORS,
  LISTING_TYPE_COLORS,
  LISTING_TYPE_LABELS,
} from "@/lib/constants";
import { money } from "@/lib/format";
import { useHydrated, useStore } from "@/lib/store-context";
import type { Listing, ShippingPreference } from "@/lib/types";
import { cn } from "@/lib/utils";

const pillPrimary =
  "inline-flex items-center justify-center gap-2 bg-accent text-accent-foreground text-sm font-semibold rounded-full shadow-sm hover:opacity-90 transition-opacity";

const SHIPPING_LABELS: Record<ShippingPreference, string> = {
  "seller-pays": "Ships free",
  "buyer-pays": "Buyer pays shipping",
  "local-only": "Local pickup only",
};

/** Muted "no longer active" copy, or null for active listings. */
function statusBanner(status: Listing["status"]): string | null {
  if (status === "pending") return "Deal pending";
  if (status === "traded" || status === "sold" || status === "claimed") {
    return "This item is no longer available";
  }
  return null;
}

/* ── Loading / unavailable states ────────────────────────────────────────── */

function ListingSkeleton() {
  return (
    <div className="pt-6 space-y-5 animate-pulse">
      <div className="aspect-[4/3] bg-surface rounded-2xl" />
      <div className="space-y-3">
        <div className="h-7 w-3/4 bg-surface rounded" />
        <div className="flex gap-2">
          <div className="h-6 w-20 bg-surface rounded" />
          <div className="h-6 w-24 bg-surface rounded" />
        </div>
        <div className="h-9 w-28 bg-surface rounded" />
        <div className="h-24 w-full bg-surface rounded-xl" />
      </div>
    </div>
  );
}

function Unavailable() {
  return (
    <div className="py-24 text-center">
      <PackageX size={28} className="mx-auto text-muted-foreground mb-3" />
      <h1 className="font-display font-bold text-2xl tracking-tight mb-1">
        This listing isn&apos;t available
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        It may have been removed or is no longer public.
      </p>
      <div className="flex items-center justify-center gap-5">
        <Link href="/app/browse" className="text-accent text-sm font-semibold">
          Browse other gear →
        </Link>
        <Link
          href="/"
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Home
        </Link>
      </div>
    </div>
  );
}

/* ── Listing body ────────────────────────────────────────────────────────── */

function ListingBody({ listing }: { listing: Listing }) {
  const store = useStore();
  const signedIn = !!store.sessionMe;
  const seller = listing.seller;
  const banner = statusBanner(listing.status);
  const hasPrice =
    (listing.listingType === "sell" || listing.listingType === "trade+cash") &&
    listing.askingPrice != null;
  const wantsTrade =
    listing.listingType === "trade" || listing.listingType === "trade+cash";

  return (
    <div className="pt-6">
      {/* Photos */}
      <div className="rounded-2xl overflow-hidden border border-border bg-surface">
        <PhotoGallery photos={listing.photos} alt={listing.title} />
      </div>

      {/* Title */}
      <h1 className="font-display font-bold text-2xl tracking-tight mt-5">
        {listing.title}
      </h1>

      {/* Stamp chips + item/team */}
      <div className="flex items-center gap-2 flex-wrap mt-3">
        <span
          className={cn("badge-stamp", LISTING_TYPE_COLORS[listing.listingType])}
        >
          {LISTING_TYPE_LABELS[listing.listingType]}
        </span>
        <span className={cn("badge-stamp", CONDITION_COLORS[listing.condition])}>
          {listing.condition}
        </span>
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
          {listing.type} · {listing.team}
        </span>
      </div>

      {/* Price / trade line */}
      <div className="mt-4">
        {hasPrice ? (
          <p className="font-display font-bold text-3xl text-foreground">
            {money(listing.askingPrice!)}
            {listing.listingType === "trade+cash" && (
              <span className="ml-2 align-middle text-sm font-semibold text-accent">
                or trade
              </span>
            )}
          </p>
        ) : listing.listingType === "free" ? (
          <p className="font-display font-bold text-2xl text-pop">Free</p>
        ) : (
          <p className="font-display font-bold text-xl text-accent">
            Open to trades
          </p>
        )}
        {wantsTrade && listing.tradeFor && (
          <p className="text-sm text-muted-foreground mt-2">
            <span className="font-semibold text-foreground">Looking for:</span>{" "}
            {listing.tradeFor}
          </p>
        )}
      </div>

      {/* Facts */}
      <div className="flex items-center gap-2 flex-wrap mt-4">
        {listing.year && (
          <span className="badge-stamp text-muted-foreground border-border">
            {listing.year}
          </span>
        )}
        {listing.size && (
          <span className="badge-stamp text-muted-foreground border-border">
            Size {listing.size}
          </span>
        )}
        {listing.division && (
          <span className="badge-stamp text-muted-foreground border-border">
            {listing.division}
          </span>
        )}
        <span className="badge-stamp text-muted-foreground border-border">
          {listing.level}
        </span>
        <span className="badge-stamp text-muted-foreground border-border">
          {SHIPPING_LABELS[listing.shippingPreference]}
        </span>
      </div>

      {/* Description */}
      {listing.description && (
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words mt-5">
          {listing.description}
        </p>
      )}

      {/* Tags */}
      {listing.tags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mt-4">
          {listing.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs text-muted-foreground bg-card px-2.5 py-0.5 rounded-full border border-border"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Status banner */}
      {banner && (
        <div className="mt-5 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground text-center">
          {banner}
        </div>
      )}

      {/* Seller card */}
      <div className="mt-6 border-t border-border pt-5">
        <h2 className="font-display font-bold text-xs uppercase tracking-widest text-muted-foreground mb-3">
          Seller
        </h2>
        <Link
          href={`/u/${seller.username}`}
          className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border card-lift"
        >
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-border flex-shrink-0">
            {/* plain img: avatars may be data URLs */}
            <img
              src={seller.avatar}
              alt={seller.displayName}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-semibold text-sm">{seller.displayName}</p>
              {seller.isVerified && (
                <BadgeCheck size={14} className="text-accent flex-shrink-0" />
              )}
              <p className="text-xs text-muted-foreground">@{seller.username}</p>
            </div>
            <div className="mt-1">
              <TrustScore
                score={seller.trustScore}
                trades={seller.tradesCompleted}
                size="sm"
              />
            </div>
            {seller.location && (
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <MapPin size={11} /> {seller.location}
              </p>
            )}
          </div>
          <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
        </Link>
      </div>

      {/* CTA */}
      <div className="mt-6 bg-card border border-border rounded-xl p-6 md:p-8 text-center">
        {signedIn ? (
          <div className="flex flex-col items-center gap-3">
            <Link
              href={`/app/listings/${listing.id}`}
              className={cn(pillPrimary, "px-6 py-3")}
            >
              Open in Poachland
            </Link>
            <Link
              href={`/app/listings/${listing.id}`}
              className="text-sm font-semibold text-accent hover:opacity-80 transition-opacity"
            >
              Message the seller
            </Link>
          </div>
        ) : (
          <>
            <Link href="/login" className={cn(pillPrimary, "px-6 py-3")}>
              Join free to trade
            </Link>
            <p className="text-xs text-muted-foreground mt-3">
              It&apos;s free — one email. No fees, no middleman.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Entry ───────────────────────────────────────────────────────────────── */

export function PublicListingView({ id }: { id: string }) {
  const store = useStore();
  const hydrated = useHydrated();
  const listing = hydrated ? store.getListing(id) : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicSiteHeader />
      <main id="main-content" className="mx-auto max-w-lg md:max-w-3xl lg:max-w-4xl px-4 md:px-6 pb-12">
        {!hydrated ? (
          <ListingSkeleton />
        ) : listing ? (
          <ListingBody listing={listing} />
        ) : (
          <Unavailable />
        )}
      </main>
    </div>
  );
}
