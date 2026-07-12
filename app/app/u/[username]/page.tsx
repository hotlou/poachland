"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  CalendarDays,
  Flag,
  MapPin,
  MessageCircle,
  Package,
  Search,
  Star,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store-context";
import { Hydrated } from "@/components/hydrated";
import { IdentityChips } from "@/components/identity-chips";
import { ListingCard } from "@/components/listing-card";
import { TrustBadge, TrustScore } from "@/components/trust-badge";
import { formatMonthYear, timeAgo } from "@/lib/format";
import { REPORT_REASONS } from "@/lib/constants";
import type { User } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function PageSkeleton() {
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

/* ── Report dialog ───────────────────────────────────────────────────────── */

function ReportUserDialog({ user }: { user: User }) {
  const store = useStore();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");

  const submit = () => {
    if (!reason) {
      toast.error("Pick a reason");
      return;
    }
    const res = store.reportTarget("user", user.id, reason, details);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Report filed. Moderators will take a look.");
    setOpen(false);
    setReason(null);
    setDetails("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Report user"
          className="w-10 h-10 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          <Flag size={16} />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display font-bold uppercase tracking-tight">
            Report @{user.username}
          </DialogTitle>
          <DialogDescription>
            What's the problem? Reports go straight to the moderators.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          {REPORT_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={cn(
                "text-left text-sm px-3 py-2 rounded-md border transition-colors",
                reason === r
                  ? "border-accent text-accent bg-accent/10"
                  : "border-border text-foreground hover:border-muted-foreground",
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value.slice(0, 500))}
          placeholder="Anything else the mods should know? (optional)"
          className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm min-h-16 resize-y placeholder:text-muted-foreground focus:outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!reason}
          className="w-full py-2.5 rounded-md bg-accent text-accent-foreground text-sm font-semibold disabled:opacity-50"
        >
          File report
        </button>
      </DialogContent>
    </Dialog>
  );
}

/* ── Blocked view ────────────────────────────────────────────────────────── */

function BlockedView({ user, iBlockedThem }: { user: User; iBlockedThem: boolean }) {
  const store = useStore();
  return (
    <div className="px-4 py-16 text-center">
      <div className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-4 grayscale opacity-40 border border-border">
        <img src={user.avatar} alt={user.displayName} className="w-full h-full object-cover" />
      </div>
      <h2 className="font-display font-bold text-xl uppercase tracking-tight mb-1">
        @{user.username}
      </h2>
      {iBlockedThem ? (
        <>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
            You blocked this trader. Their listings, wanted posts, and messages
            are hidden from you — and yours from them.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="mt-5 px-5 py-2 rounded-md border border-border text-sm font-semibold text-foreground hover:border-accent transition-colors"
              >
                Unblock @{user.username}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-sm">
              <AlertDialogHeader>
                <AlertDialogTitle>Unblock @{user.username}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Their listings and messages become visible again, and they can
                  open deals with you.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    const res = store.unblockUser(user.id);
                    if (!res.ok) {
                      toast.error(res.error);
                      return;
                    }
                    toast.success(`Unblocked @${user.username}`);
                  }}
                >
                  Unblock
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : (
        <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
          You can't interact with this trader.
        </p>
      )}
    </div>
  );
}

/* ── Full profile ────────────────────────────────────────────────────────── */

function PublicProfile({ user }: { user: User }) {
  const store = useStore();
  const router = useRouter();
  const me = store.requireUser();
  const isSelf = user.id === me.id;
  const stats = store.userStats(user.id);
  const listings = store.listListings({ sellerId: user.id });
  const isoPosts = store.listISOPosts({ userId: user.id });
  const ratings = store.ratingsFor(user.id).slice(0, 3);

  const message = () => {
    const res = store.getOrCreateThread(user.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.push(`/app/inbox/${res.value.id}`);
  };

  return (
    <>
      {isSelf && (
        <div className="mx-4 mt-4 bg-accent/10 border border-accent/40 rounded-lg px-3 py-2.5 flex items-center justify-between gap-2">
          <p className="text-xs text-foreground">
            This is your public profile — how other traders see you.
          </p>
          <Link
            href="/app/profile"
            className="text-xs text-accent font-semibold flex-shrink-0"
          >
            My profile →
          </Link>
        </div>
      )}

      {/* Hero */}
      <div className="px-4 pt-5 pb-4 border-b border-border">
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-accent ring-offset-2 ring-offset-background flex-shrink-0">
            <img
              src={user.avatar}
              alt={user.displayName}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="font-display font-bold text-xl uppercase tracking-tight truncate">
                {user.displayName}
              </h2>
              {user.isVerified && (
                <BadgeCheck size={18} className="text-accent flex-shrink-0" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">@{user.username}</p>
            <div className="flex flex-col gap-0.5 mt-2 text-xs text-muted-foreground">
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

        {user.bio && (
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            {user.bio}
          </p>
        )}

        {/* Actions */}
        {!isSelf && (
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={message}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md bg-accent text-accent-foreground text-sm font-semibold"
            >
              <MessageCircle size={15} /> Message
            </button>
            <ReportUserDialog user={user} />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  aria-label="Block user"
                  className="w-10 h-10 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-red-400 hover:border-red-400 transition-colors"
                >
                  <Ban size={16} />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Block @{user.username}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Their listings, wanted posts, and messages disappear for
                    you — and yours for them. Open negotiations stay put; close
                    those separately.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      const res = store.blockUser(user.id);
                      if (!res.ok) {
                        toast.error(res.error);
                        return;
                      }
                      toast.success(`Blocked @${user.username}`);
                    }}
                  >
                    Block
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* Trust card */}
        <div className="mt-4 bg-card border border-border border-l-2 border-l-accent rounded-lg p-4">
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
        <IdentityChips userId={user.id} ownProfile={isSelf} />

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
        {user.favoriteTeams.length > 0 && (
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {user.favoriteTeams.map((team) => (
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

      {/* Active listings */}
      <section className="px-4 pt-5">
        <div className="flex items-center gap-1.5 mb-3">
          <Package size={15} className="text-accent" />
          <h3 className="font-display font-bold text-base uppercase tracking-tight">
            On the block
          </h3>
          <span className="badge-stamp text-muted-foreground border-border ml-1">
            {listings.length}
          </span>
        </div>
        {listings.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nothing listed right now. Check back later.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>

      {/* Active ISO posts */}
      {isoPosts.length > 0 && (
        <section className="px-4 pt-6">
          <div className="flex items-center gap-1.5 mb-3">
            <Search size={15} className="text-accent" />
            <h3 className="font-display font-bold text-base uppercase tracking-tight">
              Hunting for
            </h3>
          </div>
          <div className="flex flex-col gap-2">
            {isoPosts.map((post) => (
              <div key={post.id} className="bg-card border border-border rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="badge-stamp text-accent border-accent">
                    ISO {post.itemType}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(post.createdAt)}
                  </span>
                </div>
                <p className="text-sm leading-relaxed">{post.description}</p>
                {(post.team || post.size || post.maxPrice !== undefined) && (
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    {post.team && <span>{post.team}</span>}
                    {post.size && <span>Size {post.size}</span>}
                    {post.maxPrice !== undefined && <span>Up to ${post.maxPrice}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent ratings */}
      <section className="px-4 pt-6 pb-8">
        <div className="flex items-center gap-1.5 mb-3">
          <Star size={15} className="text-accent" />
          <h3 className="font-display font-bold text-base uppercase tracking-tight">
            Recent ratings
          </h3>
        </div>
        {ratings.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No ratings yet. Every legend starts at zero.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {ratings.map((r) => {
              const overall = (r.communication + r.shippingSpeed + r.itemAccuracy) / 3;
              return (
                <div key={r.id} className="bg-card border border-border rounded-lg p-3">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <Link
                      href={`/app/u/${r.fromUser.username}`}
                      className="w-8 h-8 rounded-full overflow-hidden border border-border flex-shrink-0"
                    >
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
                              ? "fill-yellow-400 text-yellow-400"
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
    </>
  );
}

/* ── Page shell ──────────────────────────────────────────────────────────── */

function PublicProfileContent() {
  const store = useStore();
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username ?? "");
  const user = store.getUserByUsername(username);
  const me = store.requireUser();

  if (!user) {
    return (
      <div className="px-4 py-20 text-center">
        <UserX size={28} className="mx-auto text-muted-foreground mb-3" />
        <h2 className="font-display font-bold text-xl uppercase tracking-tight mb-1">
          No such trader
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Nobody goes by @{username} around here.
        </p>
        <Link href="/app/browse" className="text-accent text-sm font-semibold">
          Back to browsing →
        </Link>
      </div>
    );
  }

  if (user.id !== me.id && store.isBlockedPair(me.id, user.id)) {
    return <BlockedView user={user} iBlockedThem={store.hasBlocked(user.id)} />;
  }

  return <PublicProfile user={user} />;
}

export default function PublicProfilePage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display font-bold text-xl uppercase tracking-tight">
          Trader Profile
        </h1>
      </header>
      <Hydrated fallback={<PageSkeleton />}>
        <PublicProfileContent />
      </Hydrated>
    </div>
  );
}
