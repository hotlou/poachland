"use client";

import Link from "next/link";
import {
  Bell,
  ChevronRight,
  Flame,
  Handshake,
  Pin,
  Star,
  TrendingUp,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import { money } from "@/lib/format";
import { useStore } from "@/lib/store-context";
import { Hydrated } from "@/components/hydrated";
import { ListingCard } from "@/components/listing-card";
import { TrustBadge, TrustScore } from "@/components/trust-badge";
import type { Deal } from "@/lib/types";

/* ── Header bell with unread dot ─────────────────────────────────────────── */

function NotificationBell() {
  const store = useStore();
  const unread = store.unreadNotificationCount();
  return (
    <Link
      href="/app/notifications"
      aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
      className="relative text-muted-foreground hover:text-foreground transition-colors"
    >
      <Bell size={20} />
      {unread > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center leading-none">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

function HeaderAvatar() {
  const store = useStore();
  const me = store.requireUser();
  return (
    <Link href={`/app/u/${me.username}`} aria-label="My profile">
      <div className="w-8 h-8 rounded-full overflow-hidden border border-border">
        <img
          src={me.avatar}
          alt={me.displayName}
          width={32}
          height={32}
          className="object-cover w-full h-full"
        />
      </div>
    </Link>
  );
}

/* ── "Your move" strip ───────────────────────────────────────────────────── */

type MoveKind = "respond" | "track" | "rate";

interface MoveCard {
  key: string;
  kind: MoveKind;
  deal: Deal;
}

const MOVE_LABELS: Record<MoveKind, string> = {
  respond: "Your call",
  track: "In progress",
  rate: "Deal done",
};

const MOVE_CTAS: Record<MoveKind, string> = {
  respond: "Respond",
  track: "Track deal",
  rate: "Rate",
};

function YourMoveStrip() {
  const store = useStore();
  const me = store.requireUser();

  const cards: MoveCard[] = [
    ...store
      .dealsAwaitingResponse(me.id)
      .map((deal): MoveCard => ({ key: `respond-${deal.id}`, kind: "respond", deal })),
    ...store
      .dealsForUser(me.id, { statuses: ["accepted"] })
      .map((deal): MoveCard => ({ key: `track-${deal.id}`, kind: "track", deal })),
    ...store
      .pendingRatings(me.id)
      .map((deal): MoveCard => ({ key: `rate-${deal.id}`, kind: "rate", deal })),
  ];

  if (cards.length === 0) return null;

  return (
    <section className="mt-4">
      <div className="px-4 flex items-center gap-1.5 mb-2">
        <Zap size={15} className="text-accent" />
        <h2 className="font-display font-bold text-base tracking-tight">
          Your move
        </h2>
        <span className="badge-stamp text-accent border-accent ml-1">
          {cards.length}
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 px-4 snap-x">
        {cards.map(({ key, kind, deal }) => {
          const other = deal.proposerId === me.id ? deal.owner : deal.proposer;
          const body =
            kind === "respond"
              ? store.describeOffer(deal, deal.currentOffer)
              : kind === "track"
                ? `Deal agreed on "${deal.listing.title}". Arrange shipping and confirm when it lands.`
                : `Your deal with @${other.username} is complete. Leave a rating to build trust.`;
          const cta =
            kind === "rate" ? `Rate @${other.username}` : MOVE_CTAS[kind];
          return (
            <Link
              key={key}
              href={`/app/trades/${deal.id}`}
              className={cn(
                "snap-start flex-shrink-0 w-64 rounded-xl bg-card p-3 card-lift border border-border border-l-4",
                kind === "respond" && "border-l-accent",
                kind === "track" && "border-l-accent/40",
                kind === "rate" && "border-l-amber-600 dark:border-l-yellow-400",
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded overflow-hidden bg-surface border border-border flex-shrink-0">
                  <img
                    src={deal.listing.photos[0] || "/placeholder.jpg"}
                    alt={deal.listing.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "badge-stamp",
                      kind === "rate"
                        ? "text-amber-700 border-amber-700 dark:text-yellow-400 dark:border-yellow-400"
                        : "text-accent border-accent",
                    )}
                  >
                    {MOVE_LABELS[kind]}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    @{other.username}
                  </p>
                </div>
              </div>
              <p className="text-xs text-foreground leading-snug line-clamp-2 min-h-8">
                {body}
              </p>
              <p className="mt-2 text-xs font-bold text-accent flex items-center gap-0.5">
                {cta} <ChevronRight size={12} />
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ── Hot right now ───────────────────────────────────────────────────────── */

function HotRightNow() {
  const store = useStore();
  const featured = store.featuredListings();
  if (featured.length === 0) return null;
  return (
    <section className="mt-6">
      <div className="px-4 flex items-center justify-between mb-3">
        <h2 className="font-display font-bold text-lg tracking-tight flex items-center gap-1.5">
          <Flame size={16} className="text-accent" /> Hot right now
        </h2>
        <Link
          href="/app/browse"
          className="text-xs text-accent font-semibold flex items-center gap-0.5"
        >
          See all <ChevronRight size={12} />
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 px-4 snap-x">
        {featured.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            className="snap-start flex-shrink-0 w-60"
          />
        ))}
      </div>
    </section>
  );
}

/* ── Fresh drops ─────────────────────────────────────────────────────────── */

function FreshDrops() {
  const store = useStore();
  const latest = store.listListings({ sort: "newest" }).slice(0, 8);
  return (
    <section className="px-4 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-bold text-lg tracking-tight">
          Fresh drops
        </h2>
        <Link
          href="/app/browse"
          className="text-xs text-accent font-semibold flex items-center gap-0.5"
        >
          See all <ChevronRight size={12} />
        </Link>
      </div>
      {latest.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing here yet. Be the first to poach it.
          </p>
          <Link
            href="/app/create"
            className="inline-block mt-3 px-5 py-2 rounded-full bg-accent text-accent-foreground text-xs font-bold"
          >
            List something
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {latest.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Activity timeline ───────────────────────────────────────────────────── */

function ActivityTimeline() {
  const store = useStore();
  const events = store.listActivity(8);
  return (
    <section className="px-4 mt-6">
      <div className="flex items-center gap-1.5 mb-3">
        <TrendingUp size={16} className="text-accent" />
        <h2 className="font-display font-bold text-lg tracking-tight">
          Around the fields
        </h2>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          All quiet on the sideline. Check back soon.
        </p>
      ) : (
        <div className="flex flex-col">
          {events.map((event) => {
            const inner = (
              <>
                {event.actor && (
                  <div className="w-6 h-6 rounded-full overflow-hidden border border-border flex-shrink-0">
                    <img
                      src={event.actor.avatar}
                      alt={event.actor.username}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <p className="text-xs text-foreground/90 flex-1 leading-relaxed min-w-0">
                  {event.summary}
                </p>
                <span className="text-[11px] text-muted-foreground flex-shrink-0">
                  {timeAgo(event.createdAt)}
                </span>
              </>
            );
            const rowClass =
              "flex items-center gap-2.5 py-2.5 pl-3 border-l-2 border-accent/50 hover:border-accent transition-colors";
            return event.linkTo ? (
              <Link key={event.id} href={event.linkTo} className={rowClass}>
                {inner}
              </Link>
            ) : (
              <div key={event.id} className={rowClass}>
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ── Wanted board preview ────────────────────────────────────────────────── */

function WantedPreview() {
  const store = useStore();
  const posts = store.listISOPosts({ sort: "newest" }).slice(0, 3);
  return (
    <section className="px-4 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-bold text-lg tracking-tight flex items-center gap-1.5">
          <Pin size={15} className="text-accent" /> Wanted board
        </h2>
        <Link
          href="/app/wanted"
          className="text-xs text-accent font-semibold flex items-center gap-0.5"
        >
          See the board <ChevronRight size={12} />
        </Link>
      </div>
      {posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No active hunts. Post what you&apos;re chasing.
          </p>
          <Link
            href="/app/wanted"
            className="inline-block mt-3 text-xs font-bold text-accent"
          >
            Start a hunt
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post, i) => (
            <Link
              key={post.id}
              href="/app/wanted"
              className={cn(
                "relative block bg-[#fdf6e3] border border-amber-200/70 dark:bg-[#1a1a18] dark:border-border rounded-sm p-3.5 card-lift",
                i % 2 === 0 ? "rotate-[0.6deg]" : "-rotate-[0.6deg]",
              )}
            >
              <Pin
                size={14}
                className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-pop rotate-[30deg]"
              />
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-border flex-shrink-0">
                  <img
                    src={post.user.avatar}
                    alt={post.user.username}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs text-muted-foreground">
                      @{post.user.username}
                    </span>
                    <span className="badge-stamp text-muted-foreground border-border">
                      ISO {post.itemType}
                    </span>
                  </div>
                  <p className="text-sm leading-snug line-clamp-2">
                    {post.description}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    {post.team ? `${post.team} · ` : ""}
                    {post.maxPrice ? `up to ${money(post.maxPrice)} · ` : ""}
                    {post.saves} save{post.saves === 1 ? "" : "s"} ·{" "}
                    {timeAgo(post.createdAt)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Trader spotlight ────────────────────────────────────────────────────── */

function TraderSpotlight() {
  const store = useStore();
  const me = store.requireUser();
  const spotlight = store
    .listUsers()
    .filter((u) => u.id !== me.id && !store.isBlockedPair(me.id, u.id))
    .sort((a, b) => b.trustScore - a.trustScore || b.tradesCompleted - a.tradesCompleted)[0];
  if (!spotlight) return null;
  return (
    <section className="px-4 mt-6 mb-6">
      <Link
        href={`/app/u/${spotlight.username}`}
        className="block bg-card border border-border rounded-xl p-4 card-lift"
      >
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-display font-bold mb-3 flex items-center gap-1.5">
          <Star size={12} className="text-accent" /> Trader spotlight
        </p>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2 border-accent">
            <img
              src={spotlight.avatar}
              alt={spotlight.displayName}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-semibold text-sm">{spotlight.displayName}</p>
              <span className="text-xs text-muted-foreground">
                @{spotlight.username}
              </span>
            </div>
            <TrustScore
              score={spotlight.trustScore}
              trades={spotlight.tradesCompleted}
              size="sm"
            />
            {spotlight.bio && (
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                {spotlight.bio}
              </p>
            )}
            {spotlight.badges.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {spotlight.badges.slice(0, 4).map((b) => (
                  <TrustBadge key={b.id} badge={b} size="sm" />
                ))}
              </div>
            )}
          </div>
          <ChevronRight
            size={16}
            className="text-muted-foreground flex-shrink-0 mt-1"
          />
        </div>
      </Link>
    </section>
  );
}

/* ── Skeleton fallback ───────────────────────────────────────────────────── */

function HomeSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex gap-3 overflow-hidden px-4 mt-6">
        {[0, 1].map((i) => (
          <div key={i} className="flex-shrink-0 w-60 space-y-2">
            <div className="aspect-[4/3] bg-surface rounded-xl" />
            <div className="h-3 bg-surface rounded w-3/4" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 px-4 mt-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="aspect-[4/3] bg-surface rounded-xl" />
            <div className="h-3 bg-surface rounded w-2/3" />
          </div>
        ))}
      </div>
      <div className="px-4 mt-6 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 bg-surface rounded" />
        ))}
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function HomeFeedPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between">
        <Link
          href="/app"
          className="font-display font-black text-xl uppercase tracking-tight text-accent flex items-center gap-1.5"
        >
          <Handshake size={20} strokeWidth={2.5} />
          Poachland
        </Link>
        <div className="flex items-center gap-4">
          <Hydrated
            fallback={
              <span className="relative text-muted-foreground">
                <Bell size={20} />
              </span>
            }
          >
            <NotificationBell />
          </Hydrated>
          <Hydrated
            fallback={<div className="w-8 h-8 rounded-full bg-surface border border-border" />}
          >
            <HeaderAvatar />
          </Hydrated>
        </div>
      </header>

      <Hydrated fallback={<HomeSkeleton />}>
        <YourMoveStrip />
        <HotRightNow />
        <FreshDrops />
        <ActivityTimeline />
        <WantedPreview />
        <TraderSpotlight />
      </Hydrated>
    </div>
  );
}
