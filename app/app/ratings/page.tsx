"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Star, MessageSquare, Package, Truck, ThumbsUp } from "lucide-react";
import { TrustBadge, TrustScore } from "@/components/trust-badge";
import { DEMO_USERS } from "@/lib/seed-data";

// Demo ratings data
const DEMO_RATINGS = [
  {
    id: "r1",
    fromUser: DEMO_USERS[1],
    communication: 5,
    shippingSpeed: 5,
    itemAccuracy: 5,
    wouldTradeAgain: true,
    comment: "Shipped next day. Jersey was exactly as described, if not better. Easy trade. Would deal again any time.",
    createdAt: "2024-11-10T14:00:00Z",
    tradeItem: "2022 Brute Squad Jersey → 2019 WFDF Disc",
  },
  {
    id: "r2",
    fromUser: DEMO_USERS[2],
    communication: 5,
    shippingSpeed: 4,
    itemAccuracy: 5,
    wouldTradeAgain: true,
    comment: "Great communication. Took a couple days to ship but item was pristine. Would trade again.",
    createdAt: "2024-10-28T09:00:00Z",
    tradeItem: "Riot '18 Practice Jersey → Mixtape '21 Nationals",
  },
  {
    id: "r3",
    fromUser: DEMO_USERS[1],
    communication: 4,
    shippingSpeed: 5,
    itemAccuracy: 4,
    wouldTradeAgain: true,
    comment: "Quick ship. Minor color difference from photos but within expected range for game-worn stuff. Fair trade.",
    createdAt: "2024-10-15T11:00:00Z",
    tradeItem: "Chain Lightning Disc → Revolver '17 Jersey",
  },
];

const currentUser = DEMO_USERS[0];

function StarRow({ count, size = 12 }: { count: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          className={
            s <= count
              ? "fill-yellow-400 text-yellow-400"
              : "fill-transparent text-muted-foreground"
          }
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

export default function RatingsPage() {
  const [filter, setFilter] = useState<"all" | "received" | "given">("all");

  // Computed stats
  const avgCommunication = (DEMO_RATINGS.reduce((s, r) => s + r.communication, 0) / DEMO_RATINGS.length).toFixed(1);
  const avgShipping = (DEMO_RATINGS.reduce((s, r) => s + r.shippingSpeed, 0) / DEMO_RATINGS.length).toFixed(1);
  const avgAccuracy = (DEMO_RATINGS.reduce((s, r) => s + r.itemAccuracy, 0) / DEMO_RATINGS.length).toFixed(1);
  const wouldTradeAgainPct = Math.round(
    (DEMO_RATINGS.filter((r) => r.wouldTradeAgain).length / DEMO_RATINGS.length) * 100,
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/app/profile" className="text-muted-foreground">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="font-display font-800 text-xl uppercase tracking-tight">
            Reputation
          </h1>
        </div>
      </header>

      {/* Trust overview card */}
      <div className="px-4 mt-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-accent flex-shrink-0">
              <Image
                src={currentUser.avatar}
                alt={currentUser.displayName}
                width={48}
                height={48}
                className="object-cover"
              />
            </div>
            <div>
              <p className="font-semibold">{currentUser.displayName}</p>
              <TrustScore score={currentUser.trustScore} trades={currentUser.tradesCompleted} size="sm" />
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap mb-4">
            {currentUser.badges.map((b) => (
              <TrustBadge key={b.id} badge={b} size="sm" />
            ))}
          </div>

          {/* Breakdown bars */}
          <div className="space-y-3">
            {[
              { label: "Communication", icon: MessageSquare, value: avgCommunication },
              { label: "Shipping speed", icon: Truck, value: avgShipping },
              { label: "Item accuracy", icon: Package, value: avgAccuracy },
            ].map(({ label, icon: Icon, value }) => (
              <div key={label} className="flex items-center gap-3">
                <Icon size={14} className="text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-muted-foreground w-28 flex-shrink-0">{label}</span>
                <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${(parseFloat(value) / 5) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold w-8 text-right">{value}</span>
              </div>
            ))}
            <div className="flex items-center gap-3">
              <ThumbsUp size={14} className="text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground w-28 flex-shrink-0">Would trade again</span>
              <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all"
                  style={{ width: `${wouldTradeAgainPct}%` }}
                />
              </div>
              <span className="text-xs font-semibold w-8 text-right">{wouldTradeAgainPct}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-4 mt-5 flex gap-2">
        {(["all", "received", "given"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-sm text-xs font-semibold uppercase tracking-wide border transition-colors ${
              filter === f
                ? "bg-accent text-accent-foreground border-accent"
                : "bg-transparent text-muted-foreground border-border"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Ratings list */}
      <div className="px-4 mt-4 space-y-3 pb-6">
        {DEMO_RATINGS.map((rating) => (
          <div key={rating.id} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full overflow-hidden border border-border flex-shrink-0">
                  <Image
                    src={rating.fromUser.avatar}
                    alt={rating.fromUser.username}
                    width={28}
                    height={28}
                    className="object-cover"
                  />
                </div>
                <span className="text-sm font-medium">@{rating.fromUser.username}</span>
              </div>
              <StarRow
                count={Math.round(
                  (rating.communication + rating.shippingSpeed + rating.itemAccuracy) / 3,
                )}
              />
            </div>
            <p className="text-xs text-muted-foreground mb-2 border-l-2 border-accent/30 pl-2 italic">
              {rating.tradeItem}
            </p>
            <p className="text-sm leading-relaxed">{rating.comment}</p>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
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
                <span className="flex items-center gap-1 text-accent">
                  <ThumbsUp size={10} /> Again
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {new Date(rating.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
