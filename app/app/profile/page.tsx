"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Settings,
  MapPin,
  CalendarDays,
  Package,
  List,
  Star,
  Flag,
  MoreHorizontal,
  ShieldCheck,
} from "lucide-react";
import { TrustBadge, TrustScore } from "@/components/trust-badge";
import { ListingCard } from "@/components/listing-card";
import { DEMO_USERS, DEMO_LISTINGS, DEMO_ISO_POSTS } from "@/lib/seed-data";

const ME = DEMO_USERS[0];
const MY_LISTINGS = DEMO_LISTINGS.filter((l) => l.sellerId === ME.id);
const MY_ISO = DEMO_ISO_POSTS.filter((p) => p.userId === ME.id);

const COMPLETED_TRADES = [
  {
    id: "ct1",
    with: DEMO_USERS[1],
    gave: "Riot 2020 Practice Jersey",
    got: "2017 WFDF Disc",
    date: "Nov 10, 2024",
    rating: 5,
  },
  {
    id: "ct2",
    with: DEMO_USERS[2],
    gave: "Scandal 2019 Jersey",
    got: "Mixtape 2021 Jersey",
    date: "Oct 28, 2024",
    rating: 5,
  },
];

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<"listings" | "trades" | "wanted" | "ratings">("listings");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="font-display font-800 text-xl uppercase tracking-tight">
          My Profile
        </h1>
        <Link href="/app/profile/edit">
          <Settings size={20} className="text-muted-foreground" />
        </Link>
      </header>

      {/* Profile hero */}
      <div className="px-4 pt-5 pb-4 border-b border-border">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-accent">
              <Image
                src={ME.avatar}
                alt={ME.displayName}
                width={80}
                height={80}
                className="object-cover"
              />
            </div>
            {ME.isVerified && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                <ShieldCheck size={13} className="text-accent-foreground" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="font-display font-800 text-xl uppercase tracking-tight">
                {ME.displayName}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground mb-2">@{ME.username}</p>
            <TrustScore score={ME.trustScore} trades={ME.tradesCompleted} size="sm" />
          </div>
        </div>

        {/* Bio */}
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{ME.bio}</p>

        {/* Meta */}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin size={11} /> {ME.location}
          </span>
          <span className="flex items-center gap-1">
            <CalendarDays size={11} /> Since {new Date(ME.memberSince).getFullYear()}
          </span>
        </div>

        {/* Favorite teams */}
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {ME.favoriteTeams.map((team) => (
            <span
              key={team}
              className="text-xs bg-surface border border-border px-2 py-0.5 rounded-sm text-foreground"
            >
              {team}
            </span>
          ))}
        </div>

        {/* Badges */}
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {ME.badges.map((b) => (
            <TrustBadge key={b.id} badge={b} size="sm" />
          ))}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: "Listings", value: MY_LISTINGS.length },
            { label: "Trades", value: ME.tradesCompleted },
            { label: "Trust", value: ME.trustScore.toFixed(1) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-surface rounded-lg p-3 text-center border border-border">
              <p className="font-display font-800 text-xl text-accent">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto scrollbar-hide">
        {([
          { key: "listings", label: "Listings", icon: Package },
          { key: "trades", label: "Trades", icon: List },
          { key: "wanted", label: "Wanted", icon: Star },
          { key: "ratings", label: "Ratings", icon: Star },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-semibold uppercase tracking-wide border-b-2 transition-colors ${
              activeTab === key
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground"
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-4 py-4">
        {activeTab === "listings" && (
          <div>
            {MY_LISTINGS.length === 0 ? (
              <div className="text-center py-12">
                <p className="font-display font-700 text-xl uppercase text-muted-foreground mb-2">
                  No listings yet
                </p>
                <Link href="/app/create" className="text-accent text-sm font-semibold">
                  Post your first item
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {MY_LISTINGS.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "trades" && (
          <div className="flex flex-col gap-3">
            {COMPLETED_TRADES.map((trade) => (
              <div key={trade.id} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                    <Image
                      src={trade.with.avatar}
                      alt={trade.with.username}
                      width={36}
                      height={36}
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">@{trade.with.username}</p>
                    <p className="text-xs text-muted-foreground">{trade.date}</p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: trade.rating }).map((_, i) => (
                      <Star key={i} size={12} className="fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="flex-1 bg-surface rounded-sm p-2 text-center">
                    <p className="text-muted-foreground mb-0.5">Gave</p>
                    <p className="font-medium text-foreground">{trade.gave}</p>
                  </div>
                  <span className="text-muted-foreground flex-shrink-0">⟷</span>
                  <div className="flex-1 bg-surface rounded-sm p-2 text-center">
                    <p className="text-muted-foreground mb-0.5">Got</p>
                    <p className="font-medium text-foreground">{trade.got}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "wanted" && (
          <div className="flex flex-col gap-3">
            {MY_ISO.length === 0 ? (
              <div className="text-center py-12">
                <p className="font-display font-700 text-xl uppercase text-muted-foreground mb-2">
                  No wanted posts yet
                </p>
                <Link href="/app/wanted/create" className="text-accent text-sm font-semibold">
                  Post an ISO
                </Link>
              </div>
            ) : (
              MY_ISO.map((post) => (
                <div key={post.id} className="bg-card border border-border rounded-lg p-4">
                  <p className="text-sm leading-relaxed">{post.description}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-muted-foreground">{post.saves} saves</span>
                    <button className="text-xs text-muted-foreground">
                      <MoreHorizontal size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "ratings" && (
          <div className="flex flex-col gap-3">
            {[
              { from: DEMO_USERS[1], rating: 5, comment: "Shipped fast, item exactly as described. Would trade again.", date: "Nov 14" },
              { from: DEMO_USERS[2], rating: 5, comment: "Super easy to deal with. Honest about condition, great communication.", date: "Oct 30" },
            ].map((r, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                    <Image src={r.from.avatar} alt={r.from.username} width={32} height={32} className="object-cover" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold">@{r.from.username}</p>
                    <p className="text-xs text-muted-foreground">{r.date}</p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: r.rating }).map((_, j) => (
                      <Star key={j} size={12} className="fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{r.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
