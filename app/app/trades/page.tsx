"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, Plus } from "lucide-react";
import { DealStatusBadge } from "@/components/deal-status-badge";
import { Hydrated } from "@/components/hydrated";
import { DEAL_KIND_LABELS } from "@/lib/constants";
import { timeAgo, timeUntil } from "@/lib/format";
import { useStore } from "@/lib/store-context";
import type { Deal, DealStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type TabKey = "your-move" | "waiting" | "in-progress" | "history";

const TAB_LABELS: Record<TabKey, string> = {
  "your-move": "Your move",
  waiting: "Waiting on them",
  "in-progress": "In progress",
  history: "History",
};

const HISTORY_STATUSES: DealStatus[] = [
  "completed",
  "declined",
  "withdrawn",
  "expired",
  "cancelled",
  "disputed",
];

const TAB_EMPTY_COPY: Record<TabKey, string> = {
  "your-move": "Nothing needs your attention. Rest easy.",
  waiting: "No offers out. Your move to make one.",
  "in-progress": "No live deals right now.",
  history: "No closed deals yet. Your record starts with the first one.",
};

function DealRow({ deal, meId }: { deal: Deal; meId: string }) {
  const store = useStore();
  const other = deal.proposerId === meId ? deal.owner : deal.proposer;
  return (
    <Link
      href={`/app/trades/${deal.id}`}
      className="flex gap-3 bg-card border border-border rounded-lg p-3 card-lift"
    >
      <div className="relative w-16 h-16 rounded-md overflow-hidden bg-surface border border-border flex-shrink-0">
        {/* plain img: photos may be data URLs */}
        <img
          src={deal.listing.photos[0] || "/placeholder.jpg"}
          alt={deal.listing.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-1">
            {deal.listing.title}
          </h3>
          <DealStatusBadge status={deal.status} className="flex-shrink-0" />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {DEAL_KIND_LABELS[deal.kind]} · with @{other.username}
        </p>
        <p className="text-xs text-foreground/80 mt-1 line-clamp-1">
          {store.describeOffer(deal, deal.currentOffer)}
        </p>
        <p className="text-[11px] mt-1">
          {deal.status === "open" && (
            <span className="text-yellow-400">
              {timeUntil(deal.currentOffer.expiresAt)}
              <span className="text-muted-foreground"> · </span>
            </span>
          )}
          <span className="text-muted-foreground">{timeAgo(deal.updatedAt)}</span>
        </p>
      </div>
    </Link>
  );
}

function DealsSkeleton() {
  return (
    <div className="px-4 space-y-3">
      <div className="flex gap-2 pb-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 w-24 bg-surface rounded-sm animate-pulse" />
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 bg-card border border-border rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

function DealsContent() {
  const store = useStore();
  const [tab, setTab] = useState<TabKey>("your-move");
  const me = store.requireUser();

  const awaitingResponse = store.dealsAwaitingResponse(me.id);
  const accepted = store.dealsForUser(me.id, { statuses: ["accepted"] });
  const acceptedNeedsMe = accepted.filter((d) => !d.fulfillment[me.id]?.receivedAt);
  const yourMove = [...awaitingResponse, ...acceptedNeedsMe].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  const waiting = store
    .dealsForUser(me.id, { statuses: ["open"] })
    .filter((d) => d.currentOffer.byUserId === me.id);
  const history = store.dealsForUser(me.id, { statuses: HISTORY_STATUSES });

  const tabs: { key: TabKey; deals: Deal[] }[] = [
    { key: "your-move", deals: yourMove },
    { key: "waiting", deals: waiting },
    { key: "in-progress", deals: accepted },
    { key: "history", deals: history },
  ];

  const totalDeals = store.dealsForUser(me.id).length;
  const activeTab = tabs.find((t) => t.key === tab)!;

  if (totalDeals === 0) {
    return (
      <div className="px-6 py-20 text-center">
        <ArrowRightLeft size={32} className="mx-auto mb-4 text-muted-foreground" />
        <h2 className="font-display font-bold uppercase tracking-tight text-xl text-foreground mb-2">
          No deals yet
        </h2>
        <p className="text-sm text-muted-foreground mb-6">Go poach something.</p>
        <Link
          href="/app/browse"
          className="inline-block bg-accent text-accent-foreground font-display font-bold uppercase tracking-wide text-sm px-6 py-3 rounded-sm"
        >
          Browse the market
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map(({ key, deals }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-semibold uppercase tracking-wide border transition-colors",
              tab === key
                ? "bg-accent text-accent-foreground border-accent"
                : "bg-transparent text-muted-foreground border-border hover:text-foreground",
            )}
          >
            {TAB_LABELS[key]}
            <span
              className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none",
                tab === key
                  ? "bg-accent-foreground/15 text-accent-foreground"
                  : "bg-surface text-muted-foreground",
              )}
            >
              {deals.length}
            </span>
          </button>
        ))}
      </div>

      {/* Rows */}
      <div className="px-4 space-y-3 pb-6">
        {activeTab.deals.length === 0 ? (
          <div className="text-center py-14 border border-dashed border-border rounded-lg">
            <p className="text-sm text-muted-foreground">{TAB_EMPTY_COPY[tab]}</p>
          </div>
        ) : (
          activeTab.deals.map((deal) => <DealRow key={deal.id} deal={deal} meId={me.id} />)
        )}
      </div>
    </div>
  );
}

export default function TradesPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl uppercase tracking-tight text-foreground">
          Deals
        </h1>
        <Link
          href="/app/trades/new"
          className="flex items-center gap-1.5 bg-accent text-accent-foreground font-display font-bold uppercase tracking-wide text-xs px-3 py-2 rounded-sm"
        >
          <Plus size={14} strokeWidth={3} /> New trade
        </Link>
      </header>
      <div className="py-4">
        <Hydrated fallback={<DealsSkeleton />}>
          <DealsContent />
        </Hydrated>
      </div>
    </div>
  );
}
