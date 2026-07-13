"use client";

/**
 * Public browse — the SEO-facing, signed-out-friendly view of /app/browse.
 * Standalone page chrome (no app shell): the shared public header, a warm
 * hero, a lightweight search + filter, and a grid of listing cards that link
 * to the PUBLIC /l/[id] page (not the auth-walled app listing). Data comes
 * from the public store snapshot; a join-funnel card closes the page.
 */

import { useState } from "react";
import Link from "next/link";
import { Package, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHydrated, useStore } from "@/lib/store-context";
import { PublicSiteHeader } from "@/app/u/[username]/public-profile";
import { LISTING_TYPE_COLORS, LISTING_TYPE_LABELS } from "@/lib/constants";
import { money } from "@/lib/format";
import type { ItemType, Listing, ListingType } from "@/lib/types";

const pillPrimary =
  "inline-flex items-center justify-center gap-2 bg-accent text-accent-foreground text-sm font-semibold rounded-full shadow-sm hover:opacity-90 transition-opacity";

const ITEM_TYPE_CHIPS: { value: "all" | ItemType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "jersey", label: "Jerseys" },
  { value: "disc", label: "Discs" },
];

const LISTING_TYPE_CHIPS: { value: "all" | ListingType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "trade", label: "Trade" },
  { value: "sell", label: "Sell" },
  { value: "free", label: "Free" },
];

/* ── Filter pill ─────────────────────────────────────────────────────────── */

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-colors",
        active
          ? "bg-accent text-accent-foreground border-accent shadow-sm"
          : "bg-card text-muted-foreground border-border hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/* ── Hero ────────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <div className="pt-9 pb-6 md:pt-12 md:pb-8 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 text-accent mb-4">
        <Package size={26} />
      </div>
      <h1 className="font-display font-black text-3xl md:text-4xl tracking-tight text-balance">
        The crate
      </h1>
      <p className="text-sm md:text-base text-muted-foreground mt-3 text-balance">
        Jerseys and discs, traded by players who get it.
      </p>
    </div>
  );
}

/* ── Loading state ───────────────────────────────────────────────────────── */

function BrowseSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="bg-card border border-border rounded-lg overflow-hidden"
        >
          <div className="aspect-square bg-surface animate-pulse" />
          <div className="p-3 space-y-2">
            <div className="h-3 w-2/3 bg-surface rounded-sm animate-pulse" />
            <div className="h-2.5 w-1/2 bg-surface rounded-sm animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Listing card (public — links to /l/[id]) ────────────────────────────── */

function priceLabel(l: Listing): { text: string; cls: string } {
  if (
    (l.listingType === "sell" || l.listingType === "trade+cash") &&
    l.askingPrice != null
  ) {
    return { text: money(l.askingPrice), cls: "text-foreground" };
  }
  if (l.listingType === "free") return { text: "Free", cls: "text-pop" };
  return { text: "Trade", cls: "text-accent" };
}

function ListingMiniCard({ listing }: { listing: Listing }) {
  const price = priceLabel(listing);
  return (
    <Link
      href={`/l/${listing.id}`}
      className="group block bg-card rounded-lg overflow-hidden border border-border card-lift"
    >
      <div className="relative aspect-square overflow-hidden bg-surface">
        {/* plain img: listing photos may be data URLs from uploads */}
        <img
          src={listing.photos[0] || "/placeholder.jpg"}
          alt={listing.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute top-2 right-2">
          <span
            className={cn(
              "badge-stamp bg-background/80 backdrop-blur-sm",
              LISTING_TYPE_COLORS[listing.listingType],
            )}
          >
            {LISTING_TYPE_LABELS[listing.listingType]}
          </span>
        </div>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold text-foreground line-clamp-1 leading-tight">
          {listing.title}
        </h3>
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mt-0.5 truncate">
          {listing.team} · {listing.condition}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground truncate">
            @{listing.seller.username}
          </span>
          <span className={cn("text-sm font-bold flex-shrink-0", price.cls)}>
            {price.text}
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────────── */

function EmptyResults() {
  return (
    <div className="py-16 text-center">
      <h2 className="font-display font-bold text-xl tracking-tight mb-1">
        Nothing matches yet.
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        Loosen the filters, or join to post what you&apos;re hunting for.
      </p>
      <Link href="/login" className={cn(pillPrimary, "px-6 py-3")}>
        Join free
      </Link>
    </div>
  );
}

/* ── Bottom join funnel ──────────────────────────────────────────────────── */

function JoinCta() {
  const store = useStore();
  const signedIn = !!store.sessionMe;
  return (
    <section className="pt-2 pb-12">
      <div className="bg-card border border-border rounded-xl p-7 md:p-9 text-center">
        {signedIn ? (
          <>
            <h2 className="font-display font-black text-2xl tracking-tight mb-2 text-balance">
              Ready to make a move?
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              Jump back into Poachland to trade, buy, and save gear.
            </p>
            <Link href="/app/browse" className={cn(pillPrimary, "px-6 py-3")}>
              Enter Poachland
            </Link>
          </>
        ) : (
          <>
            <h2 className="font-display font-black text-2xl tracking-tight mb-2 text-balance">
              Join the swap meet
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              Free — one email. No fees, no middleman.
            </p>
            <Link href="/login" className={cn(pillPrimary, "px-6 py-3")}>
              Join free
            </Link>
          </>
        )}
      </div>
    </section>
  );
}

/* ── Results ─────────────────────────────────────────────────────────────── */

function Results({
  query,
  itemType,
  listingType,
}: {
  query: string;
  itemType: "all" | ItemType;
  listingType: "all" | ListingType;
}) {
  const store = useStore();
  const listings = store.listListings({
    query: query.trim() || undefined,
    itemType,
    listingType,
    sort: "newest",
  });

  if (listings.length === 0) return <EmptyResults />;

  return (
    <>
      <p className="text-xs text-muted-foreground mb-4">
        {listings.length} listing{listings.length !== 1 ? "s" : ""}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {listings.map((l) => (
          <ListingMiniCard key={l.id} listing={l} />
        ))}
      </div>
    </>
  );
}

/* ── Entry ───────────────────────────────────────────────────────────────── */

export function PublicBrowse() {
  const hydrated = useHydrated();
  const [query, setQuery] = useState("");
  const [itemType, setItemType] = useState<"all" | ItemType>("all");
  const [listingType, setListingType] = useState<"all" | ListingType>("all");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicSiteHeader />
      <main
        id="main-content"
        className="mx-auto max-w-lg md:max-w-3xl lg:max-w-4xl px-4 md:px-6 pb-12"
      >
        <Hero />

        {/* Search + filters */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2 bg-card rounded-full px-4 py-2.5 border border-border">
            <Search size={16} className="text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search teams, items, tags..."
              aria-label="Search listings"
              className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
              >
                <X
                  size={14}
                  className="text-muted-foreground hover:text-foreground"
                />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {ITEM_TYPE_CHIPS.map((c) => (
              <Pill
                key={c.value}
                active={itemType === c.value}
                onClick={() => setItemType(c.value)}
              >
                {c.label}
              </Pill>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {LISTING_TYPE_CHIPS.map((c) => (
              <Pill
                key={c.value}
                active={listingType === c.value}
                onClick={() => setListingType(c.value)}
              >
                {c.label}
              </Pill>
            ))}
          </div>
        </div>

        {!hydrated ? (
          <BrowseSkeleton />
        ) : (
          <>
            <Results
              query={query}
              itemType={itemType}
              listingType={listingType}
            />
            <div className="mt-4">
              <JoinCta />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
