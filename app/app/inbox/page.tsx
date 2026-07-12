"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowRightLeft, BadgeCheck, MessageSquare } from "lucide-react";
import { DealStatusBadge } from "@/components/deal-status-badge";
import { Hydrated } from "@/components/hydrated";
import { DEAL_KIND_LABELS } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { useStore } from "@/lib/store-context";
import type { Deal, Thread } from "@/lib/types";
import { cn } from "@/lib/utils";

type TabKey = "messages" | "deals";

function preview(thread: Thread): React.ReactNode {
  const m = thread.lastMessage;
  if (!m) return <span className="italic">No messages yet</span>;
  if (m.kind === "offer") {
    return (
      <span>
        <span className="text-accent">↔ Offer:</span> {m.content}
      </span>
    );
  }
  if (m.kind === "system") return <span className="italic">{m.content}</span>;
  return m.content;
}

function ThreadRow({ thread }: { thread: Thread }) {
  return (
    <Link
      href={`/app/inbox/${thread.id}`}
      className="flex items-start gap-3 px-4 md:px-6 py-4 hover:bg-surface transition-colors"
    >
      {/* plain img: avatars may be data URLs */}
      <div className="relative w-12 h-12 rounded-full overflow-hidden bg-surface border border-border flex-shrink-0">
        <img
          src={thread.otherUser.avatar || "/placeholder-user.jpg"}
          alt={thread.otherUser.displayName}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p
            className={cn(
              "text-sm leading-tight truncate",
              thread.unreadCount > 0 ? "font-bold text-foreground" : "font-semibold text-foreground",
            )}
          >
            {thread.otherUser.displayName}
          </p>
          {thread.otherUser.isVerified && (
            <BadgeCheck size={14} className="text-accent flex-shrink-0" />
          )}
          {thread.deal && (
            <DealStatusBadge status={thread.deal.status} className="flex-shrink-0 text-[9px]" />
          )}
        </div>
        <p
          className={cn(
            "text-xs mt-0.5 line-clamp-1",
            thread.unreadCount > 0 ? "text-foreground/90" : "text-muted-foreground",
          )}
        >
          {preview(thread)}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">{timeAgo(thread.updatedAt)}</p>
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        {thread.listing && (
          <div className="relative w-10 h-10 rounded-md overflow-hidden bg-surface border border-border">
            <img
              src={thread.listing.photos[0] || "/placeholder.jpg"}
              alt={thread.listing.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
        )}
        {thread.unreadCount > 0 && (
          <span className="min-w-5 h-5 px-1.5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">
            {thread.unreadCount > 9 ? "9+" : thread.unreadCount}
          </span>
        )}
      </div>
    </Link>
  );
}

function DealRow({ deal, meId }: { deal: Deal; meId: string }) {
  const store = useStore();
  const other = deal.proposerId === meId ? deal.owner : deal.proposer;
  return (
    <Link
      href={`/app/trades/${deal.id}`}
      className="flex gap-3 bg-card border border-border rounded-xl p-3 card-lift"
    >
      <div className="relative w-12 h-12 rounded-md overflow-hidden bg-surface border border-border flex-shrink-0">
        <img
          src={deal.listing.photos[0] || "/placeholder.jpg"}
          alt={deal.listing.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground leading-tight line-clamp-1">
            {deal.listing.title}
          </p>
          <DealStatusBadge status={deal.status} className="flex-shrink-0" />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {DEAL_KIND_LABELS[deal.kind]} · with @{other.username}
        </p>
        <p className="text-xs text-foreground/80 mt-1 line-clamp-1">
          {store.describeOffer(deal, deal.currentOffer)}
        </p>
      </div>
    </Link>
  );
}

function MessagesTab({ threads }: { threads: Thread[] }) {
  if (threads.length === 0) {
    return (
      <div className="px-6 py-20 text-center">
        <MessageSquare size={32} className="mx-auto mb-4 text-muted-foreground" />
        <h2 className="font-display font-bold tracking-tight text-xl text-foreground mb-2">
          No conversations yet
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Every deal starts with a message.
        </p>
        <Link
          href="/app/browse"
          className="inline-block bg-accent text-accent-foreground font-display font-semibold text-sm px-5 py-2.5 rounded-full shadow-sm"
        >
          Browse the market
        </Link>
      </div>
    );
  }
  return (
    <div className="divide-y divide-border">
      {threads.map((t) => (
        <ThreadRow key={t.id} thread={t} />
      ))}
    </div>
  );
}

function DealsTab({ yourMove, others, meId }: { yourMove: Deal[]; others: Deal[]; meId: string }) {
  if (yourMove.length === 0 && others.length === 0) {
    return (
      <div className="px-6 py-20 text-center">
        <ArrowRightLeft size={32} className="mx-auto mb-4 text-muted-foreground" />
        <h2 className="font-display font-bold tracking-tight text-xl text-foreground mb-2">
          No live deals
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Nothing on the table. Go poach something.
        </p>
        <Link
          href="/app/trades"
          className="inline-block text-accent text-sm font-semibold"
        >
          See all deals →
        </Link>
      </div>
    );
  }
  return (
    <div className="px-4 md:px-6 py-4 space-y-5">
      {yourMove.length > 0 && (
        <section>
          <h2 className="font-display font-bold uppercase tracking-widest text-xs text-accent mb-2">
            Your move
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {yourMove.map((d) => (
              <DealRow key={d.id} deal={d} meId={meId} />
            ))}
          </div>
        </section>
      )}
      {others.length > 0 && (
        <section>
          <h2 className="font-display font-bold uppercase tracking-widest text-xs text-muted-foreground mb-2">
            In play
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {others.map((d) => (
              <DealRow key={d.id} deal={d} meId={meId} />
            ))}
          </div>
        </section>
      )}
      <Link
        href="/app/trades"
        className="flex items-center justify-center gap-1.5 text-sm font-semibold text-accent py-2"
      >
        All deals <ArrowRight size={14} />
      </Link>
    </div>
  );
}

function InboxContent() {
  const store = useStore();
  const [tab, setTab] = useState<TabKey>("messages");
  const me = store.requireUser();

  const threads = store.listThreads();
  const yourMove = store.dealsAwaitingResponse(me.id);
  const yourMoveIds = new Set(yourMove.map((d) => d.id));
  const others = store
    .dealsForUser(me.id, { statuses: ["open", "accepted"] })
    .filter((d) => !yourMoveIds.has(d.id));
  const dealCount = yourMove.length + others.length;
  const unreadTotal = threads.reduce((sum, t) => sum + t.unreadCount, 0);

  const tabs: { key: TabKey; label: string; badge: number }[] = [
    { key: "messages", label: "Messages", badge: unreadTotal },
    { key: "deals", label: `Deals (${dealCount})`, badge: yourMove.length },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2 px-4 md:px-6 pt-4 pb-3">
        {tabs.map(({ key, label, badge }) => (
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
            {label}
            {badge > 0 && (
              <span
                className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none",
                  tab === key
                    ? "bg-accent-foreground/15 text-accent-foreground"
                    : "bg-accent text-accent-foreground",
                )}
              >
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>
      {tab === "messages" ? (
        <MessagesTab threads={threads} />
      ) : (
        <DealsTab yourMove={yourMove} others={others} meId={me.id} />
      )}
    </div>
  );
}

function InboxSkeleton() {
  return (
    <div>
      <div className="flex flex-wrap gap-2 px-4 md:px-6 pt-4 pb-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-8 w-28 bg-surface rounded-full animate-pulse" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 px-4 md:px-6 py-4">
            <div className="w-12 h-12 rounded-full bg-surface animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3.5 w-32 bg-surface rounded animate-pulse" />
              <div className="h-3 w-52 bg-surface rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function InboxPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 md:top-14 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 md:px-6 py-3">
        <h1 className="font-display font-bold text-2xl tracking-tight text-foreground">
          Inbox
        </h1>
      </header>
      <Hydrated fallback={<InboxSkeleton />}>
        <InboxContent />
      </Hydrated>
    </div>
  );
}
