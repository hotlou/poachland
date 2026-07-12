"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgeCheck, MessageSquare, Send, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { DealStatusBadge } from "@/components/deal-status-badge";
import { Hydrated } from "@/components/hydrated";
import { OfferCard } from "@/components/offer-card";
import { TrustScore } from "@/components/trust-badge";
import { timeAgo } from "@/lib/format";
import { useStore } from "@/lib/store-context";
import type { Message, Thread } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Show a timestamp divider on the first message, a day change, or a long gap. */
function needsStamp(prev: Message | undefined, m: Message): boolean {
  if (!prev) return true;
  const a = new Date(prev.createdAt);
  const b = new Date(m.createdAt);
  if (a.toDateString() !== b.toDateString()) return true;
  return b.getTime() - a.getTime() > 45 * 60 * 1000;
}

function TimeStamp({ iso }: { iso: string }) {
  return (
    <p className="text-center text-[10px] uppercase tracking-widest text-muted-foreground py-1">
      {timeAgo(iso)}
    </p>
  );
}

function OfferMessage({ message, meId }: { message: Message; meId: string }) {
  const store = useStore();
  const found = message.offerId ? store.getOffer(message.offerId) : null;
  if (!found) {
    return (
      <p className="text-center text-xs italic text-muted-foreground py-1">{message.content}</p>
    );
  }
  return (
    <div className="py-1">
      <OfferCard compact deal={found.deal} offer={found.offer} viewerId={meId} />
      <Link
        href={`/app/trades/${found.deal.id}`}
        className="inline-flex items-center gap-1 text-xs font-semibold text-accent mt-1.5"
      >
        View deal <ArrowRight size={12} />
      </Link>
    </div>
  );
}

function MessageBubble({ message, mine, avatar }: { message: Message; mine: boolean; avatar: string }) {
  return (
    <div className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
      {!mine && (
        <div className="relative w-6 h-6 rounded-full overflow-hidden bg-surface border border-border flex-shrink-0">
          {/* plain img: avatars may be data URLs */}
          <img src={avatar || "/placeholder-user.jpg"} alt="" className="absolute inset-0 w-full h-full object-cover" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[78%] rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words",
          mine
            ? "bg-accent/15 border-accent/30 text-foreground rounded-br-sm"
            : "bg-surface border-border text-foreground rounded-bl-sm",
        )}
      >
        {message.content}
      </div>
    </div>
  );
}

function ContextCard({ thread }: { thread: Thread }) {
  if (!thread.listing && !thread.deal) return null;
  return (
    <div className="mx-4 mt-3 bg-card border border-border rounded-lg p-3 space-y-2">
      {thread.listing && (
        <Link href={`/app/listings/${thread.listing.id}`} className="flex items-center gap-2.5 group">
          <div className="relative w-10 h-10 rounded-md overflow-hidden bg-surface border border-border flex-shrink-0">
            <img
              src={thread.listing.photos[0] || "/placeholder.jpg"}
              alt={thread.listing.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-display font-bold">
              About this listing
            </p>
            <p className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-accent transition-colors">
              {thread.listing.title}
            </p>
          </div>
        </Link>
      )}
      {thread.deal && (
        <div className={cn("flex items-center justify-between gap-2", thread.listing && "border-t border-border pt-2")}>
          <DealStatusBadge status={thread.deal.status} />
          <Link
            href={`/app/trades/${thread.deal.id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent"
          >
            View deal <ArrowRight size={12} />
          </Link>
        </div>
      )}
    </div>
  );
}

function NotFound() {
  return (
    <div className="px-6 py-24 text-center">
      <MessageSquare size={32} className="mx-auto mb-4 text-muted-foreground" />
      <h2 className="font-display font-bold uppercase tracking-tight text-xl text-foreground mb-2">
        Thread not found
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        This conversation doesn&apos;t exist — or it isn&apos;t yours to read.
      </p>
      <Link
        href="/app/inbox"
        className="inline-block bg-accent text-accent-foreground font-display font-bold uppercase tracking-wide text-sm px-6 py-3 rounded-sm"
      >
        Back to inbox
      </Link>
    </div>
  );
}

function ThreadContent({ threadId }: { threadId: string }) {
  const store = useStore();
  const me = store.requireUser();
  const thread = store.getThread(threadId);
  const messages = store.threadMessages(threadId);
  const lastMessageId = messages[messages.length - 1]?.id;
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const threadExists = !!thread;

  // Mark read on mount and whenever a new message lands.
  useEffect(() => {
    if (threadExists) store.markThreadRead(threadId);
  }, [store, threadId, threadExists, lastMessageId]);

  // Keep the latest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [lastMessageId]);

  if (!thread) return <NotFound />;

  const other = thread.otherUser;
  const blocked = store.isBlockedPair(me.id, other.id);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    const res = store.sendMessage(threadId, text);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setDraft("");
  };

  return (
    <div>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <Link href="/app/inbox" aria-label="Back to inbox" className="text-foreground">
          <ArrowLeft size={20} />
        </Link>
        <Link href={`/app/u/${other.username}`} className="flex items-center gap-2.5 min-w-0 flex-1 group">
          <div className="relative w-9 h-9 rounded-full overflow-hidden bg-surface border border-border flex-shrink-0">
            <img
              src={other.avatar || "/placeholder-user.jpg"}
              alt={other.displayName}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight flex items-center gap-1 group-hover:text-accent transition-colors">
              <span className="truncate">{other.displayName}</span>
              {other.isVerified && <BadgeCheck size={14} className="text-accent flex-shrink-0" />}
            </p>
            <TrustScore score={other.trustScore} trades={other.tradesCompleted} size="sm" />
          </div>
        </Link>
      </header>

      <ContextCard thread={thread} />

      {/* Messages */}
      <div className="px-4 pt-4 pb-24 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-10">
            No messages yet. Say something worth trading over.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={m.id}>
            {needsStamp(messages[i - 1], m) && <TimeStamp iso={m.createdAt} />}
            {m.kind === "system" ? (
              <p className="text-center text-xs italic text-muted-foreground py-1 px-6">
                {m.content}
              </p>
            ) : m.kind === "offer" ? (
              <OfferMessage message={m} meId={me.id} />
            ) : (
              <MessageBubble message={m} mine={m.senderId === me.id} avatar={other.avatar} />
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="fixed bottom-16 inset-x-0 z-40 bg-surface/95 backdrop-blur-sm border-t border-border">
        <div className="max-w-lg mx-auto px-4 py-3">
          {blocked ? (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-1.5">
              <ShieldOff size={15} className="flex-shrink-0" />
              You can&apos;t message this user.
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={`Message @${other.username}...`}
                className="flex-1 bg-background border border-border rounded-full px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors"
              />
              <button
                type="button"
                onClick={send}
                disabled={!draft.trim()}
                aria-label="Send message"
                className="w-10 h-10 rounded-full bg-accent flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
              >
                <Send size={16} className="text-accent-foreground" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div>
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <Link href="/app/inbox" aria-label="Back to inbox" className="text-foreground">
          <ArrowLeft size={20} />
        </Link>
        <div className="w-9 h-9 rounded-full bg-surface animate-pulse" />
        <div className="space-y-1.5">
          <div className="h-3.5 w-28 bg-surface rounded animate-pulse" />
          <div className="h-3 w-20 bg-surface rounded animate-pulse" />
        </div>
      </header>
      <div className="px-4 pt-4 space-y-3">
        <div className="h-14 bg-card border border-border rounded-lg animate-pulse" />
        <div className="h-10 w-3/4 bg-surface rounded-xl animate-pulse" />
        <div className="h-10 w-2/3 bg-surface rounded-xl animate-pulse ml-auto" />
        <div className="h-10 w-1/2 bg-surface rounded-xl animate-pulse" />
      </div>
    </div>
  );
}

export default function ThreadPage() {
  const params = useParams<{ id: string }>();
  const threadId = params.id;

  return (
    <div className="min-h-screen bg-background">
      <Hydrated fallback={<ThreadSkeleton />}>
        <ThreadContent threadId={threadId} />
      </Hydrated>
    </div>
  );
}
