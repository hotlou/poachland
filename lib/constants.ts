import type {
  Condition,
  DealKind,
  DealStatus,
  ListingStatus,
  ListingType,
} from "./types";

export const CONDITION_COLORS: Record<Condition, string> = {
  Mint: "text-emerald-700 border-emerald-600 bg-emerald-600/10 dark:text-emerald-400 dark:border-emerald-400 dark:bg-transparent",
  "Near Mint": "text-sky-700 border-sky-600 bg-sky-600/10 dark:text-cyan-400 dark:border-cyan-400 dark:bg-transparent",
  Good: "text-amber-700 border-amber-600 bg-amber-500/10 dark:text-yellow-400 dark:border-yellow-400 dark:bg-transparent",
  Fair: "text-orange-700 border-orange-600 bg-orange-500/10 dark:text-orange-400 dark:border-orange-400 dark:bg-transparent",
  Worn: "text-red-700 border-red-600 bg-red-500/10 dark:text-red-400 dark:border-red-400 dark:bg-transparent",
};

export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  trade: "Trade",
  sell: "For Sale",
  "trade+cash": "Trade + Cash",
  free: "Free",
};

export const LISTING_TYPE_COLORS: Record<ListingType, string> = {
  trade: "text-accent border-accent bg-accent/10 dark:bg-transparent",
  sell: "text-sky-700 border-sky-600 bg-sky-600/10 dark:text-sky-400 dark:border-sky-400 dark:bg-transparent",
  "trade+cash": "text-purple-700 border-purple-600 bg-purple-600/10 dark:text-purple-400 dark:border-purple-400 dark:bg-transparent",
  free: "text-pop border-pop bg-pop/10 dark:bg-transparent",
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
  open: "text-amber-700 border-amber-600 bg-amber-500/10 dark:text-yellow-400 dark:border-yellow-400 dark:bg-transparent",
  accepted: "text-accent border-accent bg-accent/10 dark:bg-transparent",
  completed: "text-emerald-700 border-emerald-600 bg-emerald-600/10 dark:text-emerald-400 dark:border-emerald-400 dark:bg-transparent",
  declined: "text-red-700 border-red-600 bg-red-500/10 dark:text-red-400 dark:border-red-400 dark:bg-transparent",
  withdrawn: "text-muted-foreground border-border bg-muted/50 dark:bg-transparent",
  cancelled: "text-orange-700 border-orange-600 bg-orange-500/10 dark:text-orange-400 dark:border-orange-400 dark:bg-transparent",
  expired: "text-muted-foreground border-border bg-muted/50 dark:bg-transparent",
  disputed: "text-red-700 border-red-600 bg-red-500/10 dark:text-red-400 dark:border-red-400 dark:bg-transparent",
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
