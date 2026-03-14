"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bell, Flame, Disc3, Shirt, TrendingUp, ChevronRight } from "lucide-react";
import { ListingCard } from "@/components/listing-card";
import { TrustBadge, TrustScore } from "@/components/trust-badge";
import {
  DEMO_LISTINGS,
  DEMO_ISO_POSTS,
  DEMO_USERS,
} from "@/lib/seed-data";

export default function HomeFeedPage() {
  const [activeTab, setActiveTab] = useState<"all" | "jerseys" | "discs">("all");

  const featured = DEMO_LISTINGS.filter((l) => l.isFeatured);
  const recent = DEMO_LISTINGS.slice(0, 6);
  const filtered =
    activeTab === "all"
      ? recent
      : recent.filter((l) => l.type === (activeTab === "jerseys" ? "jersey" : "disc"));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between">
        <span className="font-display font-900 text-xl uppercase tracking-tight text-accent">
          Poachland
        </span>
        <div className="flex items-center gap-3">
          <Link href="/app/notifications" className="relative text-muted-foreground">
            <Bell size={20} />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent rounded-full" />
          </Link>
          <Link href="/app/profile">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-border">
              <Image
                src={DEMO_USERS[0].avatar}
                alt="My profile"
                width={32}
                height={32}
                className="object-cover"
              />
            </div>
          </Link>
        </div>
      </header>

      {/* Profile nudge */}
      <div className="mx-4 mt-4 p-3 bg-accent-dim border border-accent/30 rounded-lg flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-accent">Complete your profile</p>
          <p className="text-xs text-muted-foreground">Add a bio + favorite teams to unlock trust badges.</p>
        </div>
        <Link href="/app/profile/edit" className="text-xs font-bold text-accent flex items-center gap-1 flex-shrink-0 ml-2">
          Go <ChevronRight size={12} />
        </Link>
      </div>

      {/* Featured rare items */}
      <section className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-800 text-lg uppercase tracking-tight flex items-center gap-1.5">
            <Flame size={16} className="text-accent" /> Hot right now
          </h2>
          <Link href="/app/browse?sort=featured" className="text-xs text-accent font-semibold">
            See all
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {featured.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              className="flex-shrink-0 w-52"
            />
          ))}
        </div>
      </section>

      {/* Community activity */}
      <section className="px-4 mt-6">
        <div className="flex items-center gap-1.5 mb-3">
          <TrendingUp size={16} className="text-accent" />
          <h2 className="font-display font-800 text-lg uppercase tracking-tight">
            Activity
          </h2>
        </div>
        <div className="flex flex-col gap-2">
          {[
            { user: DEMO_USERS[1], action: "just listed", item: "2011 UPA Championship Disc", time: "3m" },
            { user: DEMO_USERS[0], action: "completed a trade with", item: "huck_and_pray", time: "1h" },
            { user: DEMO_USERS[2], action: "posted a wanted for", item: "WFDF Cologne '17 disc", time: "2h" },
          ].map((act, i) => (
            <div key={i} className="flex items-center gap-2.5 py-2 border-b border-border last:border-0">
              <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                <Image src={act.user.avatar} alt={act.user.username} width={28} height={28} className="object-cover" />
              </div>
              <p className="text-xs text-muted-foreground flex-1 leading-relaxed">
                <span className="text-foreground font-medium">@{act.user.username}</span>{" "}
                {act.action}{" "}
                <span className="text-foreground">{act.item}</span>
              </p>
              <span className="text-xs text-muted-foreground flex-shrink-0">{act.time}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Recent listings */}
      <section className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-800 text-lg uppercase tracking-tight">
            Fresh drops
          </h2>
          <Link href="/app/browse" className="text-xs text-accent font-semibold">
            Browse all
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {[
            { key: "all", label: "All" },
            { key: "jerseys", label: "Jerseys", icon: Shirt },
            { key: "discs", label: "Discs", icon: Disc3 },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as typeof activeTab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-semibold uppercase tracking-wide border transition-colors ${
                activeTab === key
                  ? "bg-accent text-accent-foreground border-accent"
                  : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
              }`}
            >
              {Icon && <Icon size={12} />}
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {filtered.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      </section>

      {/* Wanted board snippet */}
      <section className="px-4 mt-6 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-800 text-lg uppercase tracking-tight">
            Wanted board
          </h2>
          <Link href="/app/wanted" className="text-xs text-accent font-semibold">
            See all
          </Link>
        </div>
        <div className="flex flex-col gap-2">
          {DEMO_ISO_POSTS.slice(0, 3).map((post) => (
            <Link
              key={post.id}
              href={`/app/wanted/${post.id}`}
              className="flex items-start gap-3 p-3.5 bg-card border border-border rounded-lg"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                <Image
                  src={post.user.avatar}
                  alt={post.user.username}
                  width={32}
                  height={32}
                  className="object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">@{post.user.username}</p>
                <p className="text-sm leading-snug line-clamp-2">{post.description}</p>
                <p className="text-xs text-muted-foreground mt-1">{post.saves} saves</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Spotlight trader */}
      <section className="px-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">
            Trader spotlight
          </p>
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2 border-accent">
              <Image
                src={DEMO_USERS[0].avatar}
                alt={DEMO_USERS[0].displayName}
                width={48}
                height={48}
                className="object-cover"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-semibold text-sm">{DEMO_USERS[0].displayName}</p>
                <span className="text-xs text-muted-foreground">@{DEMO_USERS[0].username}</span>
              </div>
              <TrustScore score={DEMO_USERS[0].trustScore} trades={DEMO_USERS[0].tradesCompleted} size="sm" />
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                {DEMO_USERS[0].bio}
              </p>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {DEMO_USERS[0].badges.map((b) => (
                  <TrustBadge key={b.id} badge={b} size="sm" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
