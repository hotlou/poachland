"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Shirt,
  Disc3,
  Check,
  X,
  PackageCheck,
  PackageOpen,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStore } from "@/lib/store-context";
import { Hydrated } from "@/components/hydrated";
import { SaveButton } from "@/components/save-button";
import { money, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ISOPost, ItemType } from "@/lib/types";

type Filter = "all" | ItemType;
type Sort = "newest" | "most-saved";

const ROTATIONS = ["rotate-[-1deg]", "rotate-[1deg]", "rotate-[0.5deg]"];

export default function WantedBoardPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 pt-3 pb-3">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h1 className="font-display font-bold text-xl tracking-tight">
              Wanted board
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              The hunt list. Pin what you&apos;re chasing.
            </p>
          </div>
          <Link
            href="/app/wanted/create"
            className="flex items-center gap-1.5 bg-accent text-accent-foreground px-3.5 py-2 rounded-full text-xs font-display font-bold shrink-0"
          >
            <Plus size={14} /> Post ISO
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            {(
              [
                { key: "all", label: "All", icon: null },
                { key: "jersey", label: "Jerseys", icon: Shirt },
                { key: "disc", label: "Discs", icon: Disc3 },
              ] as const
            ).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                  filter === key
                    ? "bg-accent text-accent-foreground border-accent"
                    : "bg-card text-muted-foreground border-border hover:text-foreground",
                )}
              >
                {Icon && <Icon size={12} />}
                {label}
              </button>
            ))}
          </div>
          <div className="flex rounded-full bg-card border border-border overflow-hidden">
            {(
              [
                { key: "newest", label: "Newest" },
                { key: "most-saved", label: "Most Saved" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setSort(key)}
                className={cn(
                  "px-3 py-1.5 text-[11px] font-semibold transition-colors",
                  sort === key
                    ? "bg-surface text-accent"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <Hydrated fallback={<BoardSkeleton />}>
        <Board filter={filter} sort={sort} />
      </Hydrated>

      {/* Floating post FAB */}
      <div className="fixed bottom-20 inset-x-0 z-40 pointer-events-none">
        <div className="max-w-lg mx-auto flex justify-end px-4">
          <Link
            href="/app/wanted/create"
            aria-label="Post ISO"
            className="pointer-events-auto w-12 h-12 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-lg shadow-accent/25 card-lift"
          >
            <Plus size={22} strokeWidth={2.5} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="p-4 flex flex-col gap-5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            "bg-[#fdf6e3] border border-amber-200/70 dark:bg-[#1a1a18] dark:border-border rounded-sm h-36 animate-pulse",
            ROTATIONS[i % ROTATIONS.length],
          )}
        />
      ))}
    </div>
  );
}

function Board({ filter, sort }: { filter: Filter; sort: Sort }) {
  const store = useStore();
  const router = useRouter();
  const me = store.requireUser();
  const posts = store.listISOPosts({ itemType: filter, sort });

  // "I have this" dialog state
  const [respondingTo, setRespondingTo] = useState<ISOPost | null>(null);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const myActiveListings = respondingTo
    ? store.listListings({ sellerId: me.id })
    : [];

  const openResponder = (post: ISOPost) => {
    setSelectedListingId(null);
    setNote("");
    setRespondingTo(post);
  };

  const updateStatus = (post: ISOPost, status: "found" | "closed") => {
    const res = store.updateISOStatus(post.id, status);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      status === "found" ? "Marked found. Hunt over." : "Post closed.",
    );
  };

  const sendResponse = () => {
    if (!respondingTo || !selectedListingId) return;
    const listing = store.getListing(selectedListingId);
    if (!listing) {
      toast.error("That listing is gone");
      return;
    }
    const tRes = store.getOrCreateThread(respondingTo.userId, {
      isoPostId: respondingTo.id,
    });
    if (!tRes.ok) {
      toast.error(tRes.error);
      return;
    }
    const body =
      `Re your ISO — I've got this: ${listing.title} → /app/listings/${listing.id}` +
      (note.trim() ? `\n\n${note.trim()}` : "");
    const mRes = store.sendMessage(tRes.value.id, body);
    if (!mRes.ok) {
      toast.error(mRes.error);
      return;
    }
    toast.success("Sent. Now you talk.");
    setRespondingTo(null);
    router.push(`/app/inbox/${tRes.value.id}`);
  };

  if (posts.length === 0) {
    return (
      <div className="text-center py-20 px-6">
        <PackageOpen size={32} className="mx-auto text-muted-foreground mb-3" />
        <p className="font-display font-bold text-xl text-muted-foreground mb-1">
          Nothing here yet.
        </p>
        <p className="text-sm text-muted-foreground mb-5">
          Be the first to poach it.
        </p>
        <Link
          href="/app/wanted/create"
          className="inline-flex items-center gap-1.5 bg-accent text-accent-foreground px-4 py-2.5 rounded-full text-xs font-display font-bold"
        >
          <Plus size={14} /> Post an ISO
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 pt-5 pb-8 flex flex-col gap-5">
      {posts.map((post, i) => {
        const mine = post.userId === me.id;
        return (
          <div
            key={post.id}
            className={cn(
              "relative bg-[#fdf6e3] border border-amber-200/70 dark:bg-[#1a1a18] dark:border-border rounded-sm p-4 shadow-md shadow-amber-950/10 dark:shadow-black/40",
              ROTATIONS[i % ROTATIONS.length],
            )}
          >
            {/* Pin dot */}
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-pop ring-2 ring-background shadow-[0_2px_6px_rgba(0,0,0,0.25)] dark:shadow-[0_2px_6px_rgba(0,0,0,0.6)]" />

            {/* Poster row */}
            <div className="flex items-center gap-2.5 pt-1 mb-2.5">
              <Link
                href={`/app/u/${post.user.username}`}
                className="flex items-center gap-2 min-w-0"
              >
                <span className="w-8 h-8 rounded-full overflow-hidden border border-border shrink-0">
                  {/* plain img: avatars may be data URLs */}
                  <img
                    src={post.user.avatar}
                    alt={post.user.displayName}
                    className="w-full h-full object-cover"
                  />
                </span>
                <span className="text-xs font-semibold text-accent truncate">
                  @{post.user.username}
                </span>
              </Link>
              <span
                className={cn(
                  "badge-stamp",
                  post.itemType === "jersey"
                    ? "text-sky-700 border-sky-700 dark:text-sky-400 dark:border-sky-400"
                    : "text-purple-700 border-purple-700 dark:text-purple-400 dark:border-purple-400",
                )}
              >
                {post.itemType === "jersey" ? "Jersey" : "Disc"}
              </span>
              <span className="ml-auto text-[11px] text-muted-foreground shrink-0">
                {timeAgo(post.createdAt)}
              </span>
            </div>

            {/* Description hero */}
            <p className="text-[15px] text-foreground font-medium leading-snug">
              {post.description}
            </p>

            {/* Detail badges */}
            {(post.team || post.size || post.maxPrice !== undefined) && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {post.team && (
                  <span className="badge-stamp text-foreground border-border">
                    {post.team}
                  </span>
                )}
                {post.size && (
                  <span className="badge-stamp text-muted-foreground border-border">
                    Size {post.size}
                  </span>
                )}
                {post.maxPrice !== undefined && (
                  <span className="badge-pill bg-sunny text-sunny-foreground">
                    Budget: {money(post.maxPrice)}
                  </span>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-amber-200/60 dark:border-border/70">
              <SaveButton
                targetType="iso"
                targetId={post.id}
                variant="bookmark"
                showCount={post.saves}
                size={15}
              />
              {mine ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateStatus(post, "found")}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-accent text-accent text-[11px] font-display font-bold hover:bg-accent/10 transition-colors"
                  >
                    <Check size={12} strokeWidth={2.5} /> Mark found
                  </button>
                  <button
                    type="button"
                    onClick={() => updateStatus(post, "closed")}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-border text-muted-foreground text-[11px] font-display font-bold hover:text-foreground transition-colors"
                  >
                    <X size={12} strokeWidth={2.5} /> Close
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openResponder(post)}
                  className="flex items-center gap-1.5 bg-accent text-accent-foreground px-3.5 py-1.5 rounded-full text-[11px] font-display font-bold"
                >
                  <PackageCheck size={13} /> I have this
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* "I have this" dialog */}
      <Dialog
        open={respondingTo !== null}
        onOpenChange={(open) => {
          if (!open) setRespondingTo(null);
        }}
      >
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display font-bold tracking-tight text-left">
              You&apos;ve got the goods?
            </DialogTitle>
            <DialogDescription className="text-left">
              {respondingTo
                ? `Pick which of your listings answers @${respondingTo.user.username}'s hunt.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {myActiveListings.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-4">
                You don&apos;t have any active listings to offer. List the item
                first, then come back and claim the glory.
              </p>
              <Link
                href="/app/create"
                className="inline-flex items-center gap-1.5 bg-accent text-accent-foreground px-4 py-2.5 rounded-full text-xs font-display font-bold"
              >
                <Plus size={14} /> List an item
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div
                className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto"
                role="radiogroup"
                aria-label="Pick a listing"
              >
                {myActiveListings.map((l) => {
                  const selected = selectedListingId === l.id;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setSelectedListingId(l.id)}
                      className={cn(
                        "text-left rounded-lg overflow-hidden border transition-colors",
                        selected
                          ? "border-accent ring-1 ring-accent"
                          : "border-border hover:border-muted-foreground",
                      )}
                    >
                      <span className="block aspect-square bg-surface relative">
                        {/* plain img: listing photos may be data URLs */}
                        <img
                          src={l.photos[0] || "/placeholder.jpg"}
                          alt={l.title}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        {selected && (
                          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
                            <Check size={10} strokeWidth={3} />
                          </span>
                        )}
                      </span>
                      <span className="block px-1.5 py-1 text-[10px] leading-tight text-foreground line-clamp-2">
                        {l.title}
                      </span>
                    </button>
                  );
                })}
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note — condition details, what you'd want for it…"
                rows={2}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors resize-none"
              />
              <button
                type="button"
                onClick={sendResponse}
                disabled={!selectedListingId}
                className="w-full bg-accent text-accent-foreground font-display font-bold py-3 rounded-full text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Send it
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
