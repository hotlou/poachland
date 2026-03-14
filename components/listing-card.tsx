import Link from "next/link";
import Image from "next/image";
import { Heart, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Listing } from "@/lib/seed-data";
import {
  CONDITION_COLORS,
  LISTING_TYPE_LABELS,
  LISTING_TYPE_COLORS,
} from "@/lib/seed-data";

interface ListingCardProps {
  listing: Listing;
  className?: string;
}

export function ListingCard({ listing, className }: ListingCardProps) {
  return (
    <Link
      href={`/app/listings/${listing.id}`}
      className={cn(
        "group block bg-card rounded-lg overflow-hidden border border-border card-lift",
        className,
      )}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-surface">
        <Image
          src={listing.photos[0]}
          alt={listing.title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 768px) 50vw, 33vw"
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
        {/* Stats overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 flex items-center justify-between">
          <span className="text-xs text-white/70 flex items-center gap-1">
            <Eye size={11} /> {listing.views}
          </span>
          <span className="text-xs text-white/70 flex items-center gap-1">
            <Heart size={11} /> {listing.saves}
          </span>
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
              <Image
                src={listing.seller.avatar}
                alt={listing.seller.displayName}
                width={20}
                height={20}
                className="object-cover"
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
