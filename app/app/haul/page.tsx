"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store-context";
import { Hydrated } from "@/components/hydrated";
import { HaulCard } from "@/components/haul-card";
import type { HaulPost, HaulReactionEmoji } from "@/lib/types";
import { fetchHaulPage } from "@/app/actions/query";

/* ── Leaderboards strip ──────────────────────────────────────────────────── */

function TrophyCard({
  post,
  emoji,
  label,
  accentClass,
}: {
  post: HaulPost;
  emoji: HaulReactionEmoji;
  label: string;
  accentClass: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 card-lift">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-display font-bold mb-2">
        {label}
      </p>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-semibold text-foreground truncate">
          @{post.proposer.username}
        </span>
        <ArrowRightLeft size={12} className="text-muted-foreground flex-shrink-0" />
        <span className="text-xs font-semibold text-foreground truncate">
          @{post.owner.username}
        </span>
      </div>
      <p
        className={cn(
          "mt-2 font-display font-bold text-lg tracking-tight",
          accentClass,
        )}
      >
        {post.reactionCounts[emoji] ?? 0} {emoji}
      </p>
    </div>
  );
}

function LeaderboardStrip() {
  const store = useStore();
  const { heist, cleanest } = store.haulLeaderboards();
  if (!heist && !cleanest) return null;
  return (
    <section className="px-4 md:px-6 mt-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {heist && (
          <TrophyCard
            post={heist}
            emoji="🏴‍☠️"
            label="🏴‍☠️ Heist of the week"
            accentClass="text-pop"
          />
        )}
        {cleanest && (
          <TrophyCard
            post={cleanest}
            emoji="👏"
            label="👏 Cleanest deal"
            accentClass="text-accent"
          />
        )}
      </div>
    </section>
  );
}

/* ── Feed ────────────────────────────────────────────────────────────────── */

function HaulFeed() {
  const [posts, setPosts] = useState<HaulPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchHaulPage();
      setPosts(page.items);
      setNextCursor(page.nextCursor);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const onInvalidate = (event: Event) => {
      const domains = (event as CustomEvent<{ domains?: string[] }>).detail?.domains;
      if (domains?.includes("haul") || domains?.includes("moderation")) void reload();
    };
    window.addEventListener("poachland:invalidate", onInvalidate);
    return () => window.removeEventListener("poachland:invalidate", onInvalidate);
  }, [reload]);

  if (loading) return <HaulSkeleton />;

  if (posts.length === 0) {
    return (
      <section className="px-4 md:px-6 mt-4">
        <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
          <p className="text-sm font-semibold text-foreground">No hauls yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Complete a deal, then hit &ldquo;Show off this trade&rdquo; to put it
            on the wall.
          </p>
          <Link
            href="/app/trades"
            className="inline-block mt-3 text-xs font-bold text-accent"
          >
            Go to your trades
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 md:px-6 mt-4">
      <div className="flex flex-col gap-4">
        {posts.map((post) => (
          <HaulCard key={post.id} post={post} />
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
      </div>
    </section>
  );
}

/* ── Skeleton fallback ───────────────────────────────────────────────────── */

function HaulSkeleton() {
  return (
    <div className="px-4 md:px-6 mt-4 flex flex-col gap-4 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-surface rounded-2xl h-64" />
      ))}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function HaulFeedPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header — desktop gets "The Haul" from the global TopNav */}
      <header className="md:hidden sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-2">
        <Trophy size={20} className="text-accent" strokeWidth={2.5} />
        <h1 className="font-display font-bold text-xl tracking-tight">
          The Haul
        </h1>
      </header>

      <p className="px-4 md:px-6 mt-4 text-sm text-muted-foreground">
        Completed trades, celebrated by the community.
      </p>

      <Hydrated fallback={<HaulSkeleton />}>
        <LeaderboardStrip />
        <HaulFeed />
      </Hydrated>
    </div>
  );
}
