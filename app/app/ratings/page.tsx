"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  MessageSquare,
  Package,
  Star,
  ThumbsUp,
  Truck,
} from "lucide-react";
import { Hydrated } from "@/components/hydrated";
import { TrustBadge, TrustScore } from "@/components/trust-badge";
import { useStore } from "@/lib/store-context";
import type { HydratedRating } from "@/lib/types";
import { formatDate, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tab = "received" | "given";

function StarRow({ value, size = 12 }: { value: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          className={
            s <= Math.round(value)
              ? "fill-amber-500 text-amber-500 dark:fill-yellow-400 dark:text-yellow-400"
              : "fill-transparent text-muted-foreground"
          }
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

function DimensionBar({
  label,
  icon: Icon,
  value,
  suffix = "",
  max = 5,
}: {
  label: string;
  icon: React.ElementType;
  value: number;
  suffix?: string;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon size={14} className="text-muted-foreground flex-shrink-0" />
      <span className="text-xs text-muted-foreground w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all"
          style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
        />
      </div>
      <span className="text-xs font-semibold w-9 text-right tabular-nums">
        {suffix ? `${value}${suffix}` : value.toFixed(1)}
      </span>
    </div>
  );
}

function RatingRow({ rating, tab }: { rating: HydratedRating; tab: Tab }) {
  // Received tab shows who rated me; Given tab shows who I rated.
  const person = tab === "received" ? rating.fromUser : rating.toUser;
  const overall =
    (rating.communication + rating.shippingSpeed + rating.itemAccuracy) / 3;
  const listingTitle = rating.deal?.listing?.title;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <Link
          href={`/app/u/${person.username}`}
          className="flex items-center gap-2 min-w-0"
        >
          <span className="w-7 h-7 rounded-full overflow-hidden border border-border flex-shrink-0">
            {/* plain img: avatars may be data URLs */}
            <img
              src={person.avatar}
              alt={person.username}
              className="object-cover w-full h-full"
            />
          </span>
          <span className="text-sm font-medium truncate">
            {tab === "given" && (
              <span className="text-muted-foreground font-normal">to </span>
            )}
            @{person.username}
          </span>
        </Link>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <StarRow value={overall} />
          <span className="text-xs font-semibold tabular-nums">{overall.toFixed(1)}</span>
        </div>
      </div>

      {listingTitle && (
        <p className="text-xs text-muted-foreground mb-2 border-l-2 border-accent/30 pl-2 italic truncate">
          {listingTitle}
        </p>
      )}

      {rating.comment && (
        <p className="text-sm leading-relaxed">&ldquo;{rating.comment}&rdquo;</p>
      )}

      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1">
          <MessageSquare size={10} /> {rating.communication}/5
        </span>
        <span className="flex items-center gap-1">
          <Truck size={10} /> {rating.shippingSpeed}/5
        </span>
        <span className="flex items-center gap-1">
          <Package size={10} /> {rating.itemAccuracy}/5
        </span>
        {rating.wouldTradeAgain && (
          <span className="badge-stamp text-[9px] text-accent border-accent">
            Would trade again ✓
          </span>
        )}
        <span className="ml-auto text-muted-foreground/70">{timeAgo(rating.createdAt)}</span>
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="px-4 md:px-6 mt-4 space-y-3">
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="h-10 w-2/3 bg-surface rounded-sm animate-pulse" />
        <div className="h-2 w-full bg-surface rounded-sm animate-pulse" />
        <div className="h-2 w-full bg-surface rounded-sm animate-pulse" />
        <div className="h-2 w-full bg-surface rounded-sm animate-pulse" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2">
          <div className="h-3 w-1/3 bg-surface rounded-sm animate-pulse" />
          <div className="h-2.5 w-4/5 bg-surface rounded-sm animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function RatingsContent() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>("received");

  const me = store.requireUser();
  const summary = store.ratingSummary(me.id);
  const pending = store.pendingRatings(me.id);
  const received = store.ratingsFor(me.id);
  const given = store.ratingsBy(me.id);
  const rows = tab === "received" ? received : given;

  return (
    <>
      {/* Trust overview */}
      <div className="px-4 md:px-6 mt-4">
        <div className="bg-card border border-border border-l-2 border-l-accent rounded-xl p-4 md:p-5 md:grid md:grid-cols-2 md:gap-x-8 md:items-center">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-accent flex-shrink-0">
                {/* plain img: avatars may be data URLs */}
                <img
                  src={me.avatar}
                  alt={me.displayName}
                  className="object-cover w-full h-full"
                />
              </div>
              <div className="min-w-0">
                <p className="font-semibold truncate">{me.displayName}</p>
                <TrustScore score={me.trustScore} trades={me.tradesCompleted} size="lg" />
              </div>
            </div>

            {me.badges.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mt-3">
                {me.badges.map((b) => (
                  <TrustBadge key={b.id} badge={b} size="sm" />
                ))}
              </div>
            )}
          </div>

          {summary.count === 0 ? (
            <p className="text-xs text-muted-foreground border-t border-border mt-4 pt-3 md:border-t-0 md:mt-0 md:pt-0">
              No ratings on the books yet. Close out a deal and the numbers start talking.
            </p>
          ) : (
            <div className="space-y-3 border-t border-border mt-4 pt-3 md:border-t-0 md:mt-0 md:pt-0">
              <DimensionBar
                label="Communication"
                icon={MessageSquare}
                value={summary.communication}
              />
              <DimensionBar
                label="Shipping speed"
                icon={Truck}
                value={summary.shippingSpeed}
              />
              <DimensionBar
                label="Item accuracy"
                icon={Package}
                value={summary.itemAccuracy}
              />
              <DimensionBar
                label="Would trade again"
                icon={ThumbsUp}
                value={summary.wouldTradeAgainPct}
                suffix="%"
                max={100}
              />
              <p className="text-[11px] text-muted-foreground/70">
                Based on {summary.count} rating{summary.count === 1 ? "" : "s"}.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Pending ratings */}
      {pending.length > 0 && (
        <div className="px-4 md:px-6 mt-5">
          <h2 className="text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Rate your recent deals
          </h2>
          <div className="space-y-2">
            {pending.map((deal) => {
              const other = deal.proposerId === me.id ? deal.owner : deal.proposer;
              return (
                <Link
                  key={deal.id}
                  href={`/app/trades/${deal.id}`}
                  className="flex items-center gap-3 bg-card border border-accent/60 rounded-xl p-3 card-lift"
                >
                  <span className="w-9 h-9 rounded-full overflow-hidden border border-border flex-shrink-0">
                    {/* plain img: avatars may be data URLs */}
                    <img
                      src={other.avatar}
                      alt={other.username}
                      className="object-cover w-full h-full"
                    />
                  </span>
                  <span className="flex-1 min-w-0 block">
                    <span className="block text-sm font-semibold truncate">
                      {deal.listing?.title ?? "A deal"}
                    </span>
                    <span className="block text-xs text-muted-foreground truncate">
                      with @{other.username}
                      {deal.completedAt ? ` · completed ${formatDate(deal.completedAt)}` : ""}
                    </span>
                  </span>
                  <span className="badge-stamp text-[9px] text-accent border-accent flex-shrink-0">
                    Rate
                  </span>
                  <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Received / Given tabs */}
      <div className="px-4 md:px-6 mt-6 flex flex-wrap gap-2">
        {(
          [
            { key: "received", label: "Received", count: received.length },
            { key: "given", label: "Given", count: given.length },
          ] as const
        ).map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-colors",
              tab === key
                ? "bg-accent text-accent-foreground border-accent shadow-sm"
                : "bg-card text-muted-foreground border-border hover:text-foreground",
            )}
          >
            {label} <span className="tabular-nums">({count})</span>
          </button>
        ))}
      </div>

      <div className="px-4 md:px-6 mt-4 space-y-3 pb-6">
        {rows.length === 0 ? (
          <div className="text-center py-14 px-6">
            <Star size={28} className="mx-auto mb-3 text-muted-foreground" />
            <p className="font-display font-bold text-xl text-muted-foreground mb-1">
              {tab === "received" ? "No ratings yet." : "Nothing given yet."}
            </p>
            <p className="text-sm text-muted-foreground mb-5">
              {tab === "received"
                ? "Ratings unlock after both sides complete a deal."
                : "Complete a deal, then rate the other side — good rep is the currency here."}
            </p>
            <Link
              href="/app/trades"
              className="inline-block bg-accent text-accent-foreground px-5 py-2 rounded-full text-sm font-semibold"
            >
              Check your trades
            </Link>
          </div>
        ) : (
          rows.map((rating) => <RatingRow key={rating.id} rating={rating} tab={tab} />)
        )}
      </div>
    </>
  );
}

export default function RatingsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 md:top-14 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 md:px-6 py-3">
        <div className="flex items-center gap-3">
          <Link href="/app/profile" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="font-display font-bold text-xl tracking-tight">
            Your reputation
          </h1>
        </div>
      </header>

      <Hydrated fallback={<PageSkeleton />}>
        <RatingsContent />
      </Hydrated>
    </div>
  );
}
