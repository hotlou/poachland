"use client";

import { useState } from "react";
import Link from "next/link";
import { Bookmark, Heart, ArrowUpRight } from "lucide-react";
import { ListingCard } from "@/components/listing-card";
import { SaveButton } from "@/components/save-button";
import { Hydrated } from "@/components/hydrated";
import { useStore } from "@/lib/store-context";
import type { ISOPost } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tab = "listings" | "wanted";

function TabsSkeleton() {
  return (
    <div className="px-4 py-4">
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-lg overflow-hidden">
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
      className="relative bg-card border border-border rounded-sm p-4"
      style={{ transform: `rotate(${rot}deg)` }}
    >
      {/* Pin dot */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-accent shadow-md border-2 border-background" />

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
                  ? "text-sky-400 border-sky-400"
                  : "text-purple-400 border-purple-400",
              )}
            >
              {post.itemType}
            </span>
            {post.status !== "active" && (
              <span
                className={cn(
                  "badge-stamp text-[9px]",
                  post.status === "found"
                    ? "text-emerald-400 border-emerald-400"
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
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 pt-3">
        <h1 className="font-display font-bold text-xl uppercase tracking-tight mb-3">Saved</h1>
        <div className="flex gap-6">
          {(
            [
              { key: "listings", label: "Listings", icon: Heart, count: listings.length },
              { key: "wanted", label: "Wanted", icon: Bookmark, count: isoPosts.length },
            ] as const
          ).map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-1.5 pb-2.5 text-xs font-display font-bold uppercase tracking-wider border-b-2 -mb-px transition-colors",
                tab === key
                  ? "text-accent border-accent"
                  : "text-muted-foreground border-transparent hover:text-foreground",
              )}
            >
              <Icon size={13} />
              {label}
              <Hydrated fallback={null}>
                <span className="tabular-nums">({count})</span>
              </Hydrated>
            </button>
          ))}
        </div>
      </header>

      <Hydrated fallback={<TabsSkeleton />}>
        {tab === "listings" ? (
          <div className="px-4 py-4">
            {listings.length === 0 ? (
              <div className="text-center py-16 px-6">
                <Heart size={28} className="mx-auto mb-3 text-muted-foreground" />
                <p className="font-display font-bold text-xl uppercase text-muted-foreground mb-1">
                  Nothing saved yet.
                </p>
                <p className="text-sm text-muted-foreground mb-5">
                  Tap the heart on a listing to keep tabs on it before someone else poaches it.
                </p>
                <Link
                  href="/app/browse"
                  className="inline-block bg-accent text-accent-foreground px-4 py-2 rounded-sm text-xs font-display font-bold uppercase tracking-wide"
                >
                  Browse the market
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {listings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="px-4 py-5">
            {isoPosts.length === 0 ? (
              <div className="text-center py-16 px-6">
                <Bookmark size={28} className="mx-auto mb-3 text-muted-foreground" />
                <p className="font-display font-bold text-xl uppercase text-muted-foreground mb-1">
                  No wanted posts saved.
                </p>
                <p className="text-sm text-muted-foreground mb-5">
                  Bookmark an ISO to keep an eye on what other collectors are hunting.
                </p>
                <Link
                  href="/app/wanted"
                  className="inline-block bg-accent text-accent-foreground px-4 py-2 rounded-sm text-xs font-display font-bold uppercase tracking-wide"
                >
                  Scan the Wanted Board
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {isoPosts.map((post, i) => (
                  <SavedISOCard key={post.id} post={post} index={i} />
                ))}
              </div>
            )}
          </div>
        )}
      </Hydrated>
    </div>
  );
}
