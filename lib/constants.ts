import type {
  Condition,
  DealKind,
  DealStatus,
  ListingStatus,
  ListingType,
} from "./types";

export const CONDITION_COLORS: Record<Condition, string> = {
  Mint: "text-emerald-400 border-emerald-400",
  "Near Mint": "text-cyan-400 border-cyan-400",
  Good: "text-yellow-400 border-yellow-400",
  Fair: "text-orange-400 border-orange-400",
  Worn: "text-red-400 border-red-400",
};

export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  trade: "Trade",
  sell: "For Sale",
  "trade+cash": "Trade + Cash",
  free: "Free",
};

export const LISTING_TYPE_COLORS: Record<ListingType, string> = {
  trade: "text-accent border-accent",
  sell: "text-sky-400 border-sky-400",
  "trade+cash": "text-purple-400 border-purple-400",
  free: "text-pink-400 border-pink-400",
};

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  active: "Active",
  pending: "Deal Pending",
  traded: "Traded",
  sold: "Sold",
  claimed: "Claimed",
  removed: "Removed",
};

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  open: "Awaiting Response",
  accepted: "Deal Agreed",
  completed: "Completed",
  declined: "Declined",
  withdrawn: "Withdrawn",
  cancelled: "Cancelled",
  expired: "Expired",
  disputed: "Disputed",
};

export const DEAL_STATUS_COLORS: Record<DealStatus, string> = {
  open: "text-yellow-400 border-yellow-400",
  accepted: "text-accent border-accent",
  completed: "text-emerald-400 border-emerald-400",
  declined: "text-red-400 border-red-400",
  withdrawn: "text-muted-foreground border-border",
  cancelled: "text-orange-400 border-orange-400",
  expired: "text-muted-foreground border-border",
  disputed: "text-red-400 border-red-400",
};

export const DEAL_KIND_LABELS: Record<DealKind, string> = {
  trade: "Trade",
  buy: "Purchase",
  claim: "Claim",
};

/** Days until an unanswered offer expires. */
export const OFFER_EXPIRY_DAYS = 7;

/** Stock item photos available in the create/edit photo picker. */
export const STOCK_PHOTOS = {
  jersey: [
    "/images/jersey-1.jpg",
    "/images/jersey-2.jpg",
    "/images/jersey-3.jpg",
    "/images/jersey-4.jpg",
    "/images/jersey-5.jpg",
  ],
  disc: ["/images/disc-1.jpg", "/images/disc-2.jpg", "/images/disc-3.jpg"],
} as const;

export const STOCK_AVATARS = [
  "/images/avatar-1.jpg",
  "/images/avatar-2.jpg",
  "/images/avatar-3.jpg",
  "/placeholder-user.jpg",
] as const;

export const REPORT_REASONS = [
  "Counterfeit or fake item",
  "Misleading listing",
  "Scam or fraud attempt",
  "Harassment or abuse",
  "Item never shipped",
  "Spam",
  "Other",
] as const;
