"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { DealStatusBadge } from "@/components/deal-status-badge";
import { Hydrated } from "@/components/hydrated";
import { DEAL_KIND_LABELS } from "@/lib/constants";
import { timeAgo, timeUntil } from "@/lib/format";
import { useStore } from "@/lib/store-context";
import type { Deal, DealStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fetchDealPage } from "@/app/actions/query";

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
      className="flex gap-3 bg-card border border-border rounded-xl p-3 card-lift"
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
            <span className="text-amber-700 dark:text-yellow-400">
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
    <div className="px-4 md:px-6">
      <div className="flex flex-wrap gap-2 pb-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 w-24 bg-surface rounded-full animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-card border border-border rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function DealsContent() {
  const store = useStore();
  const [tab, setTab] = useState<TabKey>("your-move");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const me = store.requireUser();
  const queryStatuses = useMemo<DealStatus[]>(() => tab === "history" ? HISTORY_STATUSES : tab === "in-progress" ? ["accepted"] : ["open", "accepted"], [tab]);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchDealPage(queryStatuses);
      setDeals(page.items);
      setNextCursor(page.nextCursor);
    } finally { setLoading(false); }
  }, [queryStatuses]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const onInvalidate = (event: Event) => {
      const domains = (event as CustomEvent<{ domains?: string[] }>).detail?.domains;
      if (domains?.includes("deals")) void reload();
    };
    window.addEventListener("poachland:invalidate", onInvalidate);
    return () => window.removeEventListener("poachland:invalidate", onInvalidate);
  }, [reload]);

  const awaitingResponse = deals.filter((deal) => deal.status === "open" && deal.currentOffer.byUserId !== me.id);
  const accepted = deals.filter((deal) => deal.status === "accepted");
  const acceptedNeedsMe = accepted.filter((d) => !d.fulfillment[me.id]?.receivedAt);
  const yourMove = [...awaitingResponse, ...acceptedNeedsMe].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  const waiting = deals.filter((deal) => deal.status === "open" && deal.currentOffer.byUserId === me.id);
  const history = deals.filter((deal) => HISTORY_STATUSES.includes(deal.status));

  const tabs: { key: TabKey; deals: Deal[] }[] = [
    { key: "your-move", deals: yourMove },
    { key: "waiting", deals: waiting },
    { key: "in-progress", deals: accepted },
    { key: "history", deals: history },
  ];

  const activeTab = tabs.find((t) => t.key === tab)!;

  if (loading) return <DealsSkeleton />;

  return (
    <div>
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 px-4 md:px-6 pb-3">
        {tabs.map(({ key, deals }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-colors",
              tab === key
                ? "bg-accent text-accent-foreground border-accent shadow-sm"
                : "bg-card text-muted-foreground border-border hover:text-foreground",
            )}
          >
            {TAB_LABELS[key]}
            <span
              className={cn(
                "text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none",
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
      <div className="px-4 md:px-6 pb-6 grid grid-cols-1 lg:grid-cols-2 gap-3">
        {activeTab.deals.length === 0 ? (
          <div className="col-span-full text-center py-14 border border-dashed border-border rounded-xl">
            <p className="text-sm text-muted-foreground">{TAB_EMPTY_COPY[tab]}</p>
          </div>
        ) : (
          activeTab.deals.map((deal) => <DealRow key={deal.id} deal={deal} meId={me.id} />)
        )}
      </div>
      {nextCursor && (
        <button
          type="button"
          disabled={loadingMore}
          onClick={() => {
            setLoadingMore(true);
            void fetchDealPage(queryStatuses, nextCursor).then((page) => {
              setDeals((current) => [...current, ...page.items.filter((item) => !current.some((seen) => seen.id === item.id))]);
              setNextCursor(page.nextCursor);
            }).finally(() => setLoadingMore(false));
          }}
          className="mx-auto mb-6 block rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {loadingMore ? "Loading…" : "Load older deals"}
        </button>
      )}
    </div>
  );
}

export default function TradesPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 md:top-14 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 md:px-6 py-3 flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl tracking-tight text-foreground">
          Deals
        </h1>
        <Link
          href="/app/trades/new"
          className="flex items-center gap-1.5 bg-accent text-accent-foreground text-sm font-semibold px-5 py-2.5 rounded-full shadow-sm"
        >
          <Plus size={15} /> New trade
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
