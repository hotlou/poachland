/**
 * THE CONTRACT between the client store and the server engine.
 *
 * Every marketplace mutation is one `Op` dispatched through the `dispatchOp`
 * server action (app/actions/engine.ts). The server re-validates everything
 * against the session user inside a transaction and responds with a fresh
 * authoritative `WorldSnapshot`, which the client swaps in wholesale.
 *
 * ID convention: entities whose ids appear in URLs (listings, deals, threads,
 * ISO posts, messages, identities) accept a CLIENT-GENERATED id (`uid()`
 * pattern `^[a-z]+_[a-z0-9]{5,32}$`) so optimistic navigation and the server
 * state converge. The server validates the format and uniqueness and rejects
 * collisions. Ids of purely internal rows (offers, notifications, activity)
 * are server-generated.
 */

import type {
  Condition,
  DBState,
  Division,
  EmailPrefs,
  HaulReactionEmoji,
  IdentityProvider,
  IdentityRecord,
  ISOStatus,
  ItemType,
  Level,
  ListingType,
  Partner,
  PartnerCategory,
  PartnerKind,
  PaymentKind,
  ReportTargetType,
  SaveTargetType,
  ShippingPreference,
  UserRecord,
  UserStatus,
} from "../types";

// ─── Snapshot ─────────────────────────────────────────────────────────────────

/**
 * The viewer's world. Same shape the client engine already consumes (DBState)
 * plus session info. Privacy scoping is done server-side:
 *  - users: all public profiles (never emails)
 *  - listings: all non-removed, plus the viewer's own removed ones
 *  - isoPosts, ratings, activity (last 50), identities: public
 *  - deals, threads, messages, notifications, saves, blocks, reports: only
 *    rows involving the viewer
 * Signed-out viewers get the public collections with `me: null` and empty
 * private collections.
 */
export interface WorldSnapshot extends Omit<DBState, "currentUserId"> {
  serverTime: string;
  me: SessionMe | null;
}

export interface SessionMe extends UserRecord {
  email: string;
  isAdmin: boolean;
  /** True until completeOnboarding sets a username. */
  needsOnboarding: boolean;
  /** Whether a password is set (magic link always works either way). */
  hasPassword: boolean;
  /**
   * Account standing as shown TO THE USER. `shadowbanned` is masked to
   * `active` here — the user must never see it. Drives the gate screen.
   */
  accountStatus: "active" | "suspended" | "banned";
  suspendedUntil?: string;
  moderationNote?: string;
  /** Set when an admin is viewing the app "as" this user (support/debug). */
  impersonatedByAdmin?: string;
  /** Per-category email notification opt-ins. */
  emailPrefs: EmailPrefs;
  /** How many traders joined through this user's invite link. */
  referralCount: number;
  /** 1-based join rank among onboarded members (for "Founding Member #N"). */
  memberNumber: number;
}

/** Admin-only view fetched separately (fetchAdminData). */
export interface AdminData {
  reports: DBState["reports"];
  disputedDeals: DBState["deals"];
  identityQueue: IdentityRecord[];
  /** All partners (active + inactive) for management. */
  partners: Partner[];
  users: (UserRecord & {
    email: string;
    status: UserStatus;
    suspendedUntil?: string;
    moderationNote?: string;
    isAdmin: boolean;
  })[];
  stats: {
    users: number;
    verifiedUsers: number;
    listings: number;
    activeListings: number;
    isoPosts: number;
    dealsTotal: number;
    dealsOpen: number;
    dealsAccepted: number;
    dealsCompleted: number;
    dealsDisputed: number;
    pendingReports: number;
    pendingIdentities: number;
    ratings: number;
    messages: number;
  };
}

// ─── Op payloads ──────────────────────────────────────────────────────────────

export interface ListingInput {
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
  shippingPreference: ShippingPreference;
  tags: string[];
  isRare?: boolean;
}

export interface ISOInput {
  itemType: ItemType;
  description: string;
  team?: string;
  size?: string;
  maxPrice?: number;
}

export interface OfferTerms {
  proposerListingIds: string[];
  ownerListingIds: string[];
  cashFromProposer: number;
  cashFromOwner: number;
  note: string;
}

export interface RatingInputPayload {
  communication: number;
  shippingSpeed: number;
  itemAccuracy: number;
  wouldTradeAgain: boolean;
  comment?: string;
}

export interface OpMap {
  // session / profile
  completeOnboarding: {
    username: string;
    displayName: string;
    location: string;
    bio?: string;
    favoriteTeams?: string[];
    avatar?: string;
    /** Username of the trader whose invite link brought them, if any. */
    referrerUsername?: string;
  };
  updateProfile: {
    patch: Partial<
      Pick<
        UserRecord,
        | "displayName"
        | "bio"
        | "location"
        | "favoriteTeams"
        | "avatar"
        | "username"
        | "history"
        | "gallery"
      >
    >;
  };
  // email preferences
  setEmailPrefs: { prefs: EmailPrefs };
  // payment handles (private)
  addPaymentMethod: { id: string; kind: PaymentKind; label?: string; value: string };
  removePaymentMethod: { id: string };
  // deal proof (shipping photos / receipts)
  attachProof: { dealId: string; photos: string[] };
  // The Haul — community wall of completed trades
  shareHaul: { id: string; dealId: string; note?: string };
  hideHaul: { haulId: string };
  reactHaul: { haulId: string; emoji: HaulReactionEmoji };
  commentHaul: { id: string; haulId: string; body: string };
  setHaulComments: { haulId: string; enabled: boolean };
  deleteHaulComment: { commentId: string };
  // listings
  createListing: { id: string; input: ListingInput };
  updateListing: { id: string; patch: Partial<ListingInput> };
  removeListing: { id: string };
  markListingViewed: { id: string };
  toggleSave: { targetType: SaveTargetType; targetId: string };
  // wanted board
  createISOPost: { id: string; input: ISOInput };
  updateISOStatus: { id: string; status: ISOStatus };
  // deals
  proposeTrade: {
    dealId: string;
    threadId: string;
    listingId: string;
    offeredListingIds: string[];
    cashAdded?: number;
    note?: string;
  };
  makeBuyOffer: { dealId: string; threadId: string; listingId: string; amount: number; note?: string };
  claimListing: { dealId: string; threadId: string; listingId: string; note?: string };
  counterOffer: { dealId: string; terms: OfferTerms };
  acceptOffer: { dealId: string };
  declineOffer: { dealId: string; reason?: string };
  withdrawOffer: { dealId: string };
  cancelDeal: { dealId: string; reason?: string };
  markShipped: { dealId: string; tracking?: string };
  confirmComplete: { dealId: string };
  openDispute: { dealId: string; reason: string };
  rateDeal: { dealId: string; input: RatingInputPayload };
  // messaging
  getOrCreateThread: {
    threadId: string;
    otherUserId: string;
    context?: { listingId?: string; isoPostId?: string };
  };
  sendMessage: { id: string; threadId: string; content: string };
  markThreadRead: { threadId: string };
  // notifications
  markNotificationRead: { id: string };
  markAllNotificationsRead: Record<string, never>;
  // moderation (user-level)
  reportTarget: { targetType: ReportTargetType; targetId: string; reason: string; details?: string };
  blockUser: { targetId: string };
  unblockUser: { targetId: string };
  // identity scaffolding
  linkIdentity: { id: string; provider: IdentityProvider; handle: string; url?: string };
  removeIdentity: { id: string };
  // admin (require isAdmin)
  adminResolveReport: { reportId: string; action: "dismiss" | "remove-listing" | "warn-user"; note?: string };
  adminResolveDispute: { dealId: string; outcome: "cancelled" | "completed"; note?: string };
  adminSetUserVerified: { userId: string; verified: boolean };
  adminSetUserStatus: {
    userId: string;
    status: UserStatus;
    /** For "suspended": days from now until it auto-lifts (default 7). */
    days?: number;
    note?: string;
  };
  adminSetListingFeatured: { id: string; featured: boolean };
  adminRemoveListing: { id: string; reason?: string };
  adminReviewIdentity: { identityId: string; status: "verified" | "rejected" | "pending"; note?: string };
  adminUpsertPartner: {
    id: string;
    kind: PartnerKind;
    name: string;
    slug?: string;
    tagline?: string;
    description?: string;
    logo?: string;
    url?: string;
    category?: PartnerCategory;
    featured?: boolean;
    active?: boolean;
    sortOrder?: number;
  };
  adminRemovePartner: { id: string };
}

export type OpName = keyof OpMap;

export type OpResult =
  | { ok: true; snapshot: WorldSnapshot }
  | { ok: false; error: string; snapshot?: WorldSnapshot };

export const CLIENT_ID_PATTERN = /^[a-z]+_[a-z0-9]{5,32}$/;
