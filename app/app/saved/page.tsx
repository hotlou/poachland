"use client";

import { useState } from "react";
import Link from "next/link";
import { Bookmark, Heart, ArrowUpRight, BellRing, Trash2 } from "lucide-react";
import { ListingCard } from "@/components/listing-card";
import { SaveButton } from "@/components/save-button";
import { Hydrated } from "@/components/hydrated";
import { useStore } from "@/lib/store-context";
import type { ISOPost } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tab = "listings" | "wanted" | "searches";

function TabsSkeleton() {
  return (
    <div className="px-4 md:px-6 py-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="aspect-[4/3] bg-surface animate-pulse" />
            <div className="p-3 space-y-2">
              <div className="h-2.5 w-2/3 bg-surface rounded-sm animate-pulse" />
              <div className="h-3.5 w-full bg-surface rounded-sm animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SavedISOCard({ post, index }: { post: ISOPost; index: number }) {
  const rotations = [-1, 1, -0.5, 0.5, -1.5];
  const rot = rotations[index % rotations.length];
  return (
    <div
      className="relative bg-[#fdf6e3] border border-amber-200/70 dark:bg-[#1a1a18] dark:border-border rounded-sm p-4"
      style={{ transform: `rotate(${rot}deg)` }}
    >
      {/* Pin dot */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-pop shadow-md border-2 border-background" />

      <div className="flex items-start gap-3 pt-1">
        <Link
          href={`/app/u/${post.user.username}`}
          className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-border"
        >
          {/* plain img: avatars may be data URLs */}
          <img
            src={post.user.avatar}
            alt={post.user.username}
            className="object-cover w-full h-full"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Link
              href={`/app/u/${post.user.username}`}
              className="text-xs font-semibold text-accent"
            >
              @{post.user.username}
            </Link>
            <span
              className={cn(
                "badge-stamp text-[9px]",
                post.itemType === "jersey"
                  ? "text-sky-700 border-sky-700 dark:text-sky-400 dark:border-sky-400"
                  : "text-purple-700 border-purple-700 dark:text-purple-400 dark:border-purple-400",
              )}
            >
              {post.itemType}
            </span>
            {post.status !== "active" && (
              <span
                className={cn(
                  "badge-stamp text-[9px]",
                  post.status === "found"
                    ? "text-emerald-700 border-emerald-700 dark:text-emerald-400 dark:border-emerald-400"
                    : "text-muted-foreground border-border",
                )}
              >
                {post.status === "found" ? "Found" : "Closed"}
              </span>
            )}
          </div>
          <p className="text-sm text-foreground leading-relaxed">{post.description}</p>
          {post.team && <p className="text-xs text-muted-foreground mt-1">Team: {post.team}</p>}
          {post.size && <p className="text-xs text-muted-foreground">Size: {post.size}</p>}
          {post.maxPrice !== undefined && (
            <p className="text-xs text-accent font-semibold mt-1">
              Will pay up to ${post.maxPrice}
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-amber-200/70 dark:border-border">
        <span className="text-xs text-muted-foreground">{timeAgo(post.createdAt)}</span>
        <div className="flex items-center gap-4">
          <SaveButton
            targetType="iso"
            targetId={post.id}
            variant="bookmark"
            showCount={post.saves}
            size={14}
          />
          <Link
            href="/app/wanted"
            className="text-xs font-semibold text-foreground inline-flex items-center gap-0.5 hover:text-accent transition-colors"
          >
            Wanted Board <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SavedPage() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>("listings");

  const listings = store.savedListings();
  const isoPosts = store.savedISOPosts();
  const searches = store.listSavedSearches();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 md:top-14 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 md:px-6 pt-3 pb-3">
        <h1 className="font-display font-bold text-xl tracking-tight mb-3">Saved</h1>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: "listings", label: "Listings", icon: Heart, count: listings.length },
              { key: "wanted", label: "Wanted", icon: Bookmark, count: isoPosts.length },
              { key: "searches", label: "Searches", icon: BellRing, count: searches.length },
            ] as const
          ).map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-colors",
                tab === key
                  ? "bg-accent text-accent-foreground border-accent shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:text-foreground",
              )}
            >
              <Icon size={13} />
              {label}
              <Hydrated fallback={null}>
                <span
                  className={cn(
                    "min-w-4 h-4 px-1 rounded-full text-[10px] font-semibold tabular-nums flex items-center justify-center",
                    tab === key ? "bg-accent-foreground/15" : "bg-surface",
                  )}
                >
                  {count}
                </span>
              </Hydrated>
            </button>
          ))}
        </div>
      </header>

      <Hydrated fallback={<TabsSkeleton />}>
        {tab === "listings" ? (
          <div className="px-4 md:px-6 py-4">
            {listings.length === 0 ? (
              <div className="text-center py-16 px-6">
                <Heart size={28} className="mx-auto mb-3 text-muted-foreground" />
                <p className="font-display font-bold text-xl text-muted-foreground mb-1">
                  Nothing saved yet.
                </p>
                <p className="text-sm text-muted-foreground mb-5">
                  Tap the heart on a listing to keep tabs on it before someone else poaches it.
                </p>
                <Link
                  href="/app/browse"
                  className="inline-block bg-accent text-accent-foreground px-5 py-2.5 rounded-full text-sm font-semibold shadow-sm"
                >
                  Browse the market
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                {listings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}
          </div>
        ) : tab === "wanted" ? (
          <div className="px-4 md:px-6 py-5">
            {isoPosts.length === 0 ? (
              <div className="text-center py-16 px-6">
                <Bookmark size={28} className="mx-auto mb-3 text-muted-foreground" />
                <p className="font-display font-bold text-xl text-muted-foreground mb-1">
                  No wanted posts saved.
                </p>
                <p className="text-sm text-muted-foreground mb-5">
                  Bookmark an ISO to keep an eye on what other collectors are hunting.
                </p>
                <Link
                  href="/app/wanted"
                  className="inline-block bg-accent text-accent-foreground px-5 py-2.5 rounded-full text-sm font-semibold shadow-sm"
                >
                  Scan the Wanted Board
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 items-start">
                {isoPosts.map((post, i) => (
                  <SavedISOCard key={post.id} post={post} index={i} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="px-4 py-5 md:px-6">
            {searches.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <BellRing size={28} className="mx-auto mb-3 text-muted-foreground" />
                <p className="mb-1 font-display text-xl font-bold text-muted-foreground">No saved searches.</p>
                <p className="mb-5 text-sm text-muted-foreground">Filter the market, save the search, and Poachland will flag new matches.</p>
                <Link href="/app/browse" className="inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm">Build a search</Link>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {searches.map((search) => {
                  const params = new URLSearchParams();
                  if (search.query) params.set("q", search.query);
                  if (search.itemType) params.set("itemType", search.itemType);
                  if (search.listingType) params.set("listingType", search.listingType);
                  if (search.condition) params.set("condition", search.condition);
                  if (search.team) params.set("team", search.team);
                  if (search.size) params.set("size", search.size);
                  if (search.maxPrice !== undefined) params.set("maxPrice", String(search.maxPrice));
                  const criteria = [search.query, search.itemType, search.listingType, search.condition, search.team, search.size, search.maxPrice !== undefined ? `≤ $${search.maxPrice}` : null].filter(Boolean);
                  return (
                    <div key={search.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <Link href={`/app/browse?${params}`} className="font-display font-bold hover:text-accent">{search.name}</Link>
                          <p className="mt-1 text-xs text-muted-foreground">{criteria.join(" · ")}</p>
                          <p className="mt-2 text-[11px] text-muted-foreground">Notifications on{search.lastMatchedAt ? ` · last match ${timeAgo(search.lastMatchedAt)}` : " · waiting for a match"}</p>
                        </div>
                        <button type="button" onClick={() => store.deleteSavedSearch(search.id)} aria-label={`Delete saved search ${search.name}`} className="rounded-full p-2 text-muted-foreground hover:bg-surface hover:text-destructive"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Hydrated>
    </div>
  );
}
