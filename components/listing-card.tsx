"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Listing } from "@/lib/types";
import {
  CONDITION_COLORS,
  LISTING_STATUS_LABELS,
  LISTING_TYPE_COLORS,
  LISTING_TYPE_LABELS,
} from "@/lib/constants";
import { SaveButton } from "@/components/save-button";

interface ListingCardProps {
  listing: Listing;
  className?: string;
}

export function ListingCard({ listing, className }: ListingCardProps) {
  const closed = ["traded", "sold", "claimed", "removed"].includes(listing.status);
  return (
    <Link
      href={`/app/listings/${listing.id}`}
      className={cn(
        "group block bg-card rounded-lg overflow-hidden border border-border card-lift relative",
        listing.isRare && "border-t-accent/60",
        className,
      )}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-surface">
        {/* plain img: listing photos may be data URLs from uploads */}
        <img
          src={listing.photos[0] || "/placeholder.jpg"}
          alt={listing.title}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105",
            closed && "opacity-50 grayscale-[0.5]",
          )}
        />
        {/* Overlay badges */}
        <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
          {listing.isRare && (
            <span className="badge-stamp text-accent border-accent bg-background/80 backdrop-blur-sm">
              Rare
            </span>
          )}
          <span
            className={cn(
              "badge-stamp bg-background/80 backdrop-blur-sm",
              CONDITION_COLORS[listing.condition],
            )}
          >
            {listing.condition}
          </span>
        </div>
        {/* Listing type */}
        <div className="absolute top-2 right-2">
          <span
            className={cn(
              "badge-stamp bg-background/80 backdrop-blur-sm",
              LISTING_TYPE_COLORS[listing.listingType],
            )}
          >
            {LISTING_TYPE_LABELS[listing.listingType]}
          </span>
        </div>
        {/* Closed / pending state stamp */}
        {listing.status !== "active" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className={cn(
                "badge-stamp text-sm px-3 py-1 rotate-[-8deg] bg-background/85 backdrop-blur-sm",
                listing.status === "pending"
                  ? "text-yellow-400 border-yellow-400"
                  : "text-foreground border-foreground",
              )}
            >
              {LISTING_STATUS_LABELS[listing.status]}
            </span>
          </div>
        )}
        {/* Stats overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 flex items-center justify-between">
          <span className="text-xs text-white/70 flex items-center gap-1">
            <Eye size={11} /> {listing.views}
          </span>
          <SaveButton
            targetType="listing"
            targetId={listing.id}
            showCount={listing.saves}
            size={13}
            className="text-white/70 hover:text-white"
          />
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-0.5">
          {listing.team}
          {listing.year ? ` · ${listing.year}` : ""}
          {listing.size ? ` · ${listing.size}` : ""}
        </p>
        <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-tight">
          {listing.title}
        </h3>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full overflow-hidden border border-border flex-shrink-0">
              <img
                src={listing.seller.avatar}
                alt={listing.seller.displayName}
                width={20}
                height={20}
                className="object-cover w-full h-full"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {listing.seller.username}
            </span>
          </div>
          {listing.askingPrice && (
            <span className="text-sm font-bold text-foreground">
              ${listing.askingPrice}
            </span>
          )}
          {listing.listingType === "trade" && (
            <span className="text-xs text-accent font-semibold">Trade</span>
          )}
          {listing.listingType === "free" && (
            <span className="text-xs text-pink-400 font-semibold">Free</span>
          )}
        </div>
      </div>
    </Link>
  );
}
