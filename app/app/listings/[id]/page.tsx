"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  DollarSign,
  Eye,
  Flag,
  Gift,
  Heart,
  MapPin,
  MessageSquare,
  Package,
  Pencil,
  Repeat2,
  SearchX,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Hydrated } from "@/components/hydrated";
import { ListingCard } from "@/components/listing-card";
import { PhotoGallery } from "@/components/photo-gallery";
import { SaveButton } from "@/components/save-button";
import { TrustBadge, TrustScore } from "@/components/trust-badge";
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
} from "@/components/ui/dialog";
import {
  CONDITION_COLORS,
  DEAL_KIND_LABELS,
  LISTING_STATUS_LABELS,
  LISTING_TYPE_COLORS,
  LISTING_TYPE_LABELS,
  REPORT_REASONS,
} from "@/lib/constants";
import { formatMonthYear, money, timeAgo } from "@/lib/format";
import { useStore } from "@/lib/store-context";
import type { Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Page shell ───────────────────────────────────────────────────────────────

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useStore();

  // Count the view once per session (engine ignores owner views + repeats).
  useEffect(() => {
    store.markListingViewed(id);
  }, [store, id]);

  return (
    <Hydrated fallback={<DetailSkeleton />}>
      <ListingDetail id={id} />
    </Hydrated>
  );
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[4/3] bg-surface" />
      <div className="px-4 pt-4 space-y-3">
        <div className="h-4 w-24 bg-surface rounded-sm" />
        <div className="h-7 w-3/4 bg-surface rounded-sm" />
        <div className="h-4 w-1/2 bg-surface rounded-sm" />
        <div className="h-24 w-full bg-surface rounded-lg" />
      </div>
    </div>
  );
}

// ─── Main detail ─────────────────────────────────────────────────────────────

function ListingDetail({ id }: { id: string }) {
  const store = useStore();
  const router = useRouter();
  const me = store.requireUser();
  const listing = store.getListing(id);

  const isOwner = !!listing && listing.sellerId === me.id;

  if (!listing || (listing.status === "removed" && !isOwner)) {
    return <NotFoundState />;
  }

  const seller = listing.seller;
  const isRemoved = listing.status === "removed";
  const shipping = SHIPPING_LABELS[listing.shippingPreference];

  const moreFromSeller = store
    .listListings({ sellerId: seller.id })
    .filter((l) => l.id !== listing.id)
    .slice(0, 8);
  const alsoLike = store
    .listListings({ itemType: listing.type, includeOwn: false })
    .filter((l) => l.id !== listing.id && l.sellerId !== seller.id)
    .slice(0, 8);

  return (
    <div className="min-h-screen bg-background pb-44">
      {/* Photo hero with floating controls */}
      <div className="relative">
        <PhotoGallery photos={listing.photos} alt={listing.title} />
        <div className="absolute top-3 left-3 z-10">
          <button
            type="button"
            aria-label="Go back"
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
        </div>
        {!isOwner && (
          <div className="absolute top-3 right-3 z-10">
            <div className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
              <SaveButton
                targetType="listing"
                targetId={listing.id}
                size={17}
                className="text-white hover:text-accent"
              />
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pt-4">
        {isRemoved && (
          <div className="mb-4 p-3 rounded-xl border border-red-600/40 bg-red-600/10 text-sm text-red-700 dark:border-red-400/40 dark:bg-red-400/10 dark:text-red-400">
            You removed this listing. Only you can see it now.
          </div>
        )}

        {/* Stamp row */}
        <div className="flex gap-1.5 flex-wrap mb-3">
          <span className={cn("badge-stamp", CONDITION_COLORS[listing.condition])}>
            {listing.condition}
          </span>
          <span className={cn("badge-stamp", LISTING_TYPE_COLORS[listing.listingType])}>
            {LISTING_TYPE_LABELS[listing.listingType]}
          </span>
          {listing.isRare && (
            <span className="badge-stamp text-accent border-accent">Rare</span>
          )}
          {listing.status !== "active" && (
            <span
              className={cn(
                "badge-stamp",
                listing.status === "pending"
                  ? "text-amber-700 border-amber-600 dark:text-yellow-400 dark:border-yellow-400"
                  : listing.status === "removed"
                    ? "text-red-700 border-red-600 dark:text-red-400 dark:border-red-400"
                    : "text-foreground border-foreground",
              )}
            >
              {LISTING_STATUS_LABELS[listing.status]}
            </span>
          )}
        </div>

        {/* Team / year */}
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">
          {listing.team}
          {listing.year ? ` · ${listing.year}` : ""}
        </p>

        {/* Title */}
        <h1 className="font-display font-bold text-2xl tracking-tight leading-tight text-balance mb-3">
          {listing.title}
        </h1>

        {/* Price / trade line */}
        <div className="mb-4">
          {listing.listingType === "free" ? (
            <p className="font-display font-bold text-2xl text-pop">
              Free to a good home
            </p>
          ) : listing.askingPrice ? (
            <div className="flex items-baseline gap-2">
              <span className="font-display font-bold text-3xl text-foreground">
                {money(listing.askingPrice)}
              </span>
              {listing.listingType === "trade+cash" && (
                <span className="text-sm text-accent font-semibold">or trade</span>
              )}
            </div>
          ) : (
            <p className="font-display font-bold text-xl text-accent">
              Open to trades
            </p>
          )}
          {listing.tradeFor && (
            <div className="mt-3 p-3 bg-accent-dim border border-accent/30 rounded-xl">
              <p className="text-[10px] font-display font-bold uppercase tracking-widest text-accent mb-0.5">
                Hunting for
              </p>
              <p className="text-sm text-foreground">{listing.tradeFor}</p>
            </div>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap mb-4 text-xs text-muted-foreground">
          {listing.size && (
            <span className="badge-stamp text-muted-foreground border-border">
              Size {listing.size}
            </span>
          )}
          <span className="badge-stamp text-muted-foreground border-border">
            {listing.level}
          </span>
          {listing.division && (
            <span className="badge-stamp text-muted-foreground border-border">
              {listing.division}
            </span>
          )}
          <span className="flex items-center gap-1 ml-1">
            <Eye size={12} /> {listing.views}
          </span>
          <span className="flex items-center gap-1">
            <Heart size={12} /> {listing.saves}
          </span>
          <span>· listed {timeAgo(listing.createdAt)}</span>
        </div>

        {/* Tags */}
        {listing.tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-4">
            {listing.tags.map((tag) => (
              <Link
                key={tag}
                href={`/app/browse?q=${encodeURIComponent(tag)}`}
                className="text-xs text-muted-foreground bg-card px-2.5 py-0.5 rounded-full border border-border hover:border-accent hover:text-accent transition-colors"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* Description */}
        {listing.description && (
          <div className="mb-4">
            <h3 className="font-display font-bold text-xs uppercase tracking-widest text-muted-foreground mb-2">
              The story
            </h3>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
              {listing.description}
            </p>
          </div>
        )}

        {/* Shipping */}
        <div className="mb-5 flex items-center gap-3 p-3 bg-card rounded-xl border border-border">
          {listing.shippingPreference === "local-only" ? (
            <MapPin size={16} className="text-muted-foreground flex-shrink-0" />
          ) : (
            <Package size={16} className="text-muted-foreground flex-shrink-0" />
          )}
          <div className="flex-1">
            <p className="text-xs font-semibold text-foreground">Shipping</p>
            <p className="text-xs text-muted-foreground">{shipping.detail}</p>
          </div>
          <span
            className={cn(
              "badge-stamp",
              listing.shippingPreference === "seller-pays"
                ? "text-accent border-accent"
                : "text-muted-foreground border-border",
            )}
          >
            {shipping.badge}
          </span>
        </div>

        {/* Seller card */}
        <div className="border-t border-border pt-4 mb-2">
          <h3 className="font-display font-bold text-xs uppercase tracking-widest text-muted-foreground mb-3">
            {isOwner ? "You, the seller" : "Seller"}
          </h3>
          <Link
            href={`/app/u/${seller.username}`}
            className="flex items-start gap-3 p-3 bg-card rounded-xl border border-border card-lift"
          >
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-border flex-shrink-0">
              {/* plain img: avatars may be data URLs */}
              <img
                src={seller.avatar}
                alt={seller.displayName}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-semibold text-sm">{seller.displayName}</p>
                {seller.isVerified && (
                  <BadgeCheck size={14} className="text-accent flex-shrink-0" />
                )}
                <p className="text-xs text-muted-foreground">@{seller.username}</p>
              </div>
              <div className="mt-1">
                <TrustScore
                  score={seller.trustScore}
                  trades={seller.tradesCompleted}
                  size="sm"
                />
              </div>
              {seller.badges.length > 0 && (
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {seller.badges.slice(0, 3).map((b) => (
                    <TrustBadge key={b.id} badge={b} />
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Member since {formatMonthYear(seller.memberSince)}
              </p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground mt-1 flex-shrink-0" />
          </Link>
        </div>

        {/* Report */}
        {!isOwner && <ReportButton listingId={listing.id} />}
      </div>

      {/* Related rails */}
      {moreFromSeller.length > 0 && (
        <ListingRail
          title={`More from @${seller.username}`}
          listings={moreFromSeller}
        />
      )}
      {alsoLike.length > 0 && (
        <ListingRail title="You might also like" listings={alsoLike} />
      )}

      {/* Sticky CTA bar */}
      <CtaBar listing={listing} isOwner={isOwner} />
    </div>
  );
}

const SHIPPING_LABELS: Record<
  Listing["shippingPreference"],
  { badge: string; detail: string }
> = {
  "seller-pays": {
    badge: "Free shipping",
    detail: "Seller covers shipping. Zero excuses.",
  },
  "buyer-pays": {
    badge: "Buyer pays",
    detail: "You cover the postage on your end.",
  },
  "local-only": {
    badge: "Local only",
    detail: "Meetup only — bring it to the fields.",
  },
};

function NotFoundState() {
  const router = useRouter();
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-8 text-center">
      <SearchX size={40} className="text-muted-foreground mb-4" strokeWidth={1.5} />
      <h1 className="font-display font-bold text-xl tracking-tight mb-1">
        Listing not found
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        It got poached, pulled, or never existed.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 rounded-full border border-border bg-card text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          Go back
        </button>
        <Link
          href="/app/browse"
          className="px-5 py-2.5 rounded-full bg-accent text-accent-foreground font-semibold text-sm"
        >
          Browse the rack
        </Link>
      </div>
    </div>
  );
}

function ListingRail({ title, listings }: { title: string; listings: Listing[] }) {
  return (
    <div className="mt-6">
      <h3 className="font-display font-bold text-xs uppercase tracking-widest text-muted-foreground px-4 mb-3">
        {title}
      </h3>
      <div className="flex gap-3 overflow-x-auto px-4 pb-2">
        {listings.map((l) => (
          <ListingCard key={l.id} listing={l} className="w-40 flex-shrink-0" />
        ))}
      </div>
    </div>
  );
}

// ─── Report ──────────────────────────────────────────────────────────────────

function ReportButton({ listingId }: { listingId: string }) {
  const store = useStore();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");

  const submit = () => {
    const res = store.reportTarget("listing", listingId, reason, details);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Report filed. Mods will take a look.");
    setOpen(false);
    setReason("");
    setDetails("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 mt-3 mb-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Flag size={12} /> Report this listing
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display font-bold tracking-tight">
              Report listing
            </DialogTitle>
            <DialogDescription>
              What&apos;s wrong here? Reports go straight to the mods.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={cn(
                  "flex items-center gap-3 p-2.5 rounded-lg border text-left text-sm transition-colors",
                  reason === r
                    ? "border-accent bg-accent-dim text-foreground"
                    : "border-border bg-surface text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
                    reason === r ? "bg-accent" : "bg-border",
                  )}
                />
                {r}
              </button>
            ))}
          </div>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Anything else the mods should know? (optional)"
            rows={3}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors resize-none"
          />
          <button
            type="button"
            disabled={!reason}
            onClick={submit}
            className="w-full bg-accent text-accent-foreground font-semibold text-sm py-3 rounded-full disabled:opacity-40"
          >
            File report
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Sticky CTA bar ──────────────────────────────────────────────────────────

function CtaBar({ listing, isOwner }: { listing: Listing; isOwner: boolean }) {
  const store = useStore();

  const activeDeal = isOwner ? null : store.activeDealForListing(listing.id);
  const openDeals = isOwner ? store.openDealsOnListing(listing.id) : [];

  return (
    <div className="fixed bottom-16 left-0 right-0 z-40">
      <div className="max-w-lg mx-auto bg-background/95 backdrop-blur border-t border-border">
        {isOwner && openDeals.length > 0 && listing.status !== "removed" && (
          <div className="border-b border-accent/30 bg-accent-dim px-4 py-2">
            <p className="text-[11px] font-display font-bold uppercase tracking-widest text-accent mb-1">
              {openDeals.length} open {openDeals.length === 1 ? "offer/claim" : "offers/claims"} on this
            </p>
            <div className="flex flex-col gap-0.5 max-h-24 overflow-y-auto">
              {openDeals.map((d) => (
                <Link
                  key={d.id}
                  href={`/app/trades/${d.id}`}
                  className="flex items-center justify-between text-xs text-foreground hover:text-accent transition-colors py-0.5"
                >
                  <span className="truncate">
                    {DEAL_KIND_LABELS[d.kind]} from @{d.proposer.username}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground flex-shrink-0 ml-2">
                    {d.status === "accepted" ? "agreed" : "open"}
                    <ArrowRight size={12} />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="px-4 py-3">
          {isOwner ? (
            <OwnerActions listing={listing} />
          ) : activeDeal ? (
            <Link
              href={`/app/trades/${activeDeal.id}`}
              className="flex items-center justify-between gap-2 bg-accent-dim border border-accent/40 rounded-xl px-4 py-3.5"
            >
              <span className="text-sm font-semibold text-accent">
                You have an active deal on this
              </span>
              <span className="flex items-center gap-1 text-xs text-accent font-display font-bold uppercase tracking-wide">
                Deal room <ArrowRight size={14} />
              </span>
            </Link>
          ) : listing.status === "active" ? (
            <BuyerActions listing={listing} />
          ) : (
            <GoneBar listing={listing} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Owner view: edit / remove. */
function OwnerActions({ listing }: { listing: Listing }) {
  const store = useStore();
  const router = useRouter();
  const isActive = listing.status === "active";

  if (listing.status === "removed") {
    return (
      <p className="text-center text-sm text-muted-foreground py-2">
        This listing is removed and hidden from the rack.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground flex-shrink-0">
        Your listing
      </span>
      <div className="flex-1 flex gap-2">
        <Link
          href={`/app/listings/${listing.id}/edit`}
          aria-disabled={!isActive}
          onClick={(e) => {
            if (!isActive) {
              e.preventDefault();
              toast.error("Only active listings can be edited");
            }
          }}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 bg-accent text-accent-foreground font-semibold text-sm py-3 rounded-full",
            !isActive && "opacity-40",
          )}
        >
          <Pencil size={14} /> Edit
        </Link>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-full border border-red-600/50 bg-card text-red-700 font-semibold text-sm hover:bg-red-600/10 transition-colors dark:border-red-400/50 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-400/10"
            >
              <Trash2 size={14} /> Remove
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-sm bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display font-bold tracking-tight">
                Pull this listing?
              </AlertDialogTitle>
              <AlertDialogDescription>
                &ldquo;{listing.title}&rdquo; comes off the rack and any open
                negotiations on it are closed. No undo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it up</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-500 text-white hover:bg-red-600"
                onClick={() => {
                  const res = store.removeListing(listing.id);
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success("Listing removed.");
                  router.push("/app/profile");
                }}
              >
                Remove it
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

/** Non-owner, active listing: type-dependent primary CTAs + message. */
function BuyerActions({ listing }: { listing: Listing }) {
  const canTrade =
    listing.listingType === "trade" || listing.listingType === "trade+cash";
  const canBuyNow =
    (listing.listingType === "sell" || listing.listingType === "trade+cash") &&
    !!listing.askingPrice;
  const canOffer = listing.listingType === "sell";
  const canClaim = listing.listingType === "free";

  return (
    <div className="flex gap-2">
      {canTrade && (
        <Link
          href={`/app/trades/new?listing=${listing.id}`}
          className="flex-1 flex items-center justify-center gap-2 bg-accent text-accent-foreground font-semibold text-sm py-3.5 rounded-full"
        >
          <Repeat2 size={16} /> Propose Trade
        </Link>
      )}
      {canBuyNow && (
        <BuyNowButton listing={listing} primary={listing.listingType === "sell"} />
      )}
      {canOffer && <MakeOfferButton listing={listing} />}
      {canClaim && <ClaimButton listing={listing} />}
      <MessageButton sellerId={listing.sellerId} listingId={listing.id} />
    </div>
  );
}

function GoneBar({ listing }: { listing: Listing }) {
  return (
    <div className="flex gap-2 items-center">
      <div className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full border border-border bg-card text-muted-foreground font-semibold text-sm cursor-not-allowed select-none">
        {listing.status === "pending"
          ? "Locked in a deal"
          : "This one's been poached."}
      </div>
      <MessageButton sellerId={listing.sellerId} listingId={listing.id} />
    </div>
  );
}

function MessageButton({
  sellerId,
  listingId,
}: {
  sellerId: string;
  listingId: string;
}) {
  const store = useStore();
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Message seller"
      onClick={() => {
        const res = store.getOrCreateThread(sellerId, { listingId });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        router.push(`/app/inbox/${res.value.id}`);
      }}
      className="px-3.5 flex items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-accent hover:border-accent transition-colors"
    >
      <MessageSquare size={18} />
    </button>
  );
}

function BuyNowButton({ listing, primary }: { listing: Listing; primary: boolean }) {
  const store = useStore();
  const router = useRouter();
  const price = listing.askingPrice ?? 0;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex-1 flex items-center justify-center gap-2 font-semibold text-sm py-3.5 rounded-full transition-colors",
            primary
              ? "bg-accent text-accent-foreground"
              : "border border-accent bg-card text-accent hover:bg-accent-dim dark:bg-transparent",
          )}
        >
          <DollarSign size={16} /> Buy for {money(price)}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-sm bg-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display font-bold tracking-tight">
            Buy at asking price?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This sends {money(price)} — the full ask — as an offer on
            &ldquo;{listing.title}&rdquo;. Once the seller accepts, you two
            arrange payment and shipping directly. No fees, ever.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Not yet</AlertDialogCancel>
          <AlertDialogAction
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={() => {
              const res = store.makeBuyOffer({
                listingId: listing.id,
                amount: price,
              });
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success("Offer sent at full ask. Bold.");
              router.push(`/app/trades/${res.value.id}`);
            }}
          >
            Send {money(price)} offer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function MakeOfferButton({ listing }: { listing: Listing }) {
  const store = useStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const submit = () => {
    const parsed = Number(amount);
    if (!amount.trim() || Number.isNaN(parsed) || parsed <= 0) {
      toast.error("Enter an offer amount");
      return;
    }
    const res = store.makeBuyOffer({
      listingId: listing.id,
      amount: parsed,
      note: note.trim() || undefined,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Offer sent. Now we wait.");
    setOpen(false);
    router.push(`/app/trades/${res.value.id}`);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex-1 flex items-center justify-center gap-2 border border-border bg-card text-foreground font-semibold text-sm py-3.5 rounded-full hover:border-accent hover:text-accent transition-colors"
      >
        Make Offer
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display font-bold tracking-tight">
              Name your price
            </DialogTitle>
            <DialogDescription>
              {listing.askingPrice
                ? `Asking ${money(listing.askingPrice)}. Lowball at your own reputational risk.`
                : "Make the seller an offer they can haggle with."}
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 block">
              Your offer
            </label>
            <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-3 focus-within:border-accent transition-colors">
              <span className="text-muted-foreground">$</span>
              <input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="flex-1 bg-transparent text-sm text-foreground outline-none"
                autoFocus
              />
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 block">
              Note (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Make your case, or just say hi."
              rows={3}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors resize-none"
            />
          </div>
          <button
            type="button"
            onClick={submit}
            className="w-full bg-accent text-accent-foreground font-semibold text-sm py-3 rounded-full"
          >
            Send offer
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ClaimButton({ listing }: { listing: Listing }) {
  const store = useStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  const submit = () => {
    const res = store.claimListing({
      listingId: listing.id,
      note: note.trim() || undefined,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Claim sent. Fingers crossed.");
    setOpen(false);
    router.push(`/app/trades/${res.value.id}`);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex-1 flex items-center justify-center gap-2 bg-pop text-pop-foreground font-semibold text-sm py-3.5 rounded-full"
      >
        <Gift size={16} /> Claim It
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display font-bold tracking-tight">
              Claim &ldquo;{listing.title}&rdquo;
            </DialogTitle>
            <DialogDescription>
              It&apos;s free, but the seller picks who gets it. Make your pitch.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why should it go to you?"
            rows={4}
            autoFocus
            className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors resize-none"
          />
          <button
            type="button"
            onClick={submit}
            className="w-full bg-pop text-pop-foreground font-semibold text-sm py-3 rounded-full"
          >
            Send claim
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
