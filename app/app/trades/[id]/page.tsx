"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  Ban,
  Check,
  CheckCircle2,
  Handshake,
  MessageCircle,
  Package,
  PartyPopper,
  Send,
  ShieldAlert,
  Star,
  Truck,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store-context";
import type { OfferTermsInput } from "@/lib/engine";
import type { Deal, HydratedRating, Listing, User } from "@/lib/types";
import { DEAL_KIND_LABELS } from "@/lib/constants";
import { formatDate, timeAgo, timeUntil } from "@/lib/format";
import { Hydrated } from "@/components/hydrated";
import { OfferCard } from "@/components/offer-card";
import { DealStatusBadge } from "@/components/deal-status-badge";
import { TrustScore } from "@/components/trust-badge";
import { StarRatingInput } from "@/components/star-rating-input";
import { Switch } from "@/components/ui/switch";
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

// ─── Small pieces ─────────────────────────────────────────────────────────────

function PartyChip({ user, isMe }: { user: User; isMe: boolean }) {
  return (
    <Link href={`/app/u/${user.username}`} className="flex flex-col items-center gap-1.5 min-w-0">
      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-border">
        <img src={user.avatar} alt={user.displayName} className="w-full h-full object-cover" />
      </div>
      <span className="text-xs font-semibold text-foreground truncate max-w-[7rem]">
        @{user.username}
        {isMe && <span className="text-muted-foreground font-normal"> (you)</span>}
      </span>
      <TrustScore score={user.trustScore} trades={user.tradesCompleted} size="sm" />
    </Link>
  );
}

function StatusBanner({
  tone,
  icon: Icon,
  title,
  detail,
}: {
  tone: "red" | "orange" | "muted";
  icon: React.ElementType;
  title: string;
  detail?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3 flex items-start gap-3",
        tone === "red" && "border-red-600/40 bg-red-600/10 dark:border-red-400/50 dark:bg-red-400/10",
        tone === "orange" && "border-orange-600/40 bg-orange-600/10 dark:border-orange-400/50 dark:bg-orange-400/10",
        tone === "muted" && "border-border bg-card",
      )}
    >
      <Icon
        size={18}
        className={cn(
          "flex-shrink-0 mt-0.5",
          tone === "red" && "text-red-600 dark:text-red-400",
          tone === "orange" && "text-orange-700 dark:text-orange-400",
          tone === "muted" && "text-muted-foreground",
        )}
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {detail && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">&ldquo;{detail}&rdquo;</p>}
      </div>
    </div>
  );
}

function MiniStars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={12}
          strokeWidth={1.5}
          className={cn(
            s <= Math.round(value)
              ? "fill-amber-500 text-amber-500 dark:fill-yellow-400 dark:text-yellow-400"
              : "fill-transparent text-muted-foreground",
          )}
        />
      ))}
      <span className="text-xs font-semibold text-foreground ml-1">{value.toFixed(1)}</span>
    </span>
  );
}

function ExchangedRating({ rating, heading }: { rating: HydratedRating; heading: string }) {
  const overall = (rating.communication + rating.shippingSpeed + rating.itemAccuracy) / 3;
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-display font-bold">
          {heading}
        </p>
        <MiniStars value={overall} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Communication {rating.communication} · Shipping {rating.shippingSpeed} · Accuracy {rating.itemAccuracy}
        {rating.wouldTradeAgain ? " · Would trade again" : ""}
      </p>
      {rating.comment && (
        <p className="text-xs text-foreground leading-relaxed mt-1.5">&ldquo;{rating.comment}&rdquo;</p>
      )}
    </div>
  );
}

// ─── Counter composer ─────────────────────────────────────────────────────────

function SideChecklist({
  label,
  candidates,
  selected,
  onToggle,
  cash,
  onCash,
}: {
  label: string;
  candidates: Listing[];
  selected: string[];
  onToggle: (id: string) => void;
  cash: string;
  onCash: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-display font-bold mb-2">
        {label}
      </p>
      {candidates.length === 0 ? (
        <p className="text-xs text-muted-foreground italic mb-2">No listings to offer</p>
      ) : (
        <div className="space-y-1.5 mb-2">
          {candidates.map((l) => {
            const on = selected.includes(l.id);
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => onToggle(l.id)}
                className={cn(
                  "w-full flex items-center gap-2 p-1.5 rounded-md border text-left transition-colors",
                  on ? "border-accent bg-accent/10" : "border-border bg-card",
                )}
              >
                <div className="w-8 h-8 rounded overflow-hidden bg-surface flex-shrink-0">
                  <img src={l.photos[0] || "/placeholder.jpg"} alt={l.title} className="w-full h-full object-cover" />
                </div>
                <span className="flex-1 text-[11px] leading-tight line-clamp-2 text-foreground">{l.title}</span>
                <span
                  className={cn(
                    "w-4 h-4 rounded-sm border flex items-center justify-center flex-shrink-0",
                    on ? "border-accent bg-accent text-accent-foreground" : "border-border",
                  )}
                >
                  {on && <Check size={11} strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-1.5 bg-surface border border-border rounded-lg px-2 py-2">
        <span className="text-muted-foreground text-xs">$</span>
        <input
          type="number"
          min={0}
          value={cash}
          onChange={(e) => onCash(e.target.value)}
          placeholder="0"
          className="w-full bg-transparent text-xs text-foreground outline-none"
          aria-label={`${label} cash`}
        />
      </div>
    </div>
  );
}

function CounterComposer({ deal, onDone }: { deal: Deal; onDone: () => void }) {
  const store = useStore();
  const current = deal.currentOffer;
  const [proposerSel, setProposerSel] = useState<string[]>(current.proposerListingIds);
  const [ownerSel, setOwnerSel] = useState<string[]>(current.ownerListingIds);
  const [cashP, setCashP] = useState(current.cashFromProposer > 0 ? String(current.cashFromProposer) : "");
  const [cashO, setCashO] = useState(current.cashFromOwner > 0 ? String(current.cashFromOwner) : "");
  const [note, setNote] = useState("");

  const candidatesFor = (sellerId: string, includeIds: string[]): Listing[] => {
    const active = store.listListings({ sellerId, statuses: ["active"] });
    const byId = new Map(active.map((l) => [l.id, l]));
    for (const id of includeIds) {
      if (!byId.has(id)) {
        const l = store.getListing(id);
        if (l) byId.set(id, l);
      }
    }
    return [...byId.values()];
  };

  const toggle = (list: string[], set: (v: string[]) => void) => (id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const submit = () => {
    const terms: OfferTermsInput = {
      proposerListingIds: proposerSel,
      ownerListingIds: ownerSel,
      cashFromProposer: Number(cashP) || 0,
      cashFromOwner: Number(cashO) || 0,
      note,
    };
    const res = store.counterOffer(deal.id, terms);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Counter-offer sent");
    onDone();
  };

  return (
    <div className="rounded-xl border border-accent/40 bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-bold text-sm text-foreground">
          Your counter
        </h3>
        <button type="button" onClick={onDone} aria-label="Close composer" className="text-muted-foreground">
          <X size={16} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:gap-6 mb-3">
        <SideChecklist
          label={`@${deal.proposer.username} gives`}
          candidates={candidatesFor(deal.proposerId, current.proposerListingIds)}
          selected={proposerSel}
          onToggle={toggle(proposerSel, setProposerSel)}
          cash={cashP}
          onCash={setCashP}
        />
        <SideChecklist
          label={`@${deal.owner.username} gives`}
          candidates={candidatesFor(deal.ownerId, current.ownerListingIds)}
          selected={ownerSel}
          onToggle={toggle(ownerSel, setOwnerSel)}
          cash={cashO}
          onCash={setCashO}
        />
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note — why this counter works for both of you"
        rows={2}
        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors resize-none mb-3"
      />
      <button
        type="button"
        onClick={submit}
        className="w-full bg-accent text-accent-foreground font-display font-semibold text-sm px-5 py-2.5 rounded-full shadow-sm flex items-center justify-center gap-2"
      >
        <ArrowRightLeft size={15} /> Send counter
      </button>
      <p className="text-[11px] text-muted-foreground text-center mt-2">
        Replaces the current offer. Expires in 7 days if no response.
      </p>
    </div>
  );
}

// ─── Rating block ─────────────────────────────────────────────────────────────

function RateBlock({ deal, other }: { deal: Deal; other: User }) {
  const store = useStore();
  const [communication, setCommunication] = useState(5);
  const [shippingSpeed, setShippingSpeed] = useState(5);
  const [itemAccuracy, setItemAccuracy] = useState(5);
  const [wouldTradeAgain, setWouldTradeAgain] = useState(true);
  const [comment, setComment] = useState("");

  const submit = () => {
    const res = store.rateDeal(deal.id, {
      communication,
      shippingSpeed,
      itemAccuracy,
      wouldTradeAgain,
      comment,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Rep updated.");
  };

  return (
    <div className="rounded-xl border border-accent/40 bg-card p-4">
      <h3 className="font-display font-bold text-sm text-foreground mb-1">
        Rate @{other.username}
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Ratings build the trust that keeps Poachland fee-free.
      </p>
      <div className="space-y-3 mb-4">
        <StarRatingInput label="Communication" value={communication} onChange={setCommunication} size={20} />
        <StarRatingInput label="Shipping speed" value={shippingSpeed} onChange={setShippingSpeed} size={20} />
        <StarRatingInput label="Item accuracy" value={itemAccuracy} onChange={setItemAccuracy} size={20} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-foreground">Would trade again?</span>
          <Switch checked={wouldTradeAgain} onCheckedChange={setWouldTradeAgain} />
        </div>
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional — a line about how it went"
        rows={2}
        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors resize-none mb-3"
      />
      <button
        type="button"
        onClick={submit}
        className="w-full bg-accent text-accent-foreground font-display font-semibold text-sm px-5 py-2.5 rounded-full shadow-sm flex items-center justify-center gap-2"
      >
        <Star size={15} /> Submit rating
      </button>
    </div>
  );
}

// ─── Fulfillment panel ────────────────────────────────────────────────────────

function FulfillmentPanel({ deal, me, other }: { deal: Deal; me: User; other: User }) {
  const store = useStore();
  const [tracking, setTracking] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeOpen, setDisputeOpen] = useState(false);

  const mine = deal.fulfillment[me.id];
  const theirs = deal.fulfillment[other.id];
  const handoffWording = deal.kind !== "trade";

  const ship = () => {
    const res = store.markShipped(deal.id, tracking);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Marked shipped 📦");
    setTracking("");
  };

  const confirm = () => {
    const res = store.confirmComplete(deal.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.value.completed) {
      toast.success("Deal complete 🎉");
    } else {
      toast.success(`Confirmed — waiting on @${other.username}`);
    }
  };

  const cancel = () => {
    const res = store.cancelDeal(deal.id, cancelReason);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Deal cancelled");
    setCancelOpen(false);
  };

  const dispute = () => {
    const res = store.openDispute(deal.id, disputeReason);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Dispute opened — moderators will review");
    setDisputeOpen(false);
  };

  const sideStatus = (user: User, f: typeof mine, isMe: boolean) => (
    <div className="flex items-start gap-3 py-2.5">
      <div className="w-9 h-9 rounded-full overflow-hidden border border-border flex-shrink-0">
        <img src={user.avatar} alt={user.displayName} className="w-full h-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          @{user.username}
          {isMe && <span className="text-muted-foreground font-normal"> (you)</span>}
        </p>
        <p className={cn("text-xs mt-0.5", f?.shippedAt ? "text-accent" : "text-muted-foreground")}>
          {f?.shippedAt ? (
            <>
              <Truck size={11} className="inline mr-1 -mt-0.5" />
              Shipped {timeAgo(f.shippedAt)}
              {f.tracking && <span className="text-muted-foreground"> · #{f.tracking}</span>}
            </>
          ) : (
            "Not shipped yet"
          )}
        </p>
        <p className={cn("text-xs mt-0.5", f?.receivedAt ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
          {f?.receivedAt ? (
            <>
              <CheckCircle2 size={11} className="inline mr-1 -mt-0.5" />
              Confirmed complete {timeAgo(f.receivedAt)}
            </>
          ) : (
            "Not confirmed yet"
          )}
        </p>
      </div>
    </div>
  );

  return (
    <div className="rounded-xl border border-accent/40 bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Handshake size={16} className="text-accent" />
        <h3 className="font-display font-bold text-sm text-foreground">
          Deal agreed — time to deliver
        </h3>
      </div>
      <p className="text-xs text-muted-foreground mb-2">
        Items are reserved. Ship or hand off your end, then confirm when yours arrives.
      </p>
      <div className="divide-y divide-border mb-3">
        {sideStatus(me, mine, true)}
        {sideStatus(other, theirs, false)}
      </div>

      {!mine?.shippedAt && (
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="Tracking # (optional)"
              className="flex-1 bg-surface border border-border rounded-full px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors"
            />
            <button
              type="button"
              onClick={ship}
              className="flex-shrink-0 bg-card border border-accent text-accent font-display font-semibold text-sm px-4 py-2.5 rounded-full flex items-center gap-1.5"
            >
              <Package size={14} /> Mark shipped
            </button>
          </div>
        </div>
      )}

      {!mine?.receivedAt ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              className="w-full bg-accent text-accent-foreground font-display font-semibold text-sm px-5 py-2.5 rounded-full shadow-sm flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={16} /> Confirm complete
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm your end is done?</AlertDialogTitle>
              <AlertDialogDescription>
                {handoffWording
                  ? "Confirm you've received / handed off your end of this deal. Once both sides confirm, the deal completes and ratings unlock."
                  : "Confirm you've received their end of the trade. Once both sides confirm, the deal completes and ratings unlock."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Not yet</AlertDialogCancel>
              <AlertDialogAction onClick={confirm}>Confirm</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <div className="rounded-lg bg-surface border border-border px-3 py-2.5 text-sm text-muted-foreground text-center">
          You&apos;ve confirmed — waiting on @{other.username}.
        </div>
      )}

      <div className="flex items-center justify-center gap-4 mt-3">
        <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <DialogTrigger asChild>
            <button type="button" className="text-xs text-muted-foreground hover:text-orange-700 dark:hover:text-orange-400 transition-colors flex items-center gap-1">
              <Ban size={12} /> Cancel deal
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel this deal?</DialogTitle>
              <DialogDescription>
                Reserved items go back on the market. The other side gets notified — repeated backouts hurt your rep.
              </DialogDescription>
            </DialogHeader>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason (optional)"
              rows={2}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors resize-none"
            />
            <button
              type="button"
              onClick={cancel}
              className="w-full bg-orange-600/10 border border-orange-600 text-orange-700 dark:bg-orange-400/15 dark:border-orange-400 dark:text-orange-400 font-display font-semibold text-sm px-5 py-2.5 rounded-full"
            >
              Cancel the deal
            </button>
          </DialogContent>
        </Dialog>

        <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
          <DialogTrigger asChild>
            <button type="button" className="text-xs text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors flex items-center gap-1">
              <ShieldAlert size={12} /> Report a problem
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report a problem</DialogTitle>
              <DialogDescription>
                Item never showed, not as described, gone quiet? Open a dispute and moderators will step in.
              </DialogDescription>
            </DialogHeader>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Describe what went wrong"
              rows={3}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors resize-none"
            />
            <button
              type="button"
              onClick={dispute}
              className="w-full bg-red-600/10 border border-red-600 text-red-600 dark:bg-red-400/15 dark:border-red-400 dark:text-red-400 font-display font-semibold text-sm px-5 py-2.5 rounded-full"
            >
              Open dispute
            </button>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

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

  const deal = store.getDeal(id);
  const me = store.requireUser();

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

          {deal.status === "accepted" && <FulfillmentPanel deal={deal} me={me} other={other} />}

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
