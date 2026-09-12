"use client";
import { SampleBadge } from "@/components/sample-notice";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useHydrated, useStore } from "@/lib/store-context";
import { Hydrated } from "@/components/hydrated";
import { CONDITION_COLORS, LISTING_TYPE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

// ── Shared button styles ─────────────────────────────────────────────────────

const pillPrimary =
  "inline-flex items-center justify-center gap-2 bg-accent text-accent-foreground text-sm font-semibold rounded-full shadow-sm hover:opacity-90 transition-opacity";

/** Top-bar nav: text link + join pill when signed out, enter pill when signed in. */
function HeaderNav() {
  const store = useStore();
  const ready = useHydrated();
  const signedIn = ready && !!store.sessionMe;
  if (signedIn) {
    return (
      <Link href="/app" className={cn(pillPrimary, "px-5 py-2")}>
        Enter Poachland
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-4">
      <Link
        href="/login"
        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        Log in
      </Link>
      <Link href="/login" className={cn(pillPrimary, "px-5 py-2")}>
        Join free
      </Link>
    </div>
  );
}

/** Posting needs an account; browsing stays public. */
function PostingCta({ wanted = false }: { wanted?: boolean }) {
  const store = useStore();
  const ready = useHydrated();
  const signedIn = ready && !!store.sessionMe;
  return (
    <Link
      href={signedIn ? (wanted ? "/app/wanted/create" : "/app/create") : "/login"}
      className={cn(pillPrimary, "px-5 py-3")}
    >
      {wanted
        ? (signedIn ? "Post a wanted request" : "Join to post a request")
        : (signedIn ? "List your gear" : "Join to list your gear")}
      <ArrowRight size={16} />
    </Link>
  );
}

function CrateStrip() {
  const store = useStore();
  const listings = store.listListings({ sort: "newest" }).slice(0, 8);
  if (listings.length === 0) {
    return (
      <div className="border-l-2 border-accent pl-5 py-2 sm:py-4">
        <h3 className="font-semibold text-lg">Make the first drop.</h3>
        <p className="text-sm text-muted-foreground mt-2 mb-5 max-w-md leading-relaxed">
          The crate is waiting for its first listing. That spare team jersey or
          tournament disc could be another player&apos;s next find.
        </p>
        <PostingCta />
      </div>
    );
  }
  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-5 px-5 lg:grid lg:grid-cols-4 lg:overflow-visible lg:mx-0 lg:px-0 lg:pb-0">
      {listings.map((listing) => (
        <Link
          key={listing.id}
          href={`/l/${listing.id}`}
          className="flex-shrink-0 w-36 lg:w-auto rounded-xl overflow-hidden border border-border bg-card card-lift"
        >
          <div className="relative aspect-square bg-surface">
            {/* plain img: listing photos may be user-uploaded data URLs */}
            <img
              src={listing.photos[0] || "/placeholder.jpg"}
              alt={listing.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <span
              className={cn(
                "absolute top-1.5 left-1.5 badge-stamp bg-background/80 backdrop-blur-sm text-[9px]",
                CONDITION_COLORS[listing.condition],
              )}
            >
              {listing.condition}
            </span>
          </div>
          <div className="p-2.5">
            {listing.sampleBatchId && <div className="mb-1"><SampleBadge /></div>}
            <p className="text-xs font-semibold leading-tight line-clamp-2">
              {listing.title}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center justify-between gap-1">
              <span className="truncate">{listing.team}</span>
              <span className="text-accent font-semibold flex-shrink-0">
                {listing.listingType === "sell" && listing.askingPrice
                  ? `$${listing.askingPrice}`
                  : LISTING_TYPE_LABELS[listing.listingType]}
              </span>
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

function CrateSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-5 px-5 lg:grid lg:grid-cols-4 lg:overflow-visible lg:mx-0 lg:px-0 lg:pb-0">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex-shrink-0 w-36 lg:w-auto rounded-xl overflow-hidden border border-border bg-card"
        >
          <div className="aspect-square bg-secondary animate-pulse" />
          <div className="p-2.5 space-y-1.5">
            <div className="h-3 w-full rounded bg-secondary animate-pulse" />
            <div className="h-2.5 w-2/3 rounded bg-secondary animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function WantedPreview() {
  const store = useStore();
  const posts = store.listISOPosts({ sort: "most-saved" }).slice(0, 3);
  if (posts.length === 0) {
    return (
      <div className="bg-note-surface border border-note-border rounded-sm p-5 sm:p-6">
        <h3 className="font-semibold text-lg">Looking for a particular jersey or disc?</h3>
        <p className="text-sm text-muted-foreground mt-2 mb-5 max-w-md leading-relaxed">
          No requests yet. Start the board with the team, size, or stamp you&apos;re
          after, and let other players know what to look for.
        </p>
        <PostingCta wanted />
      </div>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {posts.map((post) => (
        <Link
          key={post.id}
          href="/wanted"
          className="bg-card border border-border rounded-xl p-4 flex items-start gap-3 card-lift"
        >
          <div className="w-8 h-8 rounded-full overflow-hidden border border-border flex-shrink-0">
            {/* plain img: avatars may be user-uploaded data URLs */}
            <img
              src={post.user.avatar}
              alt={post.user.displayName}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-0.5">
              @{post.user.username}
            </p>
            <p className="text-sm text-foreground leading-snug line-clamp-2">
              ISO: {post.description}
            </p>
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {post.saves} saves
          </span>
        </Link>
      ))}
    </div>
  );
}

function WantedSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="bg-card border border-border rounded-xl p-4 flex items-start gap-3"
        >
          <div className="w-8 h-8 rounded-full bg-secondary animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2 pt-0.5">
            <div className="h-2.5 w-20 rounded bg-secondary animate-pulse" />
            <div className="h-3.5 w-full rounded bg-secondary animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-lg md:max-w-3xl lg:max-w-5xl">
        <header className="flex items-center justify-between gap-3 px-5 py-4">
          <span className="font-display font-black text-xl tracking-tight text-accent">
            Poachland
          </span>
          <HeaderNav />
        </header>

        <main id="main-content" tabIndex={-1}>
          <section className="px-5 pt-8 pb-9 md:pt-14 md:pb-12">
            <p className="text-sm font-medium text-accent mb-3">The ultimate frisbee swap meet</p>
            <h1 className="font-display font-black text-4xl sm:text-5xl md:text-6xl leading-[1.08] tracking-tight max-w-2xl">
              Good gear.<br />
              <span className="text-accent">Next player.</span>
            </h1>
            <div className="mt-5 flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-10">
              <p className="text-muted-foreground text-base leading-relaxed max-w-md">
                Trade jerseys, collect discs, and pass your spare gear to someone
                who&apos;ll play in it. Built by players. Free to list.
              </p>
              <Link href="/browse" className={cn(pillPrimary, "px-6 py-3 self-start md:shrink-0")}>
                Browse the crate <ArrowRight size={16} />
              </Link>
            </div>
          </section>

          <section aria-labelledby="fresh-drops" className="px-5 py-7 md:py-9 border-t border-border">
            <div className="flex items-baseline justify-between gap-4 mb-5">
              <h2 id="fresh-drops" className="font-display font-bold text-2xl tracking-tight">Fresh drops</h2>
              <Link href="/browse" className="text-sm text-accent font-semibold shrink-0 py-2">
                See all
              </Link>
            </div>
            <Hydrated fallback={<CrateSkeleton />}>
              <CrateStrip />
            </Hydrated>
          </section>

          <section aria-labelledby="wanted-board" className="px-5 py-8 md:py-10 border-t border-border">
            <div className="flex items-baseline justify-between gap-4 mb-5">
              <h2 id="wanted-board" className="font-display font-bold text-2xl tracking-tight">The wanted board</h2>
              <Link href="/wanted" className="text-sm text-accent font-semibold shrink-0 py-2">
                View all
              </Link>
            </div>
            <Hydrated fallback={<WantedSkeleton />}>
              <WantedPreview />
            </Hydrated>
          </section>

          <section aria-labelledby="how-trading-works" className="px-5 pt-8 pb-12 border-t border-border md:grid md:grid-cols-[1fr_1.5fr] md:gap-12">
            <div>
              <h2 id="how-trading-works" className="font-display font-bold text-2xl tracking-tight">A trade starts with a conversation.</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mt-3 mb-4">
                Check a player&apos;s ratings and earned badges. Agree on the details
                together, and keep the conversation in Poachland.
              </p>
              <Link href="/buyer-protection" className="text-sm text-accent font-semibold underline underline-offset-4">
                Read the trading safety guide
              </Link>
            </div>
            <ol className="mt-7 md:mt-0 divide-y divide-border">
              {[
                { title: "Put it in the crate", description: "List a jersey or disc to trade, sell, or give away. Hunting for something specific? Post a wanted request and get notified about matches." },
                { title: "Work out a fair swap", description: "Offer gear, add cash, or send a counteroffer. For a free item, the owner chooses who gets it." },
                { title: "Confirm it arrived", description: "Both players confirm delivery to complete the deal. Leave a rating, share your haul, and report a problem if you need help." },
              ].map(({ title, description }, index) => (
                <li key={title} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  <span className="text-accent font-semibold tabular-nums pt-0.5" aria-hidden="true">{index + 1}.</span>
                  <div>
                    <h3 className="text-base font-semibold">{title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-1">{description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </main>

        {/* Footer */}
        <footer className="px-5 pb-10 text-center text-xs text-muted-foreground">
          <div className="flex items-center justify-center gap-x-4 gap-y-1 flex-wrap mb-2">
            <Link href="/browse" className="hover:text-accent transition-colors">Browse</Link>
            <Link href="/wanted" className="hover:text-accent transition-colors">Wanted</Link>
            <Link href="/haul" className="hover:text-accent transition-colors">The Haul</Link>
            <Link href="/shop" className="hover:text-accent transition-colors">Shop</Link>
            <Link href="/traders" className="hover:text-accent transition-colors">Traders</Link>
            <Link href="/terms" className="hover:text-accent transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-accent transition-colors">Privacy</Link>
            <Link href="/accessibility" className="hover:text-accent transition-colors">Accessibility</Link>
          </div>
          Poachland — built by players, for players.
        </footer>
      </div>
    </div>
  );
}
