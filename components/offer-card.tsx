"use client";

import Link from "next/link";
import { ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo, timeUntil } from "@/lib/format";
import { useStore } from "@/lib/store-context";
import type { Deal, Offer } from "@/lib/types";

const OFFER_STATUS_STYLES: Record<Offer["status"], string> = {
  pending: "text-yellow-400 border-yellow-400",
  accepted: "text-accent border-accent",
  declined: "text-red-400 border-red-400",
  superseded: "text-muted-foreground border-border",
  withdrawn: "text-muted-foreground border-border",
  expired: "text-muted-foreground border-border",
};

const OFFER_STATUS_LABELS: Record<Offer["status"], string> = {
  pending: "On the table",
  accepted: "Accepted",
  declined: "Declined",
  superseded: "Countered",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

function SideItems({ listingIds, cash }: { listingIds: string[]; cash: number }) {
  const store = useStore();
  const listings = listingIds
    .map((id) => store.getListing(id))
    .filter((l): l is NonNullable<typeof l> => !!l);
  if (listings.length === 0 && cash <= 0) {
    return <p className="text-xs text-muted-foreground italic">Nothing</p>;
  }
  return (
    <div className="space-y-1.5">
      {listings.map((l) => (
        <Link
          key={l.id}
          href={`/app/listings/${l.id}`}
          className="flex items-center gap-2 group"
        >
          <div className="relative w-9 h-9 rounded overflow-hidden bg-surface border border-border flex-shrink-0">
            <img src={l.photos[0] || "/placeholder.jpg"} alt={l.title} className="absolute inset-0 w-full h-full object-cover" />
          </div>
          <span className="text-xs text-foreground leading-tight line-clamp-2 group-hover:text-accent transition-colors">
            {l.title}
          </span>
        </Link>
      ))}
      {cash > 0 && (
        <p className="text-sm font-bold text-accent font-display">+ ${cash} cash</p>
      )}
    </div>
  );
}

/**
 * Renders one version of a deal's terms from the viewer's perspective
 * ("You give / You get"). Used in the deal room timeline and inbox threads.
 */
export function OfferCard({
  deal,
  offer,
  viewerId,
  compact,
  className,
}: {
  deal: Deal;
  offer: Offer;
  viewerId: string;
  compact?: boolean;
  className?: string;
}) {
  const store = useStore();
  const viewerIsProposer = deal.proposerId === viewerId;
  const author = store.getUser(offer.byUserId);
  const youGive = viewerIsProposer
    ? { listingIds: offer.proposerListingIds, cash: offer.cashFromProposer }
    : { listingIds: offer.ownerListingIds, cash: offer.cashFromOwner };
  const youGet = viewerIsProposer
    ? { listingIds: offer.ownerListingIds, cash: offer.cashFromOwner }
    : { listingIds: offer.proposerListingIds, cash: offer.cashFromProposer };

  return (
    <div
      className={cn(
        "rounded-lg border bg-surface p-3",
        offer.status === "pending" ? "border-accent/50" : "border-border",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-muted-foreground">
          {author ? `@${author.username}` : "Offer"} · {timeAgo(offer.createdAt)}
        </span>
        <span className={cn("badge-stamp", OFFER_STATUS_STYLES[offer.status])}>
          {OFFER_STATUS_LABELS[offer.status]}
        </span>
      </div>
      {deal.kind === "claim" ? (
        <p className="text-sm text-foreground">
          {viewerIsProposer ? "You asked to claim this item." : `@${author?.username} wants to claim your item.`}
        </p>
      ) : (
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-display font-bold mb-1.5">
              You give
            </p>
            <SideItems listingIds={youGive.listingIds} cash={youGive.cash} />
          </div>
          <div className="flex items-center justify-center pt-6">
            <ArrowRightLeft size={16} className="text-accent" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-display font-bold mb-1.5">
              You get
            </p>
            <SideItems listingIds={youGet.listingIds} cash={youGet.cash} />
          </div>
        </div>
      )}
      {!compact && offer.note && (
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed border-t border-border pt-2">
          &ldquo;{offer.note}&rdquo;
        </p>
      )}
      {offer.status === "pending" && (
        <p className="mt-2 text-[11px] text-yellow-400/80">{timeUntil(offer.expiresAt)}</p>
      )}
    </div>
  );
}
