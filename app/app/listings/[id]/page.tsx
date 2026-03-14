"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Heart,
  Eye,
  Share2,
  Package,
  MapPin,
  Flag,
  ChevronLeft,
  ChevronRight,
  Repeat2,
  DollarSign,
} from "lucide-react";
import { DEMO_LISTINGS, CONDITION_COLORS, LISTING_TYPE_LABELS, LISTING_TYPE_COLORS } from "@/lib/seed-data";
import { TrustBadge, TrustScore } from "@/components/trust-badge";
import { cn } from "@/lib/utils";

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const listing = DEMO_LISTINGS.find((l) => l.id === id) ?? DEMO_LISTINGS[0];
  const [photoIdx, setPhotoIdx] = useState(0);
  const [saved, setSaved] = useState(false);

  const photos = listing.photos;

  return (
    <div className="min-h-screen bg-background">
      {/* Photo hero */}
      <div className="relative aspect-[4/3] bg-surface">
        <Image
          src={photos[photoIdx]}
          alt={listing.title}
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />

        {/* Nav overlay */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex gap-2">
            <button className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white">
              <Share2 size={16} />
            </button>
            <button
              onClick={() => setSaved((v) => !v)}
              className={cn(
                "w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center transition-colors",
                saved ? "text-red-400" : "text-white",
              )}
            >
              <Heart size={16} className={saved ? "fill-red-400" : ""} />
            </button>
          </div>
        </div>

        {/* Photo nav dots */}
        {photos.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setPhotoIdx(i)}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-colors",
                  i === photoIdx ? "bg-white" : "bg-white/40",
                )}
              />
            ))}
          </div>
        )}

        {/* Photo arrows */}
        {photos.length > 1 && (
          <>
            <button
              onClick={() => setPhotoIdx((i) => Math.max(0, i - 1))}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white disabled:opacity-30"
              disabled={photoIdx === 0}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPhotoIdx((i) => Math.min(photos.length - 1, i + 1))}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white disabled:opacity-30"
              disabled={photoIdx === photos.length - 1}
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}

        {/* Badges overlay */}
        <div className="absolute bottom-8 left-3 flex gap-1.5">
          {listing.isRare && (
            <span className="badge-stamp text-accent border-accent bg-black/70 backdrop-blur-sm">
              Rare
            </span>
          )}
          <span className={cn("badge-stamp bg-black/70 backdrop-blur-sm", CONDITION_COLORS[listing.condition])}>
            {listing.condition}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-4 pb-28">
        {/* Title + type */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h1 className="font-display font-800 text-2xl uppercase tracking-tight leading-tight text-balance flex-1">
            {listing.title}
          </h1>
          <span className={cn("badge-stamp flex-shrink-0 mt-1", LISTING_TYPE_COLORS[listing.listingType])}>
            {LISTING_TYPE_LABELS[listing.listingType]}
          </span>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 mb-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye size={12} /> {listing.views} views
          </span>
          <span className="flex items-center gap-1">
            <Heart size={12} /> {listing.saves} saves
          </span>
          {listing.level && (
            <span className="badge-stamp text-muted-foreground border-border text-[9px]">
              {listing.level}
            </span>
          )}
          {listing.division && (
            <span className="badge-stamp text-muted-foreground border-border text-[9px]">
              {listing.division}
            </span>
          )}
        </div>

        {/* Price / trade info */}
        {listing.askingPrice && (
          <div className="mb-4 flex items-center gap-2">
            <span className="font-display font-800 text-3xl text-foreground">
              ${listing.askingPrice}
            </span>
            {listing.listingType === "trade+cash" && (
              <span className="text-sm text-muted-foreground">+ trade</span>
            )}
          </div>
        )}
        {listing.tradeFor && (
          <div className="mb-4 p-3 bg-accent-dim border border-accent/30 rounded-lg">
            <p className="text-xs font-semibold text-accent mb-0.5">Looking for</p>
            <p className="text-sm text-foreground">{listing.tradeFor}</p>
          </div>
        )}

        {/* Tags */}
        <div className="flex gap-1.5 flex-wrap mb-4">
          {listing.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs text-muted-foreground bg-surface px-2 py-0.5 rounded-sm border border-border"
            >
              #{tag}
            </span>
          ))}
        </div>

        {/* Description */}
        <div className="mb-5">
          <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground mb-2">
            Description
          </h3>
          <p className="text-sm text-foreground leading-relaxed">{listing.description}</p>
        </div>

        {/* Shipping */}
        <div className="mb-5 flex items-center gap-2 p-3 bg-surface rounded-lg border border-border">
          <Package size={16} className="text-muted-foreground flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-foreground">Shipping</p>
            <p className="text-xs text-muted-foreground">
              {listing.shippingPreference === "seller-pays"
                ? "Seller pays shipping"
                : listing.shippingPreference === "buyer-pays"
                ? "Buyer pays shipping"
                : "Local meetup only"}
            </p>
          </div>
        </div>

        {/* Seller */}
        <div className="border-t border-border pt-4">
          <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground mb-3">
            Seller
          </h3>
          <Link href={`/app/profile/${listing.sellerId}`} className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-border flex-shrink-0">
              <Image
                src={listing.seller.avatar}
                alt={listing.seller.displayName}
                width={48}
                height={48}
                className="object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-semibold text-sm">{listing.seller.displayName}</p>
                <p className="text-xs text-muted-foreground">@{listing.seller.username}</p>
              </div>
              <TrustScore
                score={listing.seller.trustScore}
                trades={listing.seller.tradesCompleted}
                size="sm"
              />
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {listing.seller.badges.slice(0, 2).map((b) => (
                  <TrustBadge key={b.id} badge={b} />
                ))}
              </div>
            </div>
          </Link>
        </div>

        {/* Report */}
        <button className="flex items-center gap-1.5 mt-4 text-xs text-muted-foreground">
          <Flag size={12} /> Report this listing
        </button>
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-surface/95 backdrop-blur-sm border-t border-border px-4 py-3">
        <div className="flex gap-3">
          {listing.listingType !== "sell" && listing.listingType !== "free" && (
            <Link
              href={`/app/trades/new?listing=${listing.id}`}
              className="flex-1 flex items-center justify-center gap-2 bg-accent text-accent-foreground font-display font-700 uppercase tracking-wide text-sm py-3.5 rounded-sm"
            >
              <Repeat2 size={16} /> Propose Trade
            </Link>
          )}
          {(listing.listingType === "sell" || listing.listingType === "trade+cash") && (
            <Link
              href={`/app/trades/new?listing=${listing.id}&type=offer`}
              className="flex-1 flex items-center justify-center gap-2 bg-sky-500 text-white font-display font-700 uppercase tracking-wide text-sm py-3.5 rounded-sm"
            >
              <DollarSign size={16} /> Make Offer
            </Link>
          )}
          {listing.listingType === "free" && (
            <Link
              href={`/app/trades/new?listing=${listing.id}&type=claim`}
              className="flex-1 flex items-center justify-center gap-2 bg-pink-500 text-white font-display font-700 uppercase tracking-wide text-sm py-3.5 rounded-sm"
            >
              Claim It
            </Link>
          )}
          <button
            onClick={() => setSaved((v) => !v)}
            className={cn(
              "w-14 flex items-center justify-center rounded-sm border transition-colors",
              saved
                ? "bg-red-500/10 border-red-500 text-red-400"
                : "bg-surface border-border text-muted-foreground",
            )}
          >
            <Heart size={18} className={saved ? "fill-red-400" : ""} />
          </button>
        </div>
      </div>
    </div>
  );
}
