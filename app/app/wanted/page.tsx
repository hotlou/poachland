"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Plus, Heart, Bell, Disc3, Shirt } from "lucide-react";
import { DEMO_ISO_POSTS } from "@/lib/seed-data";
import { cn } from "@/lib/utils";

export default function WantedBoardPage() {
  const [filter, setFilter] = useState<"all" | "jersey" | "disc">("all");
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());

  const filtered = filter === "all" ? DEMO_ISO_POSTS : DEMO_ISO_POSTS.filter((p) => p.itemType === filter);

  const toggleSave = (id: string) => {
    setSavedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-display font-800 text-xl uppercase tracking-tight">
            Wanted Board
          </h1>
          <Link
            href="/app/wanted/create"
            className="flex items-center gap-1.5 bg-accent text-accent-foreground px-3 py-2 rounded-sm text-xs font-display font-700 uppercase tracking-wide"
          >
            <Plus size={14} /> Post ISO
          </Link>
        </div>
        <div className="flex gap-2">
          {([
            { key: "all", label: "All" },
            { key: "jersey", label: "Jerseys", icon: Shirt },
            { key: "disc", label: "Discs", icon: Disc3 },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-semibold uppercase tracking-wide border transition-colors",
                filter === key
                  ? "bg-accent text-accent-foreground border-accent"
                  : "text-muted-foreground border-border",
              )}
            >
              {Icon && <Icon size={12} />}
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Description */}
      <div className="px-4 py-3 bg-surface border-b border-border">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Players looking for specific items. Save a post to get notified when a matching listing drops.
        </p>
      </div>

      {/* ISO grid — bulletin board feel */}
      <div className="p-4">
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((post, i) => {
            const rotations = [-1, 1, -0.5, 0.5, -1.5];
            const rot = rotations[i % rotations.length];
            return (
              <div
                key={post.id}
                className="relative bg-card border border-border rounded-sm p-4"
                style={{ transform: `rotate(${rot}deg)` }}
              >
                {/* Pin dot */}
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-accent shadow-md border-2 border-background" />

                <div className="flex items-start gap-3 pt-1">
                  <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-border">
                    <Image
                      src={post.user.avatar}
                      alt={post.user.username}
                      width={40}
                      height={40}
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-semibold text-accent">@{post.user.username}</p>
                      <span className={cn(
                        "badge-stamp text-[9px]",
                        post.itemType === "jersey"
                          ? "text-sky-400 border-sky-400"
                          : "text-purple-400 border-purple-400"
                      )}>
                        {post.itemType}
                      </span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{post.description}</p>

                    {post.team && (
                      <p className="text-xs text-muted-foreground mt-1">Team: {post.team}</p>
                    )}
                    {post.size && (
                      <p className="text-xs text-muted-foreground">Size: {post.size}</p>
                    )}
                    {post.maxPrice && (
                      <p className="text-xs text-accent font-semibold mt-1">
                        Will pay up to ${post.maxPrice}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    {new Date(post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Heart size={11} /> {post.saves + (savedPosts.has(post.id) ? 1 : 0)}
                    </span>
                    <button
                      onClick={() => toggleSave(post.id)}
                      className={cn(
                        "flex items-center gap-1 text-xs font-semibold transition-colors",
                        savedPosts.has(post.id) ? "text-accent" : "text-muted-foreground",
                      )}
                    >
                      <Bell size={12} />
                      {savedPosts.has(post.id) ? "Watching" : "Alert me"}
                    </button>
                    <Link
                      href={`/app/inbox?to=${post.userId}`}
                      className="text-xs font-semibold text-foreground"
                    >
                      I have it
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="font-display font-700 text-xl uppercase text-muted-foreground mb-2">
              Nothing posted yet.
            </p>
            <p className="text-sm text-muted-foreground mb-4">Be the first to poach it.</p>
            <Link href="/app/wanted/create" className="text-accent text-sm font-semibold">
              Post an ISO
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
