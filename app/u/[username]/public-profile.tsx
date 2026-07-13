"use client";

/**
 * Public trader profile — the SEO-facing, signed-out-friendly version of
 * /app/u/[username]. Standalone page chrome (no app shell): light header with
 * the wordmark + join CTA, the profile body, and a join-funnel card at the
 * bottom. Data comes from the public store snapshot (fetchBootstrap returns
 * public collections with me:null when signed out).
 */

import Link from "next/link";
import {
  BadgeCheck,
  CalendarDays,
  History,
  Images,
  MapPin,
  Package,
  Star,
  UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHydrated, useStore } from "@/lib/store-context";
import { IdentityChips } from "@/components/identity-chips";
import { ListingCard } from "@/components/listing-card";
import { TrustBadge, TrustScore } from "@/components/trust-badge";
import { formatMonthYear, timeAgo } from "@/lib/format";
import type { HistoryEntry, User } from "@/lib/types";

const pillPrimary =
  "inline-flex items-center justify-center gap-2 bg-accent text-accent-foreground text-sm font-semibold rounded-full shadow-sm hover:opacity-90 transition-opacity";

/* ── Shared standalone-page header (also used by /traders) ───────────────── */

export function PublicSiteHeader() {
  const store = useStore();
  const ready = useHydrated();
  const signedIn = ready && !!store.sessionMe;
  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="mx-auto max-w-lg md:max-w-3xl lg:max-w-4xl flex items-center justify-between px-5 py-3.5">
        <Link
          href="/"
          className="font-display font-black text-xl tracking-tight text-accent"
        >
          Poachland
        </Link>
        {signedIn ? (
          <Link href="/app" className={cn(pillPrimary, "px-5 py-2")}>
            Enter Poachland
          </Link>
        ) : (
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Log in
            </Link>
            <Link href="/login" className={cn(pillPrimary, "px-5 py-2")}>
              Join free
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

/* ── Loading / missing states ────────────────────────────────────────────── */

function ProfileSkeleton() {
  return (
    <div className="px-5 pt-8 space-y-5 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-surface" />
        <div className="flex-1 space-y-2.5">
          <div className="h-5 w-40 bg-surface rounded" />
          <div className="h-3 w-24 bg-surface rounded" />
          <div className="h-3 w-32 bg-surface rounded" />
        </div>
      </div>
      <div className="h-28 bg-surface rounded-xl" />
      <div className="h-16 bg-surface rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="aspect-[4/3] bg-surface rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function NoSuchTrader({ username }: { username: string }) {
  return (
    <div className="px-5 py-24 text-center">
      <UserX size={28} className="mx-auto text-muted-foreground mb-3" />
      <h1 className="font-display font-bold text-2xl tracking-tight mb-1">
        No such trader
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Nobody goes by @{username} around here.
      </p>
      <Link href="/traders" className="text-accent text-sm font-semibold">
        Meet the traders →
      </Link>
    </div>
  );
}

/* ── Sections ────────────────────────────────────────────────────────────── */

const HISTORY_KIND_META: Record<
  HistoryEntry["kind"],
  { label: string; cls: string }
> = {
  team: { label: "Team", cls: "text-accent border-accent" },
  tournament: { label: "Tournament", cls: "text-pop border-pop" },
  league: { label: "League", cls: "text-muted-foreground border-border" },
};

function PlayingHistory({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) return null;
  return (
    <section className="px-5 pt-7">
      <div className="flex items-center gap-1.5 mb-3">
        <History size={15} className="text-accent" />
        <h2 className="font-display font-bold text-base tracking-tight">
          Playing history
        </h2>
      </div>
      <div className="flex flex-col gap-2">
        {history.map((entry) => (
          <div
            key={entry.id}
            className="bg-card border border-border rounded-xl px-3.5 py-3"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn("badge-stamp", HISTORY_KIND_META[entry.kind].cls)}
              >
                {HISTORY_KIND_META[entry.kind].label}
              </span>
              <span className="text-sm font-semibold">{entry.name}</span>
              {entry.years && (
                <span className="text-xs text-muted-foreground">
                  {entry.years}
                </span>
              )}
            </div>
            {entry.note && (
              <p className="text-sm text-muted-foreground leading-relaxed mt-1.5">
                {entry.note}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Gallery({ user }: { user: User }) {
  const gallery = user.gallery ?? [];
  if (gallery.length === 0) return null;
  return (
    <section className="px-5 pt-7">
      <div className="flex items-center gap-1.5 mb-3">
        <Images size={15} className="text-accent" />
        <h2 className="font-display font-bold text-base tracking-tight">
          Gallery
        </h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {gallery.map((photo, i) => (
          <div
            key={`${photo.slice(0, 32)}-${i}`}
            className="aspect-square rounded-xl overflow-hidden border border-border bg-surface"
          >
            {/* plain img: gallery photos may be user-uploaded data URLs */}
            <img
              src={photo}
              alt={`${user.displayName} — gallery photo ${i + 1}`}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentRatings({ user }: { user: User }) {
  const store = useStore();
  const ratings = store.ratingsFor(user.id).slice(0, 3);
  return (
    <section className="px-5 pt-7">
      <div className="flex items-center gap-1.5 mb-3">
        <Star size={15} className="text-accent" />
        <h2 className="font-display font-bold text-base tracking-tight">
          Recent ratings
        </h2>
      </div>
      {ratings.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No ratings yet. Every legend starts at zero.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {ratings.map((r) => {
            const overall =
              (r.communication + r.shippingSpeed + r.itemAccuracy) / 3;
            return (
              <div
                key={r.id}
                className="bg-card border border-border rounded-xl p-3"
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <Link
                    href={`/u/${r.fromUser.username}`}
                    className="w-8 h-8 rounded-full overflow-hidden border border-border flex-shrink-0"
                  >
                    {/* plain img: avatars may be data URLs */}
                    <img
                      src={r.fromUser.avatar}
                      alt={r.fromUser.displayName}
                      className="w-full h-full object-cover"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">
                      @{r.fromUser.username}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {timeAgo(r.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={11}
                        className={cn(
                          s <= Math.round(overall)
                            ? "fill-amber-500 text-amber-500 dark:fill-yellow-400 dark:text-yellow-400"
                            : "fill-transparent text-muted-foreground",
                        )}
                        strokeWidth={1.5}
                      />
                    ))}
                  </div>
                </div>
                {r.comment && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    "{r.comment}"
                  </p>
                )}
                {r.wouldTradeAgain && (
                  <p className="text-[11px] text-accent font-semibold mt-1.5">
                    Would trade again
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function JoinCta({ user }: { user: User }) {
  const store = useStore();
  const signedIn = !!store.sessionMe;
  return (
    <section className="px-5 pt-8 pb-12">
      <div className="bg-card border border-border rounded-xl p-7 md:p-9 text-center">
        {signedIn ? (
          <>
            <h2 className="font-display font-black text-2xl tracking-tight mb-2 text-balance">
              Want to trade with @{user.username}?
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              Open their profile inside Poachland to message them or propose a
              deal.
            </p>
            <Link
              href={`/app/u/${user.username}`}
              className={cn(pillPrimary, "px-6 py-3")}
            >
              Open in Poachland
            </Link>
          </>
        ) : (
          <>
            <h2 className="font-display font-black text-2xl tracking-tight mb-2 text-balance">
              Want to trade with @{user.username}?
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              Join free — takes one email. No fees, no middleman.
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

/* ── Profile body ────────────────────────────────────────────────────────── */

function ProfileBody({ user }: { user: User }) {
  const store = useStore();
  const listings = store.listListings({ sellerId: user.id });

  return (
    <>
      {/* Hero */}
      <div className="px-5 pt-7 pb-5 border-b border-border">
        <div className="flex items-start gap-4 md:gap-6">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden ring-2 ring-accent ring-offset-2 ring-offset-background flex-shrink-0">
            {/* plain img: avatars may be user-uploaded data URLs */}
            <img
              src={user.avatar}
              alt={user.displayName}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="font-display font-bold text-2xl tracking-tight truncate">
                {user.displayName}
              </h1>
              {user.isVerified && (
                <BadgeCheck size={18} className="text-accent flex-shrink-0" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">@{user.username}</p>
            <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-0.5 md:gap-x-4 mt-2 text-xs text-muted-foreground">
              {user.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={11} /> {user.location}
                </span>
              )}
              <span className="flex items-center gap-1">
                <CalendarDays size={11} /> Member since{" "}
                {formatMonthYear(user.memberSince)}
              </span>
            </div>
          </div>
        </div>

        {/* Trust card */}
        <div className="mt-4 bg-card border border-border border-l-2 border-l-accent rounded-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Trust Score
              </p>
              <TrustScore
                score={user.trustScore}
                trades={user.tradesCompleted}
                size="lg"
              />
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-display font-bold text-3xl text-accent leading-none">
                {user.tradesCompleted}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                Trades done
              </p>
            </div>
          </div>
          {user.badges.length > 0 && (
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {user.badges.map((b) => (
                <TrustBadge key={b.id} badge={b} size="sm" />
              ))}
            </div>
          )}
        </div>

        {/* Linked identities */}
        <IdentityChips userId={user.id} />

        {/* Bio */}
        {user.bio && (
          <p className="text-sm text-muted-foreground leading-relaxed mt-3">
            {user.bio}
          </p>
        )}

        {/* Favorite teams */}
        {user.favoriteTeams.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {user.favoriteTeams.map((team) => (
              <span
                key={team}
                className="text-[13px] bg-card border border-border px-3 py-1 rounded-full text-foreground"
              >
                {team}
              </span>
            ))}
          </div>
        )}
      </div>

      <PlayingHistory history={user.history ?? []} />
      <Gallery user={user} />

      {/* Active listings */}
      <section className="px-5 pt-7">
        <div className="flex items-center gap-1.5 mb-3">
          <Package size={15} className="text-accent" />
          <h2 className="font-display font-bold text-base tracking-tight">
            On the block
          </h2>
          <span className="badge-stamp text-muted-foreground border-border ml-1">
            {listings.length}
          </span>
        </div>
        {listings.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nothing listed right now. Check back later.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>

      <RecentRatings user={user} />
      <JoinCta user={user} />
    </>
  );
}

/* ── Entry ───────────────────────────────────────────────────────────────── */

export function PublicProfile({ username }: { username: string }) {
  const store = useStore();
  const hydrated = useHydrated();
  const user = store.getUserByUsername(username);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicSiteHeader />
      <main id="main-content" className="mx-auto max-w-lg md:max-w-3xl lg:max-w-4xl">
        {!hydrated ? (
          <ProfileSkeleton />
        ) : user ? (
          <ProfileBody user={user} />
        ) : (
          <NoSuchTrader username={username} />
        )}
      </main>
    </div>
  );
}
