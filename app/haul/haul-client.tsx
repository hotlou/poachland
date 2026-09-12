"use client";

/**
 * Public The Haul — the SEO-facing, signed-out-friendly view of /app/haul.
 * Standalone page chrome (no app shell): the shared public header, a warm
 * hero, the community wall of completed trades, and a join-funnel card at the
 * bottom. Data comes from the public store snapshot (the bootstrap ships
 * public haul posts with me:null when signed out); signed-out reaction and
 * comment taps route to /login via the card's readOnly mode.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHydrated, useStore } from "@/lib/store-context";
import { HaulCard } from "@/components/haul-card";
import { PublicSiteHeader } from "@/app/u/[username]/public-profile";
import type { HaulPost } from "@/lib/types";
import { fetchHaulPage } from "@/app/actions/query";

const pillPrimary =
  "inline-flex items-center justify-center gap-2 bg-accent text-accent-foreground text-sm font-semibold rounded-full shadow-sm hover:opacity-90 transition-opacity";

/* ── Hero ────────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <div className="pt-9 pb-7 md:pt-12 md:pb-9 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 text-accent mb-4">
        <Trophy size={28} />
      </div>
      <h1 className="font-display font-black text-4xl md:text-5xl tracking-tight text-balance">
        The Haul
      </h1>
      <p className="text-sm md:text-base text-muted-foreground mt-3 text-balance">
        Real trades. Real players. Celebrated by the community.
      </p>
    </div>
  );
}

/* ── Loading state ───────────────────────────────────────────────────────── */

function HaulSkeleton() {
  return (
    <div className="flex flex-col gap-4 pb-8">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-surface rounded-2xl h-64 animate-pulse" />
      ))}
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────────── */

function EmptyWall() {
  return (
    <div className="py-16 text-center">
      <h2 className="font-display font-bold text-xl tracking-tight mb-1">
        No hauls on the wall yet.
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        Completed trades belong here. Find your next jersey or disc to get started.
      </p>
      <Link href="/browse" className={cn(pillPrimary, "px-6 py-3")}>
        Browse the crate
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
              Ready to add to the wall?
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              Jump back into Poachland to trade and share your haul.
            </p>
            <Link href="/app/haul" className={cn(pillPrimary, "px-6 py-3")}>
              Enter Poachland
            </Link>
          </>
        ) : (
          <>
            <h2 className="font-display font-black text-2xl tracking-tight mb-2 text-balance">
              Join the swap meet
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              Trade jerseys, collect discs, build trust. Free — one email.
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

/* ── Wall ────────────────────────────────────────────────────────────────── */

function Wall() {
  const store = useStore();
  const [posts, setPosts] = useState<HaulPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => {
    void fetchHaulPage().then((page) => {
      setPosts(page.items);
      setNextCursor(page.nextCursor);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <HaulSkeleton />;

  if (posts.length === 0) return <EmptyWall />;

  return (
    <div className="flex flex-col gap-4 pb-2">
      {posts.map((p) => (
        <HaulCard
          key={p.id}
          post={p}
          profileHrefBase="/u"
          readOnly={!store.sessionMe}
        />
      ))}
      {nextCursor && (
        <button
          type="button"
          disabled={loadingMore}
          onClick={() => {
            setLoadingMore(true);
            void fetchHaulPage(nextCursor).then((page) => {
              setPosts((current) => [...current, ...page.items.filter((item) => !current.some((seen) => seen.id === item.id))]);
              setNextCursor(page.nextCursor);
            }).finally(() => setLoadingMore(false));
          }}
          className="self-center rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
      <JoinCta />
    </div>
  );
}

/* ── Entry ───────────────────────────────────────────────────────────────── */

export function PublicHaul() {
  const hydrated = useHydrated();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicSiteHeader />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-lg md:max-w-3xl lg:max-w-4xl px-4 md:px-6">
        <Hero />
        {!hydrated ? (
          <HaulSkeleton />
        ) : (
          <Wall />
        )}
      </main>
    </div>
  );
}
