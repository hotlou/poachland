"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Bookmark,
  CalendarDays,
  ChevronRight,
  History,
  Link2,
  MapPin,
  Package,
  Pencil,
  Search,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store-context";
import { Hydrated } from "@/components/hydrated";
import { ListingCard } from "@/components/listing-card";
import { TrustBadge, TrustScore } from "@/components/trust-badge";
import { formatDate, formatMonthYear, timeAgo } from "@/lib/format";
import { DEAL_KIND_LABELS } from "@/lib/constants";
import type { ISOStatus } from "@/lib/types";

/* ── ISO status stamps ───────────────────────────────────────────────────── */

const ISO_STATUS_STYLES: Record<ISOStatus, string> = {
  active: "text-accent border-accent",
  found: "text-emerald-400 border-emerald-400",
  closed: "text-muted-foreground border-border",
};

const ISO_STATUS_LABELS: Record<ISOStatus, string> = {
  active: "Hunting",
  found: "Found",
  closed: "Closed",
};

/* ── Skeleton fallback while the browser store hydrates ──────────────────── */

function ProfileSkeleton() {
  return (
    <div className="px-4 pt-5 space-y-4 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-surface" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-36 bg-surface rounded" />
          <div className="h-3 w-24 bg-surface rounded" />
        </div>
      </div>
      <div className="h-24 bg-surface rounded-lg" />
      <div className="h-16 bg-surface rounded-lg" />
    </div>
  );
}

/* ── Wanted tab ──────────────────────────────────────────────────────────── */

function WantedTab({ userId }: { userId: string }) {
  const store = useStore();
  const posts = store.listISOPosts({
    userId,
    statuses: ["active", "found", "closed"],
  });

  const setStatus = (id: string, status: ISOStatus, msg: string) => {
    const res = store.updateISOStatus(id, status);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(msg);
  };

  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <Search size={24} className="mx-auto text-muted-foreground mb-3" />
        <p className="font-display font-bold uppercase text-muted-foreground mb-1">
          Not hunting anything
        </p>
        <p className="text-sm text-muted-foreground mb-3">
          Post an ISO and let the goods come to you.
        </p>
        <Link href="/app/wanted" className="text-accent text-sm font-semibold">
          Go to the wanted board →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {posts.map((post) => (
        <div key={post.id} className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="badge-stamp text-muted-foreground border-border">
                ISO {post.itemType}
              </span>
              <span className={cn("badge-stamp", ISO_STATUS_STYLES[post.status])}>
                {ISO_STATUS_LABELS[post.status]}
              </span>
            </div>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {timeAgo(post.createdAt)}
            </span>
          </div>
          <p
            className={cn(
              "text-sm leading-relaxed",
              post.status !== "active" && "text-muted-foreground",
            )}
          >
            {post.description}
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            {post.team && <span>{post.team}</span>}
            {post.size && <span>Size {post.size}</span>}
            {post.maxPrice !== undefined && <span>Up to ${post.maxPrice}</span>}
            <span className="ml-auto">{post.saves} saves</span>
          </div>
          <div className="flex gap-2 mt-3">
            {post.status === "active" ? (
              <>
                <button
                  type="button"
                  onClick={() => setStatus(post.id, "found", "Nice poach. Marked found.")}
                  className="flex-1 py-1.5 rounded-md bg-accent text-accent-foreground text-xs font-semibold"
                >
                  Mark found
                </button>
                <button
                  type="button"
                  onClick={() => setStatus(post.id, "closed", "Hunt closed.")}
                  className="flex-1 py-1.5 rounded-md border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  Close
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setStatus(post.id, "active", "Back on the hunt.")}
                className="flex-1 py-1.5 rounded-md border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Reopen hunt
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── History tab ─────────────────────────────────────────────────────────── */

function HistoryTab({ userId }: { userId: string }) {
  const store = useStore();
  const deals = store.dealsForUser(userId, { statuses: ["completed"] });

  if (deals.length === 0) {
    return (
      <div className="text-center py-12">
        <History size={24} className="mx-auto text-muted-foreground mb-3" />
        <p className="font-display font-bold uppercase text-muted-foreground mb-1">
          No completed deals yet
        </p>
        <p className="text-sm text-muted-foreground mb-3">
          Close your first trade and it lands here.
        </p>
        <Link href="/app/browse" className="text-accent text-sm font-semibold">
          Browse the marketplace →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {deals.map((deal) => {
        const other = deal.proposerId === userId ? deal.owner : deal.proposer;
        return (
          <Link
            key={deal.id}
            href={`/app/trades/${deal.id}`}
            className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 card-lift"
          >
            <div className="w-10 h-10 rounded-full overflow-hidden border border-border flex-shrink-0">
              <img
                src={other.avatar}
                alt={other.displayName}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{deal.listing.title}</p>
              <p className="text-xs text-muted-foreground">
                {DEAL_KIND_LABELS[deal.kind]} with @{other.username} ·{" "}
                {formatDate(deal.completedAt ?? deal.updatedAt)}
              </p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
          </Link>
        );
      })}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

type Tab = "listings" | "wanted" | "history";

function ProfileContent() {
  const store = useStore();
  const me = store.requireUser();
  const stats = store.userStats(me.id);
  const [tab, setTab] = useState<Tab>("listings");

  const myListings = store.listListings({
    sellerId: me.id,
    statuses: ["active", "pending", "traded", "sold", "claimed"],
  });

  const shareProfile = async () => {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/app/u/${me.username}`,
      );
      toast.success("Profile link copied. Spread the word.");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  return (
    <>
      {/* Hero */}
      <div className="px-4 pt-5 pb-4 border-b border-border">
        <div className="flex items-start gap-4">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-accent ring-offset-2 ring-offset-background">
              <img
                src={me.avatar}
                alt={me.displayName}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="font-display font-bold text-xl uppercase tracking-tight truncate">
                {me.displayName}
              </h2>
              {me.isVerified && (
                <BadgeCheck size={18} className="text-accent flex-shrink-0" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">@{me.username}</p>
            <div className="flex flex-col gap-0.5 mt-2 text-xs text-muted-foreground">
              {me.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={11} /> {me.location}
                </span>
              )}
              <span className="flex items-center gap-1">
                <CalendarDays size={11} /> Member since{" "}
                {formatMonthYear(me.memberSince)}
              </span>
            </div>
          </div>
        </div>

        {me.bio && (
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            {me.bio}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <Link
            href="/app/profile/edit"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md bg-accent text-accent-foreground text-sm font-semibold"
          >
            <Pencil size={14} /> Edit Profile
          </Link>
          <Link
            href="/app/settings"
            aria-label="Settings"
            className="w-10 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings size={17} />
          </Link>
        </div>

        {/* Trust card */}
        <div className="mt-4 bg-card border border-border border-l-2 border-l-accent rounded-lg p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Trust Score
              </p>
              <TrustScore score={me.trustScore} trades={me.tradesCompleted} size="lg" />
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-display font-bold text-3xl text-accent leading-none">
                {me.tradesCompleted}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                Trades done
              </p>
            </div>
          </div>
          {me.badges.length > 0 && (
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {me.badges.map((b) => (
                <TrustBadge key={b.id} badge={b} size="sm" />
              ))}
            </div>
          )}
          <Link
            href="/app/ratings"
            className="inline-flex items-center gap-1 text-xs text-accent font-semibold mt-3"
          >
            See all ratings <ArrowRight size={12} />
          </Link>
        </div>

        {/* Stats row */}
        <div className="mt-3 grid grid-cols-3 divide-x divide-border bg-surface border border-border rounded-lg">
          {[
            { label: "Active Listings", value: stats.activeListings },
            { label: "Trades Done", value: stats.completedDeals },
            { label: "Saves Received", value: stats.savesReceived },
          ].map(({ label, value }) => (
            <div key={label} className="py-3 px-1 text-center">
              <p className="font-display font-bold text-xl">{value}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-tight">
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* Favorite teams */}
        {me.favoriteTeams.length > 0 && (
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {me.favoriteTeams.map((team) => (
              <span
                key={team}
                className="text-xs bg-surface border border-border px-2 py-0.5 rounded-sm text-foreground"
              >
                {team}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(
          [
            { key: "listings", label: "Listings", icon: Package },
            { key: "wanted", label: "Wanted", icon: Search },
            { key: "history", label: "History", icon: History },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-semibold uppercase tracking-wide border-b-2 transition-colors",
              tab === key
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground",
            )}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-4 py-4">
        {tab === "listings" &&
          (myListings.length === 0 ? (
            <div className="text-center py-12">
              <Package size={24} className="mx-auto text-muted-foreground mb-3" />
              <p className="font-display font-bold uppercase text-muted-foreground mb-1">
                Nothing listed yet
              </p>
              <p className="text-sm text-muted-foreground mb-3">
                That closet full of jerseys isn't trading itself.
              </p>
              <Link href="/app/create" className="text-accent text-sm font-semibold">
                Post your first item →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {myListings.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          ))}
        {tab === "wanted" && <WantedTab userId={me.id} />}
        {tab === "history" && <HistoryTab userId={me.id} />}
      </div>

      {/* Footer actions */}
      <div className="px-4 pb-6 flex flex-col gap-2">
        <button
          type="button"
          onClick={shareProfile}
          className="flex items-center justify-center gap-2 py-2.5 rounded-md border border-border text-sm font-semibold text-foreground hover:border-accent transition-colors"
        >
          <Link2 size={15} /> Share profile
        </button>
        <Link
          href="/app/saved"
          className="flex items-center justify-center gap-2 py-2.5 rounded-md border border-border text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <Bookmark size={15} /> Saved items <ArrowRight size={13} />
        </Link>
      </div>
    </>
  );
}

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="font-display font-bold text-xl uppercase tracking-tight">
          My Profile
        </h1>
        <Link href="/app/settings" aria-label="Settings">
          <Settings
            size={20}
            className="text-muted-foreground hover:text-foreground transition-colors"
          />
        </Link>
      </header>
      <Hydrated fallback={<ProfileSkeleton />}>
        <ProfileContent />
      </Hydrated>
    </div>
  );
}
