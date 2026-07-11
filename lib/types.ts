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

export type ListingStatus =
  | "active" // visible, open to offers
  | "pending" // locked inside an accepted deal
  | "traded"
  | "sold"
  | "claimed"
  | "removed";

// ─── Users & reputation ──────────────────────────────────────────────────────

export type BadgeType =
  | "founding"
  | "trusted"
  | "veteran"
  | "collector"
  | "quick-shipper"
  | "first-trade"
  | "generous";

export interface Badge {
  id: string;
  label: string;
  type: BadgeType;
}

export interface UserRecord {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  location: string;
  favoriteTeams: string[];
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
}
