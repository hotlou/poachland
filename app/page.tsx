"use client";

import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowRight,
  Flag,
  Gift,
  Handshake,
  Radar,
  ShieldCheck,
} from "lucide-react";
import { useHydrated, useStore } from "@/lib/store-context";
import { Hydrated } from "@/components/hydrated";
import { CONDITION_COLORS, LISTING_TYPE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

// ── Shared button styles ─────────────────────────────────────────────────────

const pillPrimary =
  "inline-flex items-center justify-center gap-2 bg-accent text-accent-foreground text-sm font-semibold rounded-full shadow-sm hover:opacity-90 transition-opacity";
const pillSecondary =
  "inline-flex items-center justify-center gap-2 bg-card text-foreground border border-border text-sm font-semibold rounded-full shadow-sm hover:border-accent/50 hover:text-accent transition-colors";

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

/** Primary CTA: joins/signs in when logged out, enters the app when logged in. */
function PrimaryCta({ className }: { className: string }) {
  const store = useStore();
  const ready = useHydrated();
  const signedIn = ready && !!store.sessionMe;
  return (
    <Link href={signedIn ? "/app" : "/login"} className={className}>
      Start poaching <ArrowRight size={16} />
    </Link>
  );
}

// ── Live sections (rendered only after hydration) ────────────────────────────

function StatsStrip() {
  const store = useStore();
  const stats = store.adminStats();
  const items = [
    { label: "Collectors", value: String(stats.users) },
    { label: "Active listings", value: String(stats.activeListings) },
    { label: "Trades completed", value: String(stats.dealsCompleted) },
    { label: "Fees", value: "$0" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-6">
      {items.map(({ label, value }) => (
        <div key={label} className="flex flex-col items-center text-center">
          <span className="font-display font-black text-3xl tracking-tight leading-none">
            {value}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mt-2">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-6">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col items-center gap-2.5">
          <div className="h-7 w-10 rounded bg-secondary animate-pulse" />
          <div className="h-2.5 w-14 rounded bg-secondary animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function CrateStrip() {
  const store = useStore();
  const listings = store.listListings({ sort: "newest" }).slice(0, 8);
  if (listings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-xl">
        Crate&apos;s empty. Be the first to poach it.
      </p>
    );
  }
  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-5 px-5 lg:grid lg:grid-cols-4 lg:overflow-visible lg:mx-0 lg:px-0 lg:pb-0">
      {listings.map((listing) => (
        <Link
          key={listing.id}
          href={`/app/listings/${listing.id}`}
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
      <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-xl">
        No hunts posted yet. Be the first to poach it.
      </p>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {posts.map((post) => (
        <Link
          key={post.id}
          href="/app/wanted"
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

function TraderCountLine() {
  const store = useStore();
  const { users } = store.adminStats();
  return (
    <p className="text-muted-foreground text-sm mb-6">
      Join {users} traders who actually care about this stuff.
    </p>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-lg md:max-w-3xl lg:max-w-4xl">
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4">
          <span className="font-display font-black text-xl tracking-tight text-accent">
            Poachland
          </span>
          <HeaderNav />
        </header>

        {/* Hero */}
        <section className="px-5 pt-12 pb-10 md:pt-16">
          <div className="max-w-2xl mx-auto text-center">
            <div className="flex items-center justify-center gap-2 mb-6">
              <span className="badge-stamp text-accent border-accent">
                Ultimate frisbee only
              </span>
              <span className="badge-stamp text-pop border-pop">
                Free to list
              </span>
            </div>
            <h1 className="font-display font-black text-5xl md:text-6xl leading-[1.05] tracking-tight mb-5">
              Trade jerseys.
              <br />
              <span className="text-accent">Collect discs.</span>
              <br />
              Trust each other.
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed mb-8 text-pretty max-w-md mx-auto">
              A marketplace built by players, for players. List your gear, find
              rare stuff, propose trades. No fees, no middleman.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <PrimaryCta className={cn(pillPrimary, "px-6 py-3")} />
              <Link
                href="/app/browse"
                className={cn(pillSecondary, "px-6 py-3")}
              >
                Browse the crate
              </Link>
            </div>
          </div>
        </section>

        {/* Live stats under a hairline */}
        <section className="px-5">
          <div className="border-t border-border pt-7 pb-9">
            <Hydrated fallback={<StatsSkeleton />}>
              <StatsStrip />
            </Hydrated>
          </div>
        </section>

        {/* Fresh drops — live newest listings */}
        <section className="px-5 py-8 border-t border-border">
          <div className="flex items-end justify-between mb-5">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">
                What&apos;s in the crate
              </p>
              <div className="flex items-center gap-2.5">
                <h2 className="font-display font-bold text-2xl tracking-tight">
                  Fresh drops
                </h2>
                <span className="badge-pill bg-sunny text-sunny-foreground">
                  rare finds daily
                </span>
              </div>
            </div>
            <Link
              href="/app/browse"
              className="text-sm text-accent font-semibold flex-shrink-0 pb-1"
            >
              See all
            </Link>
          </div>
          <Hydrated fallback={<CrateSkeleton />}>
            <CrateStrip />
          </Hydrated>
        </section>

        {/* Features */}
        <section className="px-5 py-9 border-t border-border">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">
            How it works
          </p>
          <h2 className="font-display font-bold text-2xl tracking-tight mb-6">
            Built for the community
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              {
                icon: ArrowLeftRight,
                title: "Multi-round negotiation",
                desc: "Offer items, sweeten with cash, counter until it's fair. Every deal is a conversation, not a checkout.",
              },
              {
                icon: Gift,
                title: "Free-item claims",
                desc: "Clearing out the closet? Post it free and pick which teammate-in-spirit gets it.",
              },
              {
                icon: Radar,
                title: "Wanted board with auto-matching",
                desc: "Post an ISO and get pinged the second a matching listing hits the crate.",
              },
              {
                icon: ShieldCheck,
                title: "Trust scores & earned badges",
                desc: "Every completed deal gets rated. Scores and badges are public — and earned, never bought.",
              },
              {
                icon: Handshake,
                title: "Both-sides confirmation",
                desc: "A deal only completes when both traders confirm their end arrived. No ghosting.",
              },
              {
                icon: Flag,
                title: "Community moderation",
                desc: "Report shady listings, dispute bad deals. Mods keep the land clean.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="bg-card border border-border rounded-xl p-4 md:p-5 flex gap-4 items-start md:flex-col md:gap-3.5"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent-dim flex items-center justify-center">
                  <Icon size={19} className="text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-0.5">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Wanted board preview */}
        <section className="px-5 py-9 border-t border-border">
          <div className="flex items-end justify-between mb-5">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">
                The hunt is on
              </p>
              <h2 className="font-display font-bold text-2xl tracking-tight">
                The wanted board
              </h2>
            </div>
            <Link
              href="/app/wanted"
              className="text-sm text-accent font-semibold flex-shrink-0 pb-1"
            >
              View all
            </Link>
          </div>
          <Hydrated fallback={<WantedSkeleton />}>
            <WantedPreview />
          </Hydrated>
        </section>

        {/* CTA footer */}
        <section className="px-5 pt-9 pb-12 border-t border-border">
          <div className="bg-card border border-border rounded-xl p-7 md:p-10 text-center">
            <h2 className="font-display font-black text-3xl tracking-tight mb-2 text-balance">
              What are you hunting?
            </h2>
            <Hydrated
              fallback={
                <p className="text-muted-foreground text-sm mb-6">
                  Join the traders who actually care about this stuff.
                </p>
              }
            >
              <TraderCountLine />
            </Hydrated>
            <div className="flex flex-col items-center gap-3">
              <PrimaryCta className={cn(pillPrimary, "px-6 py-3")} />
              <Link
                href="/app"
                className="text-xs text-muted-foreground hover:text-accent underline underline-offset-4 transition-colors"
              >
                Browse the crate first
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-5 pb-10 text-center text-xs text-muted-foreground">
          <div className="flex items-center justify-center gap-4 mb-2">
            <Link href="/haul" className="hover:text-accent transition-colors">The Haul</Link>
            <Link href="/traders" className="hover:text-accent transition-colors">Traders</Link>
            <Link href="/terms" className="hover:text-accent transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-accent transition-colors">Privacy</Link>
          </div>
          Poachland — built by players, for players.
        </footer>
      </div>
    </div>
  );
}
