"use client";

/**
 * Public Wanted Board — the SEO-facing, signed-out-friendly view of
 * /app/wanted. Standalone page chrome (no app shell): the shared public
 * header, a warm hero, an item-type filter, and a board of "pinned note" ISO
 * cards. The posts are READ-ONLY here (no "I have this" for signed-out
 * visitors); a small affordance routes to /login (or /app/wanted when signed
 * in). Data comes from the public store snapshot; a join-funnel card closes
 * the page.
 */

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHydrated, useStore } from "@/lib/store-context";
import { PublicSiteHeader } from "@/app/u/[username]/public-profile";
import { money, timeAgo } from "@/lib/format";
import type { ISOPost, ItemType } from "@/lib/types";

const pillPrimary =
  "inline-flex items-center justify-center gap-2 bg-accent text-accent-foreground text-sm font-semibold rounded-full shadow-sm hover:opacity-90 transition-opacity";

const ITEM_TYPE_CHIPS: { value: "all" | ItemType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "jersey", label: "Jerseys" },
  { value: "disc", label: "Discs" },
];

/* ── Filter pill ─────────────────────────────────────────────────────────── */

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-colors",
        active
          ? "bg-accent text-accent-foreground border-accent shadow-sm"
          : "bg-card text-muted-foreground border-border hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/* ── Hero ────────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <div className="pt-9 pb-6 md:pt-12 md:pb-8 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 text-accent mb-4">
        <Pin size={24} />
      </div>
      <h1 className="font-display font-black text-3xl md:text-4xl tracking-tight text-balance">
        The wanted board
      </h1>
      <p className="text-sm md:text-base text-muted-foreground mt-3 text-balance">
        What players are hunting right now.
      </p>
    </div>
  );
}

/* ── Loading state ───────────────────────────────────────────────────────── */

function BoardSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-surface rounded-sm h-36 animate-pulse"
        />
      ))}
    </div>
  );
}

/* ── Pinned note (read-only ISO card) ────────────────────────────────────── */

function NoteCard({ post, index }: { post: ISOPost; index: number }) {
  const store = useStore();
  const signedIn = !!store.sessionMe;
  const replyHref = signedIn ? "/app/wanted" : "/login";
  return (
    <div
      className={cn(
        "relative bg-[#fdf6e3] border border-amber-200/70 dark:bg-[#1a1a18] dark:border-border rounded-sm p-4 card-lift",
        index % 2 === 0 ? "rotate-[0.4deg]" : "-rotate-[0.4deg]",
      )}
    >
      <Pin
        size={15}
        className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-pop rotate-[30deg]"
      />
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full overflow-hidden border border-border flex-shrink-0">
          {/* plain img: avatars may be user-uploaded data URLs */}
          <img
            src={post.user.avatar}
            alt={post.user.username}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs text-muted-foreground">
              @{post.user.username}
            </span>
            <span className="badge-stamp text-muted-foreground border-border">
              ISO {post.itemType}
            </span>
          </div>
          <p className="text-sm leading-snug line-clamp-2 text-foreground">
            {post.description}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {post.team ? `${post.team} · ` : ""}
            {post.maxPrice ? `up to ${money(post.maxPrice)} · ` : ""}
            {timeAgo(post.createdAt)}
          </p>
          <Link
            href={replyHref}
            className="inline-flex items-center gap-0.5 text-xs font-semibold text-accent mt-2 hover:opacity-80 transition-opacity"
          >
            {signedIn ? "Reply in Poachland" : "Join to reply"}
            <ChevronRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────────── */

function EmptyBoard() {
  return (
    <div className="py-16 text-center">
      <h2 className="font-display font-bold text-xl tracking-tight mb-1">
        No active hunts here.
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        Nobody&apos;s posted for this yet. Join to be the first to call it out.
      </p>
      <Link href="/login" className={cn(pillPrimary, "px-6 py-3")}>
        Join free
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
              Got what they&apos;re after?
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              Jump back into Poachland to reply and make the trade.
            </p>
            <Link href="/app/wanted" className={cn(pillPrimary, "px-6 py-3")}>
              Enter Poachland
            </Link>
          </>
        ) : (
          <>
            <h2 className="font-display font-black text-2xl tracking-tight mb-2 text-balance">
              Join the swap meet
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              Free — one email. No fees, no middleman.
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

/* ── Board ───────────────────────────────────────────────────────────────── */

function Board({ itemType }: { itemType: "all" | ItemType }) {
  const store = useStore();
  const posts = store.listISOPosts({ itemType, sort: "newest" });

  if (posts.length === 0) return <EmptyBoard />;

  return (
    <>
      <p className="text-xs text-muted-foreground mb-4">
        {posts.length} hunt{posts.length !== 1 ? "s" : ""} on the board
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post, i) => (
          <NoteCard key={post.id} post={post} index={i} />
        ))}
      </div>
    </>
  );
}

/* ── Entry ───────────────────────────────────────────────────────────────── */

export function PublicWanted() {
  const hydrated = useHydrated();
  const [itemType, setItemType] = useState<"all" | ItemType>("all");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicSiteHeader />
      <main
        id="main-content"
        className="mx-auto max-w-lg md:max-w-3xl lg:max-w-4xl px-4 md:px-6 pb-12"
      >
        <Hero />

        {/* Item-type filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          {ITEM_TYPE_CHIPS.map((c) => (
            <Pill
              key={c.value}
              active={itemType === c.value}
              onClick={() => setItemType(c.value)}
            >
              {c.label}
            </Pill>
          ))}
        </div>

        {!hydrated ? (
          <BoardSkeleton />
        ) : (
          <>
            <Board itemType={itemType} />
            <div className="mt-6">
              <JoinCta />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
