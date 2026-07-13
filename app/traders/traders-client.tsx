"use client";

/**
 * Client half of /traders: searchable public directory of every onboarded
 * trader, rendered from the public store snapshot. Standalone page chrome
 * (shared header with the public profile pages), cards linking to
 * /u/[username].
 */

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, MapPin, Search, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHydrated, useStore } from "@/lib/store-context";
import { TrustBadge, TrustScore } from "@/components/trust-badge";
import { PublicSiteHeader } from "@/app/u/[username]/public-profile";
import type { User } from "@/lib/types";

function matchesQuery(user: User, q: string): boolean {
  if (
    user.displayName.toLowerCase().includes(q) ||
    user.username.toLowerCase().includes(q) ||
    user.location.toLowerCase().includes(q)
  ) {
    return true;
  }
  return user.favoriteTeams.some((team) => team.toLowerCase().includes(q));
}

function TraderCard({ user }: { user: User }) {
  return (
    <Link
      href={`/u/${user.username}`}
      className="bg-card border border-border rounded-xl p-4 flex items-start gap-3.5 card-lift"
    >
      <div className="w-14 h-14 rounded-full overflow-hidden border border-border flex-shrink-0">
        {/* plain img: avatars may be user-uploaded data URLs */}
        <img
          src={user.avatar}
          alt={user.displayName}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-sm font-semibold truncate">{user.displayName}</p>
          {user.isVerified && (
            <BadgeCheck size={14} className="text-accent flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-1.5">
          @{user.username}
        </p>
        <TrustScore
          score={user.trustScore}
          trades={user.tradesCompleted}
          size="sm"
        />
        {user.badges.length > 0 && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {user.badges.slice(0, 2).map((b) => (
              <TrustBadge key={b.id} badge={b} size="sm" />
            ))}
          </div>
        )}
        {user.location && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <MapPin size={11} className="flex-shrink-0" />
            <span className="truncate">{user.location}</span>
          </p>
        )}
      </div>
    </Link>
  );
}

function DirectorySkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-card border border-border rounded-xl p-4 flex items-start gap-3.5"
        >
          <div className="w-14 h-14 rounded-full bg-surface flex-shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3.5 w-28 bg-surface rounded" />
            <div className="h-2.5 w-20 bg-surface rounded" />
            <div className="h-2.5 w-32 bg-surface rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DirectoryBody() {
  const store = useStore();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const traders = store
    .listUsers()
    .filter((u) => (q ? matchesQuery(u, q) : true))
    .sort(
      (a, b) =>
        b.tradesCompleted - a.tradesCompleted || b.trustScore - a.trustScore,
    );

  return (
    <>
      {/* Search */}
      <div className="flex items-center gap-2 bg-card rounded-full px-4 py-2.5 border border-border mb-5">
        <Search size={16} className="text-muted-foreground flex-shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, @username, team, or location..."
          className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          aria-label="Search traders"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery("")}
          >
            <X
              size={14}
              className="text-muted-foreground hover:text-foreground"
            />
          </button>
        )}
      </div>

      {traders.length === 0 ? (
        <div className="text-center py-16 px-6">
          <Users size={26} className="mx-auto text-muted-foreground mb-3" />
          <p className="font-display font-bold text-xl text-muted-foreground mb-1">
            {q ? "No traders match that." : "No traders yet."}
          </p>
          <p className="text-sm text-muted-foreground mb-5">
            {q
              ? "Try a different name, team, or city."
              : "Be the first collector on the block."}
          </p>
          {q ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-accent text-sm font-semibold"
            >
              Clear search
            </button>
          ) : (
            <Link href="/login" className="text-accent text-sm font-semibold">
              Join free →
            </Link>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-3">
            {traders.length} trader{traders.length !== 1 ? "s" : ""}
            {q ? ` for "${query.trim()}"` : ""}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {traders.map((u) => (
              <TraderCard key={u.id} user={u} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

export function TradersDirectory() {
  const hydrated = useHydrated();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicSiteHeader />
      <main id="main-content" className="mx-auto max-w-lg md:max-w-3xl lg:max-w-4xl px-5 pt-7 pb-12">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">
          The community
        </p>
        <h1 className="font-display font-bold text-2xl tracking-tight mb-1">
          Traders
        </h1>
        <p className="text-sm text-muted-foreground mb-5">
          Every collector on the block — trust scores and badges are public,
          and earned, never bought.
        </p>
        {hydrated ? <DirectoryBody /> : <DirectorySkeleton />}
      </main>
    </div>
  );
}
