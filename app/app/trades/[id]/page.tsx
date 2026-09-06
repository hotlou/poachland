"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  Ban,
  Handshake,
  MessageCircle,
  PartyPopper,
  Send,
  ShieldAlert,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { fetchDeal } from "@/app/actions/query";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store-context";
import type { Deal } from "@/lib/types";
import { DEAL_KIND_LABELS } from "@/lib/constants";
import { formatDate, timeAgo, timeUntil } from "@/lib/format";
import { Hydrated } from "@/components/hydrated";
import { OfferCard } from "@/components/offer-card";
import { DealStatusBadge } from "@/components/deal-status-badge";
import { ExchangedRating, PartyChip, StatusBanner } from "./deal-room-summary";
import { CounterComposer } from "./deal-counter-composer";
import { RateBlock, ShareToHaul } from "./deal-completion-actions";
import { SettleUpBlock } from "./deal-settlement-panel";
import { FulfillmentPanel, ProofSection } from "./deal-fulfillment-panel";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// ─── Conversation preview ─────────────────────────────────────────────────────

function ConversationPreview({ deal, meId }: { deal: Deal; meId: string }) {
  const store = useStore();
  const [draft, setDraft] = useState("");
  const messages = store
    .threadMessages(deal.threadId)
    .filter((m) => m.kind !== "offer")
    .slice(-3);

  const send = () => {
    const res = store.sendMessage(deal.threadId, draft);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setDraft("");
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
          <MessageCircle size={15} className="text-accent" /> Conversation
        </h2>
        <Link href={`/app/inbox/${deal.threadId}`} className="text-xs text-accent font-semibold">
          Open full conversation →
        </Link>
      </div>
      <div className="space-y-2 mb-3">
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-2">
            No messages yet. Talk it out — deals close faster with words.
          </p>
        ) : (
          messages.map((m) => {
            if (m.kind === "system") {
              return (
                <p key={m.id} className="text-[11px] text-muted-foreground italic text-center px-4 leading-relaxed">
                  {m.content}
                </p>
              );
            }
            const mine = m.senderId === meId;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-xl px-3 py-2",
                    mine ? "bg-accent/10 border border-accent/30" : "bg-card border border-border",
                  )}
                >
                  <p className="text-sm text-foreground leading-relaxed break-words">{m.content}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(m.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-center gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message…"
          className="flex-1 bg-surface border border-border rounded-full px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label="Send message"
          className="w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center flex-shrink-0 disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </form>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function DealRoom({ id }: { id: string }) {
  const store = useStore();
  const router = useRouter();
  const [composerOpen, setComposerOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  const cachedDeal = store.getDeal(id);
  const [fetchedDeal, setFetchedDeal] = useState<Deal | null | undefined>(cachedDeal ?? undefined);
  const deal = cachedDeal ?? fetchedDeal;
  const me = store.requireUser();

  useEffect(() => {
    if (cachedDeal) return;
    void fetchDeal(id).then((result) => {
      if (result) store.primeDeal(result);
      setFetchedDeal(result);
    }).catch(() => setFetchedDeal(null));
  }, [cachedDeal, id, store]);

  if (deal === undefined) return <DealRoomSkeleton />;

  if (!deal) {
    return (
      <div className="px-6 py-20 text-center">
        <p className="font-display font-bold tracking-tight text-xl text-foreground mb-2">
          No deal here
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          This deal doesn&apos;t exist — or it never got off the ground.
        </p>
        <Link
          href="/app/trades"
          className="inline-block bg-accent text-accent-foreground font-display font-semibold px-5 py-2.5 rounded-full text-sm shadow-sm"
        >
          Back to your trades
        </Link>
      </div>
    );
  }

  if (deal.proposerId !== me.id && deal.ownerId !== me.id) {
    return (
      <div className="px-6 py-20 text-center">
        <p className="font-display font-bold tracking-tight text-xl text-foreground mb-2">
          Not your deal
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          Deal rooms are private to the two people shaking hands.
        </p>
        <Link
          href="/app/trades"
          className="inline-block bg-accent text-accent-foreground font-display font-semibold px-5 py-2.5 rounded-full text-sm shadow-sm"
        >
          Back to your trades
        </Link>
      </div>
    );
  }

  const iAmProposer = deal.proposerId === me.id;
  const other = iAmProposer ? deal.owner : deal.proposer;
  const current = deal.currentOffer;
  const movesCash = current.cashFromProposer > 0 || current.cashFromOwner > 0;
  const myTurn = deal.status === "open" && current.byUserId !== me.id;
  const canRate = store.canRateDeal(deal.id);
  const myRating = store.ratingsBy(me.id).find((r) => r.dealId === deal.id);
  const theirRating = store.ratingsFor(me.id).find((r) => r.dealId === deal.id);

  const accept = () => {
    const res = store.acceptOffer(deal.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Deal agreed 🤝");
  };

  const decline = () => {
    const res = store.declineOffer(deal.id, declineReason);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Offer declined");
    setDeclineOpen(false);
  };

  const withdraw = () => {
    const res = store.withdrawOffer(deal.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Offer withdrawn");
  };

  return (
    <div className="pb-8">
      {/* Header */}
      <header className="sticky top-0 md:top-14 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 md:px-6 py-3 flex items-center gap-3">
        <button type="button" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display font-bold text-lg tracking-tight flex-1">
          {DEAL_KIND_LABELS[deal.kind]}
        </h1>
        <DealStatusBadge status={deal.status} />
      </header>

      <div className="px-4 py-4 space-y-5 lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-8 lg:space-y-0 lg:px-6">
        {/* Item + parties — right column on lg, top of page on mobile */}
        <div className="space-y-5 lg:col-start-2 lg:row-start-1">
          {/* Primary listing */}
          <Link
            href={`/app/listings/${deal.listing.id}`}
            className="flex items-center gap-3 bg-card border border-border rounded-xl p-3 card-lift"
          >
            <div className="w-14 h-14 rounded-lg overflow-hidden bg-surface flex-shrink-0">
              <img
                src={deal.listing.photos[0] || "/placeholder.jpg"}
                alt={deal.listing.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-display font-bold">
                The item on the table
              </p>
              <p className="text-sm font-semibold text-foreground line-clamp-1 mt-0.5">{deal.listing.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {deal.listing.condition} · {deal.listing.team}
              </p>
            </div>
          </Link>

          {/* Parties */}
          <div className="flex items-start justify-center gap-4 bg-card border border-border rounded-xl p-4">
            <PartyChip user={deal.proposer} isMe={deal.proposerId === me.id} />
            <div className="pt-3">
              <ArrowRightLeft size={20} className="text-accent" />
            </div>
            <PartyChip user={deal.owner} isMe={deal.ownerId === me.id} />
          </div>
        </div>

        {/* Negotiation + actions — left column on lg */}
        <div className="space-y-5 lg:col-start-1 lg:row-start-1 lg:row-span-2">
          {/* Negotiation timeline */}
          <section>
            <h2 className="font-display font-bold text-sm text-foreground mb-3">
              Negotiation
              {deal.offers.length > 1 && (
                <span className="text-muted-foreground font-normal text-xs ml-2">
                  {deal.offers.length} rounds
                </span>
              )}
            </h2>
            <div className="space-y-2.5">
              {deal.offers.map((offer, i) => (
                <OfferCard
                  key={offer.id}
                  deal={deal}
                  offer={offer}
                  viewerId={me.id}
                  className={cn(i < deal.offers.length - 1 && "opacity-55")}
                />
              ))}
            </div>
          </section>

          {/* Closed-state banners */}
          {deal.status === "declined" && (
            <StatusBanner
              tone="red"
              icon={X}
              title="Offer declined"
              detail={deal.declineReason}
            />
          )}
          {deal.status === "withdrawn" && (
            <StatusBanner
              tone="muted"
              icon={Undo2}
              title={`${current.byUserId === me.id ? "You" : `@${other.username}`} withdrew the offer`}
              detail={deal.declineReason}
            />
          )}
          {deal.status === "cancelled" && (
            <StatusBanner
              tone="orange"
              icon={Ban}
              title="Deal cancelled after acceptance"
              detail={deal.declineReason}
            />
          )}
          {deal.status === "expired" && (
            <StatusBanner
              tone="muted"
              icon={AlertTriangle}
              title="Offer expired"
              detail="No response within 7 days. Feel free to open a fresh deal."
            />
          )}
          {deal.status === "disputed" && (
            <StatusBanner
              tone="red"
              icon={ShieldAlert}
              title="Under review by moderators"
              detail={deal.disputeReason}
            />
          )}

          {/* ── ACTION ZONE ── */}

          {deal.status === "open" && myTurn && (
            <div className="space-y-2.5">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    className="w-full bg-accent text-accent-foreground font-display font-semibold text-sm px-5 py-2.5 rounded-full shadow-sm flex items-center justify-center gap-2"
                  >
                    <Handshake size={16} /> Accept offer
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Lock it in?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Items in this deal get reserved and other negotiations on them close. You&apos;ll
                      both ship, confirm, and rate each other.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Hold on</AlertDialogCancel>
                    <AlertDialogAction onClick={accept}>Lock it in</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <div className="grid grid-cols-2 gap-2.5">
                {deal.kind !== "claim" && (
                  <button
                    type="button"
                    onClick={() => setComposerOpen((v) => !v)}
                    className={cn(
                      "border font-display font-semibold text-sm px-5 py-2.5 rounded-full flex items-center justify-center gap-1.5 transition-colors",
                      composerOpen
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-card text-foreground",
                    )}
                  >
                    <ArrowRightLeft size={14} /> Counter
                  </button>
                )}
                <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "border border-border bg-card text-muted-foreground font-display font-semibold text-sm px-5 py-2.5 rounded-full flex items-center justify-center gap-1.5",
                        deal.kind === "claim" && "col-span-2",
                      )}
                    >
                      <X size={14} /> Decline
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Pass on this offer?</DialogTitle>
                      <DialogDescription>
                        This closes the deal. A short reason keeps it friendly — optional.
                      </DialogDescription>
                    </DialogHeader>
                    <textarea
                      value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)}
                      placeholder="e.g. Holding out for a disc, not cash"
                      rows={2}
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors resize-none"
                    />
                    <button
                      type="button"
                      onClick={decline}
                      className="w-full bg-red-600/10 border border-red-600 text-red-600 dark:bg-red-400/15 dark:border-red-400 dark:text-red-400 font-display font-semibold text-sm px-5 py-2.5 rounded-full"
                    >
                      Decline offer
                    </button>
                  </DialogContent>
                </Dialog>
              </div>

              {composerOpen && deal.kind !== "claim" && (
                <CounterComposer deal={deal} onDone={() => setComposerOpen(false)} />
              )}
            </div>
          )}

          {deal.status === "open" && !myTurn && (
            <div className="rounded-xl border border-border bg-card p-4 text-center space-y-3">
              <p className="text-sm text-foreground">
                Waiting on <Link href={`/app/u/${other.username}`} className="text-accent font-semibold">@{other.username}</Link>
              </p>
              <p className="text-xs text-amber-700/90 dark:text-yellow-400/80">
                {timeUntil(current.expiresAt) === "expired"
                  ? "Offer expired — refresh to close it out"
                  : `Expires: ${timeUntil(current.expiresAt)}`}
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors inline-flex items-center gap-1"
                  >
                    <Undo2 size={12} /> Withdraw offer
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Withdraw your offer?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This closes the deal. You can always open a new one later.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep it live</AlertDialogCancel>
                    <AlertDialogAction onClick={withdraw}>Withdraw</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {deal.status === "accepted" && (
            <>
              <FulfillmentPanel deal={deal} me={me} other={other} />
              {movesCash && <SettleUpBlock other={other} />}
            </>
          )}

          {/* Disputed deals keep proof open — evidence for the moderators. */}
          {deal.status === "disputed" && (
            <div className="rounded-xl border border-border bg-card p-4">
              <ProofSection deal={deal} me={me} other={other} />
            </div>
          )}

          {deal.status === "completed" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-600/40 bg-emerald-600/10 dark:border-emerald-400/50 dark:bg-emerald-400/10 p-4 flex items-center gap-3">
                <PartyPopper size={22} className="text-emerald-700 dark:text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="font-display font-bold text-sm text-emerald-700 dark:text-emerald-400">
                    Deal complete
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Completed {deal.completedAt ? formatDate(deal.completedAt) : ""} · both sides confirmed
                  </p>
                </div>
              </div>

              <ShareToHaul deal={deal} />

              {canRate && <RateBlock deal={deal} other={other} />}

              {myRating && <ExchangedRating rating={myRating} heading={`Your rating of @${other.username}`} />}
              {theirRating && (
                <ExchangedRating rating={theirRating} heading={`@${other.username}'s rating of you`} />
              )}
              {!canRate && !myRating && !theirRating && (
                <p className="text-xs text-muted-foreground text-center">
                  Ratings for this deal are closed.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Conversation */}
        <div className="lg:col-start-2 lg:row-start-2">
          {deal.status !== "declined" &&
          deal.status !== "withdrawn" &&
          deal.status !== "expired" ? (
            <ConversationPreview deal={deal} meId={me.id} />
          ) : (
            <div className="text-center">
              <Link href={`/app/inbox/${deal.threadId}`} className="text-xs text-accent font-semibold">
                View the conversation →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DealRoomSkeleton() {
  return (
    <div>
      <header className="sticky top-0 md:top-14 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 md:px-6 py-3 flex items-center gap-3">
        <ArrowLeft size={20} className="text-muted-foreground" />
        <div className="h-5 w-24 bg-surface rounded animate-pulse" />
      </header>
      <div className="px-4 py-4 space-y-4 lg:px-6">
        <div className="h-20 bg-surface rounded-lg animate-pulse" />
        <div className="h-28 bg-surface rounded-lg animate-pulse" />
        <div className="h-40 bg-surface rounded-lg animate-pulse" />
        <div className="h-14 bg-surface rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

export default function DealRoomPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  return (
    <Hydrated fallback={<DealRoomSkeleton />}>
      <DealRoom id={id} />
    </Hydrated>
  );
}
