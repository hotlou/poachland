/**
 * Poachland domain model.
 *
 * `*Record` types are what the store persists (normalized, id references only).
 * The non-Record counterparts (`Listing`, `ISOPost`, …) are hydrated views the
 * engine's selectors return, with related entities resolved for rendering.
 */

// ─── Shared enums ────────────────────────────────────────────────────────────

export type Condition = "Mint" | "Near Mint" | "Good" | "Fair" | "Worn";
export type ListingType = "trade" | "sell" | "trade+cash" | "free";
export type ItemType = "jersey" | "disc";
export type Level = "club" | "college" | "pro" | "national" | "tournament";
export type Division = "open" | "women" | "mixed" | "masters";
export type ShippingPreference = "seller-pays" | "buyer-pays" | "local-only";

/**
 * Moderation status. `shadowbanned` is invisible to the user themselves —
 * their content is hidden from others but they see a normal app. `suspended`
 * and `banned` gate the account to a notice screen and block all writes.
 */
export type UserStatus = "active" | "shadowbanned" | "suspended" | "banned";

export type ListingStatus =
  | "active" // visible, open to offers
  | "pending" // locked inside an accepted deal
  | "traded"
  | "sold"
  | "claimed"
  | "removed";

// ─── Users & reputation ──────────────────────────────────────────────────────

export type BadgeType =
  // trading milestones
  | "first-trade"
  | "regular"
  | "veteran"
  | "centurion"
  // trust & quality
  | "trusted"
  | "flawless"
  | "quick-shipper"
  // collecting
  | "collector"
  | "curator"
  // generosity
  | "generous"
  | "philanthropist"
  // community
  | "hunter"
  | "show-off"
  | "crowd-pleaser"
  | "heist-legend"
  | "connector"
  // identity & founder
  | "verified"
  | "founding";

export interface Badge {
  id: string;
  label: string;
  type: BadgeType;
}

/** One line of a trader's playing résumé — surfaces what gear they may have. */
export interface HistoryEntry {
  id: string;
  kind: "team" | "tournament" | "league";
  name: string;
  years?: string; // free-form, e.g. "2016-2019"
  note?: string;
}

export interface UserRecord {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  location: string;
  favoriteTeams: string[];
  /** Playing history (public). */
  history?: HistoryEntry[];
  /** Profile photo gallery (public, max 4). */
  gallery?: string[];
  memberSince: string;
  isVerified: boolean;
  badges: Badge[];
  /**
   * Seeded history from before the demo data window. Folded into the
   * computed reputation so seed users start with believable track records.
   */
  baselineTrades: number;
  baselineRatingCount: number;
  baselineRatingSum: number; // sum of overall (1-5) scores
  // Cached aggregates — recomputed by the engine, never edited directly.
  trustScore: number;
  ratingsCount: number;
  tradesCompleted: number;
}

export type User = UserRecord;

// ─── Listings ────────────────────────────────────────────────────────────────

export interface ListingRecord {
  id: string;
  sellerId: string;
  type: ItemType;
  title: string;
  team: string;
  year?: string;
  division?: Division;
  level: Level;
  size?: string;
  condition: Condition;
  listingType: ListingType;
  askingPrice?: number;
  tradeFor?: string;
  photos: string[];
  description: string;
  views: number;
  saves: number;
  createdAt: string;
  updatedAt: string;
  shippingPreference: ShippingPreference;
  tags: string[];
  isRare?: boolean;
  isFeatured?: boolean;
  status: ListingStatus;
}

export interface Listing extends ListingRecord {
  seller: User;
}

// ─── Wanted board (ISO posts) ────────────────────────────────────────────────

export type ISOStatus = "active" | "found" | "closed";

export interface ISOPostRecord {
  id: string;
  userId: string;
  itemType: ItemType;
  description: string;
  team?: string;
  size?: string;
  maxPrice?: number;
  createdAt: string;
  saves: number;
  status: ISOStatus;
}

export interface ISOPost extends ISOPostRecord {
  user: User;
}

// ─── Deals: trades, buys, claims — with negotiation ──────────────────────────

export type DealKind = "trade" | "buy" | "claim";

export type DealStatus =
  | "open" // negotiating; the latest offer awaits a response
  | "accepted" // agreed; parties are shipping / handing off
  | "completed" // both parties confirmed — ratings unlocked
  | "declined"
  | "withdrawn"
  | "cancelled" // backed out after acceptance
  | "expired"
  | "disputed";

export type OfferStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "superseded" // replaced by a counter-offer
  | "withdrawn"
  | "expired";

/**
 * One version of the terms. Sides are absolute (proposer vs owner of the
 * primary listing), not relative to the offer's author, so counters don't
 * flip the meaning of the fields.
 */
export interface Offer {
  id: string;
  byUserId: string;
  /** Listings the deal's proposer hands over. */
  proposerListingIds: string[];
  /** Listings the listing owner hands over (usually the primary listing). */
  ownerListingIds: string[];
  cashFromProposer: number;
  cashFromOwner: number;
  note: string;
  createdAt: string;
  expiresAt: string;
  status: OfferStatus;
}

export interface FulfillmentState {
  shippedAt?: string;
  tracking?: string;
  receivedAt?: string;
  /** Proof of shipment/handoff (packed item, receipt) — visible to both parties. */
  proofPhotos?: string[];
}

export interface DealRecord {
  id: string;
  kind: DealKind;
  /** The listing the deal was opened on (belongs to ownerId). */
  listingId: string;
  proposerId: string;
  ownerId: string;
  offers: Offer[]; // chronological; last entry is the current terms
  status: DealStatus;
  threadId: string;
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
  completedAt?: string;
  closedAt?: string;
  declineReason?: string;
  disputeReason?: string;
  /** Keyed by user id. Both parties confirm receipt to complete the deal. */
  fulfillment: Record<string, FulfillmentState>;
}

export interface Deal extends DealRecord {
  listing: Listing;
  proposer: User;
  owner: User;
  currentOffer: Offer;
}

// ─── Messaging ───────────────────────────────────────────────────────────────

export type MessageKind = "text" | "system" | "offer";

export interface MessageRecord {
  id: string;
  threadId: string;
  senderId: string;
  kind: MessageKind;
  content: string;
  offerId?: string;
  createdAt: string;
}

export type Message = MessageRecord;

export interface ThreadRecord {
  id: string;
  participantIds: [string, string];
  listingId?: string;
  isoPostId?: string;
  dealId?: string;
  createdAt: string;
  updatedAt: string;
  /** userId -> ISO timestamp of the last time they viewed the thread. */
  lastRead: Record<string, string>;
}

export interface Thread extends ThreadRecord {
  participants: User[];
  otherUser: User;
  lastMessage?: Message;
  unreadCount: number;
  listing?: Listing;
  deal?: Deal;
}

// ─── Ratings ─────────────────────────────────────────────────────────────────

export interface Rating {
  id: string;
  dealId: string;
  fromUserId: string;
  toUserId: string;
  communication: number; // 1-5
  shippingSpeed: number; // 1-5
  itemAccuracy: number; // 1-5
  wouldTradeAgain: boolean;
  comment?: string;
  createdAt: string;
}

export interface HydratedRating extends Rating {
  fromUser: User;
  toUser: User;
  deal?: Deal;
}

export interface RatingSummary {
  count: number;
  overall: number;
  communication: number;
  shippingSpeed: number;
  itemAccuracy: number;
  wouldTradeAgainPct: number; // 0-100
}

// ─── Notifications ───────────────────────────────────────────────────────────

export type NotificationType =
  | "trade_proposal"
  | "buy_offer"
  | "claim_request"
  | "offer_countered"
  | "offer_accepted"
  | "offer_rejected"
  | "offer_withdrawn"
  | "deal_cancelled"
  | "deal_disputed"
  | "shipped"
  | "deal_complete"
  | "iso_match"
  | "new_message"
  | "new_rating"
  | "badge_earned"
  | "listing_removed"
  | "system";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  linkTo?: string;
}

// ─── Saves, moderation, activity ─────────────────────────────────────────────

export type SaveTargetType = "listing" | "iso";

export interface Save {
  userId: string;
  targetType: SaveTargetType;
  targetId: string;
  createdAt: string;
}

export type ReportTargetType = "listing" | "user" | "deal";
export type ReportStatus = "pending" | "resolved" | "dismissed";

export interface Report {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details?: string;
  status: ReportStatus;
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface Block {
  blockerId: string;
  blockedId: string;
  createdAt: string;
}

export type ActivityType =
  | "new_listing"
  | "new_iso"
  | "deal_completed"
  | "new_rating"
  | "new_member";

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  actorId: string;
  targetId?: string;
  summary: string;
  createdAt: string;
  linkTo?: string;
}

// ─── Email notification preferences ──────────────────────────────────────────

export type EmailCategory = "deals" | "messages" | "community" | "account";
export type EmailPrefs = Record<EmailCategory, boolean>;

// ─── Payment handles (PRIVATE — revealed only inside accepted deals) ─────────

export type PaymentKind = "venmo" | "paypal" | "cashapp" | "zelle" | "crypto" | "other";

export interface PaymentMethod {
  id: string;
  userId: string;
  kind: PaymentKind;
  /** Optional display label, e.g. "BTC" or "personal". */
  label?: string;
  /** Handle / address, e.g. "@hotlou" or a wallet address. */
  value: string;
  createdAt: string;
}

// ─── Linked real-life identities (reputation scaffolding) ────────────────────

export type IdentityProvider = "instagram" | "facebook" | "usau" | "other";
export type IdentityStatus = "unverified" | "pending" | "verified" | "rejected";

export interface IdentityRecord {
  id: string;
  userId: string;
  provider: IdentityProvider;
  handle: string;
  url?: string;
  status: IdentityStatus;
  submittedAt: string;
  verifiedAt?: string;
  reviewerNote?: string;
}

// ─── The Haul: community wall of completed trades ────────────────────────────

/** Celebratory reaction set — additive only, no downvotes. */
export type HaulReactionEmoji = "🔥" | "👏" | "🤝" | "😮" | "🏴‍☠️";

export const HAUL_REACTIONS: { emoji: HaulReactionEmoji; label: string }[] = [
  { emoji: "🔥", label: "Heat" },
  { emoji: "👏", label: "Clean" },
  { emoji: "🤝", label: "Fair" },
  { emoji: "😮", label: "Whoa" },
  { emoji: "🏴‍☠️", label: "Heist" },
];

export interface HaulSideItem {
  listingId?: string;
  title: string;
  photo?: string;
}

/** One side of a shared trade, denormalized at share time (stays public-safe). */
export interface HaulSide {
  items: HaulSideItem[];
  cash: number;
}

export interface HaulCommentRecord {
  id: string;
  haulId: string;
  userId: string;
  body: string;
  createdAt: string;
  hidden: boolean;
}

export interface HaulComment extends HaulCommentRecord {
  user: User;
}

export interface HaulPostRecord {
  id: string;
  dealId: string;
  kind: DealKind;
  proposerId: string;
  ownerId: string;
  /** Who tapped "Show off this trade". */
  sharedBy: string;
  proposerSide: HaulSide;
  ownerSide: HaulSide;
  note?: string;
  commentsEnabled: boolean;
  hidden: boolean;
  hiddenBy?: string;
  createdAt: string;
}

/** Hydrated Haul card — everything the feed needs, reaction counts folded in. */
export interface HaulPost extends HaulPostRecord {
  proposer: User;
  owner: User;
  reactionCounts: Partial<Record<HaulReactionEmoji, number>>;
  totalReactions: number;
  /** The current viewer's reaction, if any. */
  myReaction?: HaulReactionEmoji;
  comments: HaulComment[];
  commentCount: number;
}

// ─── Sponsors & vendors (partners) ───────────────────────────────────────────

/**
 * A commercial partner. `sponsor` = a brand backing the community (e.g. a
 * snack or apparel brand) shown in support strips; `vendor` = a real gear
 * seller (jersey / disc / glove companies) listed in the shop directory. Both
 * link out to the partner's own site; Poachland doesn't process their sales.
 */
export type PartnerKind = "sponsor" | "vendor";

export type PartnerCategory =
  | "jerseys"
  | "discs"
  | "apparel"
  | "cleats"
  | "accessories"
  | "media"
  | "other";

export interface Partner {
  id: string;
  kind: PartnerKind;
  name: string;
  /** URL-safe unique handle for /vendors/[slug]. */
  slug: string;
  tagline: string;
  description: string;
  /** Logo image (data URL or hosted URL). */
  logo: string;
  /** External link to the partner's own site. */
  url: string;
  category: PartnerCategory;
  /** Featured partners surface first / in support strips. */
  featured: boolean;
  active: boolean;
  createdAt: string;
}

// ─── Persisted DB shape ──────────────────────────────────────────────────────

export interface DBState {
  v: number;
  currentUserId: string | null;
  users: UserRecord[];
  listings: ListingRecord[];
  isoPosts: ISOPostRecord[];
  deals: DealRecord[];
  threads: ThreadRecord[];
  messages: MessageRecord[];
  ratings: Rating[];
  notifications: Notification[];
  saves: Save[];
  reports: Report[];
  blocks: Block[];
  activity: ActivityEvent[];
  /** Linked real-life identities (IG / FB / USAU) for reputation binding. */
  identities?: IdentityRecord[];
  /**
   * Payment handles. PRIVATE: a snapshot only ever contains the viewer's own
   * plus those of counterparties in the viewer's ACCEPTED deals.
   */
  paymentMethods?: PaymentMethod[];
  /** The Haul — public wall of shared completed trades. */
  haulPosts?: HaulPost[];
  /** Active sponsors & vendors (public). */
  partners?: Partner[];
}
