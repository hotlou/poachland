/**
 * Poachland domain engine.
 *
 * A fully client-side store: all marketplace logic (listings, deals with
 * multi-round negotiation, claims, messaging, ratings → reputation,
 * notifications, ISO matching, moderation) lives here, persisted to
 * localStorage. The view layer only ever talks to this class, so swapping in
 * a real backend later means re-implementing this API against a database —
 * no page changes.
 */

import { OFFER_EXPIRY_DAYS } from "./constants";
import { buildSeedState } from "./seed";
import type {
  ActivityEvent,
  ActivityType,
  Badge,
  BadgeType,
  Block,
  DBState,
  Deal,
  DealRecord,
  DealStatus,
  FulfillmentState,
  HydratedRating,
  IdentityProvider,
  IdentityRecord,
  PaymentKind,
  PaymentMethod,
  ISOPost,
  ISOPostRecord,
  ISOStatus,
  Listing,
  ListingRecord,
  ListingStatus,
  Message,
  MessageKind,
  MessageRecord,
  Notification,
  NotificationType,
  Offer,
  Rating,
  RatingSummary,
  Report,
  ReportStatus,
  ReportTargetType,
  SaveTargetType,
  Thread,
  ThreadRecord,
  User,
  UserRecord,
} from "./types";

const STORAGE_KEY = "poachland.db.v1";
const DAY_MS = 86_400_000;

export type Res<T = null> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const ok = <T,>(value: T): Res<T> => ({ ok: true, value });
const err = <T = null,>(error: string): Res<T> => ({ ok: false, error });

let uidCounter = 0;
/**
 * Client-generated entity id. Output always matches the server contract's
 * CLIENT_ID_PATTERN (`^[a-z]+_[a-z0-9]{5,32}$`): base-36 timestamp (~8 chars)
 * + counter + 5 random chars, all lowercase alphanumeric.
 */
export function uid(prefix: string): string {
  uidCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${uidCounter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

/** A fully empty world — what a remote-backed store starts from pre-snapshot. */
export function emptyDBState(): DBState {
  return {
    v: 1,
    currentUserId: null,
    users: [],
    listings: [],
    isoPosts: [],
    deals: [],
    threads: [],
    messages: [],
    ratings: [],
    notifications: [],
    saves: [],
    reports: [],
    blocks: [],
    activity: [],
    identities: [],
  };
}

/**
 * Placeholder identity returned by `requireUser()` before a session exists.
 * Zeroed out so pre-auth renders never flash another user's data.
 */
const GHOST_USER: User = {
  id: "__anon__",
  username: "you",
  displayName: "Guest",
  avatar: "/placeholder-user.jpg",
  bio: "",
  location: "",
  favoriteTeams: [],
  memberSince: "1970-01-01T00:00:00.000Z",
  isVerified: false,
  badges: [],
  baselineTrades: 0,
  baselineRatingCount: 0,
  baselineRatingSum: 0,
  trustScore: 0,
  ratingsCount: 0,
  tradesCompleted: 0,
};

export interface CreateListingInput {
  type: Listing["type"];
  title: string;
  team: string;
  year?: string;
  division?: Listing["division"];
  level: Listing["level"];
  size?: string;
  condition: Listing["condition"];
  listingType: Listing["listingType"];
  askingPrice?: number;
  tradeFor?: string;
  photos: string[];
  description: string;
  shippingPreference: Listing["shippingPreference"];
  tags: string[];
  isRare?: boolean;
}

export interface CreateISOInput {
  itemType: ISOPost["itemType"];
  description: string;
  team?: string;
  size?: string;
  maxPrice?: number;
}

export interface OfferTermsInput {
  proposerListingIds: string[];
  ownerListingIds: string[];
  cashFromProposer: number;
  cashFromOwner: number;
  note: string;
}

export interface ListingFilter {
  query?: string;
  itemType?: Listing["type"] | "all";
  listingType?: Listing["listingType"] | "all";
  conditions?: Listing["condition"][];
  team?: string;
  size?: string;
  minPrice?: number;
  maxPrice?: number;
  sellerId?: string;
  statuses?: ListingStatus[]; // defaults to ["active"]
  sort?: "newest" | "oldest" | "most-saved" | "most-viewed" | "price-low" | "price-high";
  includeOwn?: boolean; // include current user's listings (default true)
  /** Skip the viewer's block filter (moderation views must see everything). */
  includeBlocked?: boolean;
}

export interface RatingInput {
  communication: number;
  shippingSpeed: number;
  itemAccuracy: number;
  wouldTradeAgain: boolean;
  comment?: string;
}

export class PoachStore {
  protected state: DBState;
  private listeners = new Set<() => void>();
  protected viewedThisSession = new Set<string>();
  private persistable: boolean;
  version = 1;
  persistError = false;

  constructor(persistable: boolean, initialState?: DBState) {
    this.persistable = persistable;
    this.state = initialState ?? this.load();
    this.sweepExpirations();
  }

  // ── Infrastructure ─────────────────────────────────────────────────────────

  private load(): DBState {
    if (this.persistable) {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as DBState;
          if (parsed && parsed.v === 1 && Array.isArray(parsed.users)) {
            return parsed;
          }
        }
      } catch {
        // fall through to seed
      }
    }
    return buildSeedState();
  }

  private persist() {
    if (!this.persistable) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.persistError = false;
    } catch {
      this.persistError = true; // quota exceeded — keep running in memory
    }
  }

  protected commit() {
    this.persist();
    this.version += 1;
    for (const l of this.listeners) l();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = (): number => this.version;

  resetDemo() {
    this.state = buildSeedState();
    this.viewedThisSession.clear();
    if (this.persistable) {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    this.commit();
  }

  private now(): string {
    return new Date().toISOString();
  }

  // ── Session ────────────────────────────────────────────────────────────────

  get currentUserId(): string | null {
    return this.state.currentUserId;
  }

  currentUser(): User | null {
    return this.state.currentUserId ? this.getUser(this.state.currentUserId) : null;
  }

  /**
   * The signed-in user, or a harmless ghost placeholder when signed out —
   * never another user's record, so pre-auth renders can't impersonate.
   */
  requireUser(): User {
    return this.currentUser() ?? GHOST_USER;
  }

  signInAs(userId: string): Res {
    if (!this.rawUser(userId)) return err("No such user");
    this.state.currentUserId = userId;
    this.commit();
    return ok(null);
  }

  createAccount(input: {
    username: string;
    displayName: string;
    location: string;
    bio?: string;
    favoriteTeams?: string[];
    avatar?: string;
  }): Res<User> {
    const username = input.username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");
    if (username.length < 3) return err("Username must be at least 3 characters");
    if (this.state.users.some((u) => u.username === username))
      return err("That username is taken");
    if (!input.displayName.trim()) return err("Display name is required");
    const user: UserRecord = {
      id: uid("u"),
      username,
      displayName: input.displayName.trim(),
      avatar: input.avatar || "/placeholder-user.jpg",
      bio: input.bio?.trim() ?? "",
      location: input.location.trim(),
      favoriteTeams: input.favoriteTeams ?? [],
      memberSince: this.now(),
      isVerified: false,
      badges: [],
      baselineTrades: 0,
      baselineRatingCount: 0,
      baselineRatingSum: 0,
      trustScore: 0,
      ratingsCount: 0,
      tradesCompleted: 0,
    };
    this.state.users.push(user);
    this.state.currentUserId = user.id;
    this.pushActivity("new_member", user.id, undefined, `${user.username} joined Poachland`, `/app/u/${user.username}`);
    this.notify(
      user.id,
      "system",
      "Welcome to Poachland",
      "Post your first listing or ISO to start building your trade rep.",
      "/app/create",
    );
    this.commit();
    return ok(user);
  }

  /**
   * Finish account setup for the CURRENT (session) user — patches the existing
   * record rather than creating one. `createAccount` remains for the legacy
   * local-demo path.
   */
  completeOnboarding(input: {
    username: string;
    displayName: string;
    location: string;
    bio?: string;
    favoriteTeams?: string[];
    avatar?: string;
  }): Res<User> {
    const me = this.currentUser();
    if (!me) return err("Not signed in");
    const user = this.rawUser(me.id)!;
    const username = input.username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");
    if (username.length < 3) return err("Username must be at least 3 characters");
    if (this.state.users.some((u) => u.username === username && u.id !== user.id))
      return err("That username is taken");
    if (!input.displayName.trim()) return err("Display name is required");
    user.username = username;
    user.displayName = input.displayName.trim();
    user.location = input.location.trim();
    user.bio = input.bio?.trim() ?? "";
    user.favoriteTeams = input.favoriteTeams ?? [];
    if (input.avatar) user.avatar = input.avatar;
    this.commit();
    return ok(user);
  }

  updateProfile(
    patch: Partial<
      Pick<
        UserRecord,
        "displayName" | "bio" | "location" | "favoriteTeams" | "avatar" | "username" | "history" | "gallery"
      >
    >,
  ): Res<User> {
    const me = this.currentUser();
    if (!me) return err("Not signed in");
    const user = this.rawUser(me.id)!;
    if (patch.username !== undefined) {
      const username = patch.username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");
      if (username.length < 3) return err("Username must be at least 3 characters");
      if (this.state.users.some((u) => u.username === username && u.id !== user.id))
        return err("That username is taken");
      user.username = username;
    }
    if (patch.displayName !== undefined) {
      if (!patch.displayName.trim()) return err("Display name is required");
      user.displayName = patch.displayName.trim();
    }
    if (patch.bio !== undefined) user.bio = patch.bio.slice(0, 500);
    if (patch.location !== undefined) user.location = patch.location;
    if (patch.favoriteTeams !== undefined) user.favoriteTeams = patch.favoriteTeams;
    if (patch.avatar !== undefined && patch.avatar) user.avatar = patch.avatar;
    if (patch.history !== undefined) {
      if (patch.history.length > 12) return err("History is capped at 12 entries");
      if (patch.history.some((h) => !h.name.trim())) return err("History entries need a name");
      user.history = patch.history.map((h) => ({
        ...h,
        id: h.id || uid("h"),
        name: h.name.trim().slice(0, 80),
        years: h.years?.trim() || undefined,
        note: h.note?.trim() || undefined,
      }));
    }
    if (patch.gallery !== undefined) user.gallery = patch.gallery.slice(0, 4);
    this.commit();
    return ok(user);
  }

  // ── Users ──────────────────────────────────────────────────────────────────

  private rawUser(id: string): UserRecord | undefined {
    return this.state.users.find((u) => u.id === id);
  }

  getUser(id: string): User | null {
    return this.rawUser(id) ?? null;
  }

  getUserByUsername(username: string): User | null {
    const uname = username.toLowerCase();
    return this.state.users.find((u) => u.username === uname) ?? null;
  }

  listUsers(): User[] {
    return [...this.state.users];
  }

  userStats(userId: string): {
    activeListings: number;
    completedDeals: number;
    savesReceived: number;
    isoPosts: number;
  } {
    const listings = this.state.listings.filter((l) => l.sellerId === userId);
    return {
      activeListings: listings.filter((l) => l.status === "active").length,
      completedDeals: this.rawUser(userId)?.tradesCompleted ?? 0,
      savesReceived: listings.reduce((sum, l) => sum + l.saves, 0),
      isoPosts: this.state.isoPosts.filter((p) => p.userId === userId && p.status === "active").length,
    };
  }

  // ── Reputation ─────────────────────────────────────────────────────────────

  private ratingOverall(r: Rating): number {
    return (r.communication + r.shippingSpeed + r.itemAccuracy) / 3;
  }

  ratingsFor(userId: string): HydratedRating[] {
    return this.state.ratings
      .filter((r) => r.toUserId === userId)
      .map((r) => this.hydrateRating(r))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  ratingsBy(userId: string): HydratedRating[] {
    return this.state.ratings
      .filter((r) => r.fromUserId === userId)
      .map((r) => this.hydrateRating(r))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private hydrateRating(r: Rating): HydratedRating {
    return {
      ...r,
      fromUser: this.getUser(r.fromUserId)!,
      toUser: this.getUser(r.toUserId)!,
      deal: this.getDeal(r.dealId) ?? undefined,
    };
  }

  ratingSummary(userId: string): RatingSummary {
    const ratings = this.state.ratings.filter((r) => r.toUserId === userId);
    const user = this.rawUser(userId);
    const count = ratings.length;
    const baselineCount = user?.baselineRatingCount ?? 0;
    const baselineSum = user?.baselineRatingSum ?? 0;
    const totalCount = count + baselineCount;
    // Baseline history only recorded overall scores, so each dimension is
    // seeded with the baseline mean — keeps every figure on the same count.
    const avg = (pick: (r: Rating) => number) =>
      totalCount === 0
        ? 0
        : (ratings.reduce((s, r) => s + pick(r), 0) + baselineSum) / totalCount;
    const overall =
      totalCount === 0
        ? 0
        : (ratings.reduce((s, r) => s + this.ratingOverall(r), 0) + baselineSum) / totalCount;
    return {
      count: totalCount,
      overall: Math.round(overall * 10) / 10,
      communication: Math.round(avg((r) => r.communication) * 10) / 10,
      shippingSpeed: Math.round(avg((r) => r.shippingSpeed) * 10) / 10,
      itemAccuracy: Math.round(avg((r) => r.itemAccuracy) * 10) / 10,
      wouldTradeAgainPct:
        count === 0 ? 100 : Math.round((ratings.filter((r) => r.wouldTradeAgain).length / count) * 100),
    };
  }

  private recomputeReputation(userId: string) {
    const user = this.rawUser(userId);
    if (!user) return;
    const summary = this.ratingSummary(userId);
    user.trustScore = summary.overall;
    user.ratingsCount = summary.count;
    user.tradesCompleted =
      user.baselineTrades +
      this.state.deals.filter(
        (d) => d.status === "completed" && (d.proposerId === userId || d.ownerId === userId),
      ).length;
    this.awardBadges(user);
  }

  private awardBadges(user: UserRecord) {
    const has = (t: BadgeType) => user.badges.some((b) => b.type === t);
    const award = (type: BadgeType, label: string) => {
      if (has(type)) return;
      user.badges.push({ id: uid("b"), label, type });
      this.notify(
        user.id,
        "badge_earned",
        `Badge earned: ${label}`,
        "It now shows on your profile. Wear it well.",
        "/app/profile",
      );
    };
    const ratings = this.state.ratings.filter((r) => r.toUserId === user.id);
    if (user.tradesCompleted >= 1) award("first-trade", "First Trade");
    if (user.tradesCompleted >= 25) award("veteran", "Veteran Trader");
    if (user.tradesCompleted >= 10 && user.trustScore >= 4.5 && user.ratingsCount >= 5)
      award("trusted", "Trusted Trader");
    if (this.state.listings.filter((l) => l.sellerId === user.id).length >= 8)
      award("collector", "Collector");
    const shipRatings = ratings.map((r) => r.shippingSpeed);
    if (
      shipRatings.length >= 5 &&
      shipRatings.reduce((a, b) => a + b, 0) / shipRatings.length >= 4.7
    )
      award("quick-shipper", "Quick Shipper");
    const givenAway = this.state.deals.filter(
      (d) => d.status === "completed" && d.kind === "claim" && d.ownerId === user.id,
    ).length;
    if (givenAway >= 3) award("generous", "Community Giver");
  }

  // ── Listings ───────────────────────────────────────────────────────────────

  private hydrateListing(record: ListingRecord): Listing {
    return { ...record, seller: this.getUser(record.sellerId)! };
  }

  private rawListing(id: string): ListingRecord | undefined {
    return this.state.listings.find((l) => l.id === id);
  }

  getListing(id: string): Listing | null {
    const record = this.rawListing(id);
    return record ? this.hydrateListing(record) : null;
  }

  listListings(filter: ListingFilter = {}): Listing[] {
    const me = this.currentUser();
    const statuses = filter.statuses ?? ["active"];
    const q = filter.query?.trim().toLowerCase();
    let results = this.state.listings.filter((l) => {
      if (!statuses.includes(l.status)) return false;
      if (filter.sellerId && l.sellerId !== filter.sellerId) return false;
      if (!filter.sellerId && !filter.includeBlocked && me && this.isBlockedPair(me.id, l.sellerId))
        return false;
      if (filter.includeOwn === false && me && l.sellerId === me.id) return false;
      if (filter.itemType && filter.itemType !== "all" && l.type !== filter.itemType) return false;
      if (filter.listingType && filter.listingType !== "all" && l.listingType !== filter.listingType)
        return false;
      if (filter.conditions?.length && !filter.conditions.includes(l.condition)) return false;
      if (filter.team && !l.team.toLowerCase().includes(filter.team.toLowerCase())) return false;
      if (filter.size && l.size?.toLowerCase() !== filter.size.toLowerCase()) return false;
      if (filter.minPrice !== undefined && (l.askingPrice ?? 0) < filter.minPrice) return false;
      if (filter.maxPrice !== undefined && (l.askingPrice ?? 0) > filter.maxPrice) return false;
      if (q) {
        const hay = `${l.title} ${l.team} ${l.description} ${l.tags.join(" ")} ${l.year ?? ""}`.toLowerCase();
        if (!q.split(/\s+/).every((word) => hay.includes(word))) return false;
      }
      return true;
    });
    const sort = filter.sort ?? "newest";
    results = results.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return a.createdAt.localeCompare(b.createdAt);
        case "most-saved":
          return b.saves - a.saves;
        case "most-viewed":
          return b.views - a.views;
        case "price-low":
          return (a.askingPrice ?? 0) - (b.askingPrice ?? 0);
        case "price-high":
          return (b.askingPrice ?? 0) - (a.askingPrice ?? 0);
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });
    return results.map((l) => this.hydrateListing(l));
  }

  featuredListings(): Listing[] {
    return this.listListings({ sort: "most-saved" }).filter((l) => l.isFeatured);
  }

  createListing(input: CreateListingInput & { id?: string }): Res<Listing> {
    const me = this.currentUser();
    if (!me) return err("Not signed in");
    if (!input.title.trim()) return err("Title is required");
    if (!input.team.trim()) return err("Team is required");
    if (input.photos.length === 0) return err("Add at least one photo");
    if (input.listingType === "sell" && !input.askingPrice)
      return err("Set an asking price for a sale listing");
    const record: ListingRecord = {
      id: input.id ?? uid("l"),
      sellerId: me.id,
      type: input.type,
      title: input.title.trim(),
      team: input.team.trim(),
      year: input.year?.trim() || undefined,
      division: input.division,
      level: input.level,
      size: input.size?.trim() || undefined,
      condition: input.condition,
      listingType: input.listingType,
      askingPrice: input.listingType === "free" ? undefined : input.askingPrice,
      tradeFor: input.tradeFor?.trim() || undefined,
      photos: input.photos.slice(0, 4),
      description: input.description.trim(),
      views: 0,
      saves: 0,
      createdAt: this.now(),
      updatedAt: this.now(),
      shippingPreference: input.shippingPreference,
      tags: input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean),
      isRare: input.isRare,
      status: "active",
    };
    this.state.listings.push(record);
    this.pushActivity(
      "new_listing",
      me.id,
      record.id,
      `${me.username} listed "${record.title}"`,
      `/app/listings/${record.id}`,
    );
    this.matchListingToISOs(record);
    this.recomputeReputation(me.id); // collector badge
    this.commit();
    return ok(this.hydrateListing(record));
  }

  updateListing(id: string, patch: Partial<CreateListingInput>): Res<Listing> {
    const me = this.currentUser();
    const record = this.rawListing(id);
    if (!record) return err("Listing not found");
    if (!me || record.sellerId !== me.id) return err("Only the owner can edit a listing");
    if (record.status !== "active") return err("Only active listings can be edited");
    Object.assign(record, {
      ...patch,
      title: patch.title?.trim() ?? record.title,
      photos: patch.photos ? patch.photos.slice(0, 4) : record.photos,
      updatedAt: this.now(),
    });
    if (record.listingType === "free") record.askingPrice = undefined;
    this.commit();
    return ok(this.hydrateListing(record));
  }

  removeListing(id: string, opts: { byAdmin?: boolean; reason?: string } = {}): Res {
    const record = this.rawListing(id);
    if (!record) return err("Listing not found");
    const me = this.currentUser();
    if (!opts.byAdmin && (!me || record.sellerId !== me.id))
      return err("Only the owner can remove a listing");
    if (record.status === "pending")
      return err("This listing is locked in an accepted deal. Cancel the deal first.");
    record.status = "removed";
    record.updatedAt = this.now();
    // Close out any open negotiations that involve it.
    for (const deal of this.state.deals) {
      if (deal.status !== "open") continue;
      const offer = this.latestOffer(deal);
      const involved =
        deal.listingId === id ||
        offer.proposerListingIds.includes(id) ||
        offer.ownerListingIds.includes(id);
      if (involved) {
        this.closeDeal(deal, "declined", "The item is no longer available.");
        const other = deal.proposerId === record.sellerId ? deal.ownerId : deal.proposerId;
        this.notify(
          other,
          "offer_rejected",
          "Deal closed",
          "An item in your negotiation was removed, so the deal was closed.",
          `/app/trades/${deal.id}`,
        );
      }
    }
    if (opts.byAdmin) {
      this.notify(
        record.sellerId,
        "listing_removed",
        "Listing removed by moderators",
        opts.reason ?? `Your listing "${record.title}" was removed for violating community guidelines.`,
      );
    }
    this.commit();
    return ok(null);
  }

  markListingViewed(id: string) {
    if (this.viewedThisSession.has(id)) return;
    const record = this.rawListing(id);
    if (!record) return;
    const me = this.currentUser();
    if (me && me.id === record.sellerId) return; // own views don't count
    this.viewedThisSession.add(id);
    record.views += 1;
    this.commit();
  }

  setListingFeatured(id: string, featured: boolean): Res {
    const record = this.rawListing(id);
    if (!record) return err("Listing not found");
    record.isFeatured = featured;
    this.commit();
    return ok(null);
  }

  // ── ISO / wanted board ─────────────────────────────────────────────────────

  private hydrateISO(record: ISOPostRecord): ISOPost {
    return { ...record, user: this.getUser(record.userId)! };
  }

  getISOPost(id: string): ISOPost | null {
    const record = this.state.isoPosts.find((p) => p.id === id);
    return record ? this.hydrateISO(record) : null;
  }

  listISOPosts(filter: { itemType?: ISOPost["itemType"] | "all"; userId?: string; sort?: "newest" | "most-saved"; statuses?: ISOStatus[] } = {}): ISOPost[] {
    const me = this.currentUser();
    const statuses = filter.statuses ?? ["active"];
    return this.state.isoPosts
      .filter((p) => {
        if (!statuses.includes(p.status)) return false;
        if (filter.userId && p.userId !== filter.userId) return false;
        if (!filter.userId && me && this.isBlockedPair(me.id, p.userId)) return false;
        if (filter.itemType && filter.itemType !== "all" && p.itemType !== filter.itemType)
          return false;
        return true;
      })
      .sort((a, b) =>
        filter.sort === "most-saved" ? b.saves - a.saves : b.createdAt.localeCompare(a.createdAt),
      )
      .map((p) => this.hydrateISO(p));
  }

  createISOPost(input: CreateISOInput & { id?: string }): Res<ISOPost> {
    const me = this.currentUser();
    if (!me) return err("Not signed in");
    if (input.description.trim().length < 10)
      return err("Describe what you're hunting (at least 10 characters)");
    const record: ISOPostRecord = {
      id: input.id ?? uid("iso"),
      userId: me.id,
      itemType: input.itemType,
      description: input.description.trim(),
      team: input.team?.trim() || undefined,
      size: input.size?.trim() || undefined,
      maxPrice: input.maxPrice,
      createdAt: this.now(),
      saves: 0,
      status: "active",
    };
    this.state.isoPosts.push(record);
    this.pushActivity(
      "new_iso",
      me.id,
      record.id,
      `${me.username} is hunting: ${record.description.slice(0, 60)}${record.description.length > 60 ? "…" : ""}`,
      "/app/wanted",
    );
    // Tell the poster about existing listings that look like matches.
    const matches = this.state.listings.filter(
      (l) => l.status === "active" && l.sellerId !== me.id && this.listingMatchesISO(l, record),
    );
    if (matches.length > 0) {
      this.notify(
        me.id,
        "iso_match",
        `${matches.length} current listing${matches.length > 1 ? "s" : ""} might match your hunt`,
        `Check out "${matches[0].title}"${matches.length > 1 ? " and more" : ""}.`,
        matches.length === 1 ? `/app/listings/${matches[0].id}` : `/app/browse?q=${encodeURIComponent(record.team ?? "")}`,
      );
    }
    this.commit();
    return ok(this.hydrateISO(record));
  }

  updateISOStatus(id: string, status: ISOStatus): Res {
    const record = this.state.isoPosts.find((p) => p.id === id);
    if (!record) return err("Post not found");
    const me = this.currentUser();
    if (!me || record.userId !== me.id) return err("Only the poster can update this");
    record.status = status;
    this.commit();
    return ok(null);
  }

  private listingMatchesISO(listing: ListingRecord, iso: ISOPostRecord): boolean {
    if (listing.type !== iso.itemType) return false;
    const team = listing.team.toLowerCase();
    if (iso.team && (team.includes(iso.team.toLowerCase()) || iso.team.toLowerCase().includes(team)))
      return true;
    return iso.description.toLowerCase().includes(team) && team.length > 2;
  }

  private matchListingToISOs(listing: ListingRecord) {
    for (const iso of this.state.isoPosts) {
      if (iso.status !== "active" || iso.userId === listing.sellerId) continue;
      if (this.isBlockedPair(iso.userId, listing.sellerId)) continue;
      if (this.listingMatchesISO(listing, iso)) {
        this.notify(
          iso.userId,
          "iso_match",
          "ISO match found",
          `A new ${listing.type} listing matches your wanted post: "${listing.title}".`,
          `/app/listings/${listing.id}`,
        );
      }
    }
  }

  // ── Saves ──────────────────────────────────────────────────────────────────

  isSaved(targetType: SaveTargetType, targetId: string): boolean {
    const me = this.currentUser();
    if (!me) return false;
    return this.state.saves.some(
      (s) => s.userId === me.id && s.targetType === targetType && s.targetId === targetId,
    );
  }

  toggleSave(targetType: SaveTargetType, targetId: string): Res<boolean> {
    const me = this.currentUser();
    if (!me) return err("Not signed in");
    const idx = this.state.saves.findIndex(
      (s) => s.userId === me.id && s.targetType === targetType && s.targetId === targetId,
    );
    const counter =
      targetType === "listing"
        ? this.rawListing(targetId)
        : this.state.isoPosts.find((p) => p.id === targetId);
    if (idx >= 0) {
      this.state.saves.splice(idx, 1);
      if (counter) counter.saves = Math.max(0, counter.saves - 1);
      this.commit();
      return ok(false);
    }
    const ownerId =
      targetType === "listing"
        ? (counter as ListingRecord | undefined)?.sellerId
        : (counter as ISOPostRecord | undefined)?.userId;
    if (ownerId === me.id) return err("It's already yours — no need to save it");
    this.state.saves.push({ userId: me.id, targetType, targetId, createdAt: this.now() });
    if (counter) counter.saves += 1;
    this.commit();
    return ok(true);
  }

  savedListings(): Listing[] {
    const me = this.currentUser();
    if (!me) return [];
    return this.state.saves
      .filter((s) => s.userId === me.id && s.targetType === "listing")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((s) => this.getListing(s.targetId))
      .filter(
        (l): l is Listing =>
          !!l && l.status !== "removed" && !this.isBlockedPair(me.id, l.sellerId),
      );
  }

  savedISOPosts(): ISOPost[] {
    const me = this.currentUser();
    if (!me) return [];
    return this.state.saves
      .filter((s) => s.userId === me.id && s.targetType === "iso")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((s) => this.getISOPost(s.targetId))
      .filter((p): p is ISOPost => !!p && !this.isBlockedPair(me.id, p.userId));
  }

  // ── Deals: propose / negotiate / close ─────────────────────────────────────

  private latestOffer(deal: DealRecord): Offer {
    return deal.offers[deal.offers.length - 1];
  }

  /**
   * Lazily expire an open deal whose pending offer is past its deadline —
   * long-lived tabs never remount the provider, so the periodic sweep alone
   * isn't enough. Returns true if the deal just expired (caller must commit).
   */
  private expireOfferIfPast(deal: DealRecord): boolean {
    if (deal.status !== "open") return false;
    const offer = this.latestOffer(deal);
    if (offer.status !== "pending" || offer.expiresAt >= this.now()) return false;
    offer.status = "expired";
    deal.status = "expired";
    deal.closedAt = this.now();
    deal.updatedAt = this.now();
    for (const userId of [deal.proposerId, deal.ownerId]) {
      this.notify(
        userId,
        "system",
        "Offer expired",
        `An offer on "${this.rawListing(deal.listingId)?.title ?? "a listing"}" expired after ${OFFER_EXPIRY_DAYS} days without a response.`,
        `/app/trades/${deal.id}`,
      );
    }
    return true;
  }

  private hydrateDeal(record: DealRecord): Deal {
    return {
      ...record,
      listing: this.getListing(record.listingId)!,
      proposer: this.getUser(record.proposerId)!,
      owner: this.getUser(record.ownerId)!,
      currentOffer: this.latestOffer(record),
    };
  }

  getDeal(id: string): Deal | null {
    const record = this.state.deals.find((d) => d.id === id);
    return record ? this.hydrateDeal(record) : null;
  }

  dealsForUser(
    userId: string,
    opts: { box?: "incoming" | "outgoing" | "all"; statuses?: DealStatus[] } = {},
  ): Deal[] {
    const box = opts.box ?? "all";
    return this.state.deals
      .filter((d) => {
        if (d.proposerId !== userId && d.ownerId !== userId) return false;
        if (box === "incoming" && d.ownerId !== userId) return false;
        if (box === "outgoing" && d.proposerId !== userId) return false;
        if (opts.statuses && !opts.statuses.includes(d.status)) return false;
        return true;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((d) => this.hydrateDeal(d));
  }

  /** Deals where it's the given user's turn to respond to a pending offer. */
  dealsAwaitingResponse(userId: string): Deal[] {
    return this.dealsForUser(userId, { statuses: ["open"] }).filter(
      (d) => d.currentOffer.byUserId !== userId,
    );
  }

  /** Open or accepted deal between the current user and a listing, if any. */
  activeDealForListing(listingId: string): Deal | null {
    const me = this.currentUser();
    if (!me) return null;
    const record = this.state.deals.find(
      (d) =>
        d.listingId === listingId &&
        (d.proposerId === me.id || d.ownerId === me.id) &&
        (d.status === "open" || d.status === "accepted"),
    );
    return record ? this.hydrateDeal(record) : null;
  }

  /** All open claim/offer deals on one of my listings (for the owner view). */
  openDealsOnListing(listingId: string): Deal[] {
    return this.state.deals
      .filter((d) => d.listingId === listingId && (d.status === "open" || d.status === "accepted"))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((d) => this.hydrateDeal(d));
  }

  private makeOffer(
    byUserId: string,
    terms: OfferTermsInput,
    status: Offer["status"] = "pending",
  ): Offer {
    return {
      id: uid("of"),
      byUserId,
      proposerListingIds: terms.proposerListingIds,
      ownerListingIds: terms.ownerListingIds,
      cashFromProposer: Math.max(0, Math.round(terms.cashFromProposer)),
      cashFromOwner: Math.max(0, Math.round(terms.cashFromOwner)),
      note: terms.note.slice(0, 500),
      createdAt: this.now(),
      expiresAt: new Date(Date.now() + OFFER_EXPIRY_DAYS * DAY_MS).toISOString(),
      status,
    };
  }

  private validateOfferListings(offer: OfferTermsInput, proposerId: string, ownerId: string): string | null {
    for (const id of offer.proposerListingIds) {
      const l = this.rawListing(id);
      if (!l || l.sellerId !== proposerId) return "You can only offer your own listings";
      if (l.status !== "active") return `"${l.title}" is not available to offer`;
    }
    for (const id of offer.ownerListingIds) {
      const l = this.rawListing(id);
      if (!l || l.sellerId !== ownerId) return "Requested items must belong to the listing owner";
      if (l.status !== "active") return `"${l.title}" is not available`;
    }
    return null;
  }

  private openDeal(
    kind: DealRecord["kind"],
    listingId: string,
    terms: OfferTermsInput,
    ids: { dealId?: string; threadId?: string } = {},
  ): Res<Deal> {
    const me = this.currentUser();
    if (!me) return err("Not signed in");
    const listing = this.rawListing(listingId);
    if (!listing) return err("Listing not found");
    if (listing.sellerId === me.id) return err("You can't open a deal on your own listing");
    if (listing.status !== "active") return err("This listing is no longer available");
    if (this.isBlockedPair(me.id, listing.sellerId)) return err("You can't trade with this user");
    const existing = this.state.deals.find(
      (d) =>
        d.listingId === listingId &&
        d.proposerId === me.id &&
        (d.status === "open" || d.status === "accepted"),
    );
    if (existing) return err("You already have an active deal on this listing");
    const invalid = this.validateOfferListings(terms, me.id, listing.sellerId);
    if (invalid) return err(invalid);

    const now = this.now();
    const offer = this.makeOffer(me.id, terms);
    const thread: ThreadRecord = {
      id: ids.threadId ?? uid("t"),
      participantIds: [me.id, listing.sellerId],
      listingId,
      createdAt: now,
      updatedAt: now,
      lastRead: { [me.id]: now },
    };
    const deal: DealRecord = {
      id: ids.dealId ?? uid("d"),
      kind,
      listingId,
      proposerId: me.id,
      ownerId: listing.sellerId,
      offers: [offer],
      status: "open",
      threadId: thread.id,
      createdAt: now,
      updatedAt: now,
      fulfillment: {},
    };
    thread.dealId = deal.id;
    this.state.threads.push(thread);
    this.state.deals.push(deal);
    this.appendMessage(thread.id, me.id, "offer", this.describeOffer(deal, offer), offer.id);
    if (terms.note.trim()) {
      this.appendMessage(thread.id, me.id, "text", terms.note.trim());
    }
    const notifType: NotificationType =
      kind === "trade" ? "trade_proposal" : kind === "buy" ? "buy_offer" : "claim_request";
    const title =
      kind === "trade" ? "New trade proposal" : kind === "buy" ? "New offer" : "Someone wants to claim your item";
    this.notify(
      listing.sellerId,
      notifType,
      title,
      `${me.username} → "${listing.title}": ${this.describeOffer(deal, offer)}`,
      `/app/trades/${deal.id}`,
    );
    this.commit();
    return ok(this.hydrateDeal(deal));
  }

  proposeTrade(input: {
    listingId: string;
    offeredListingIds: string[];
    cashAdded?: number;
    note?: string;
    dealId?: string;
    threadId?: string;
  }): Res<Deal> {
    if (input.offeredListingIds.length === 0)
      return err("Pick at least one of your items to offer");
    return this.openDeal(
      "trade",
      input.listingId,
      {
        proposerListingIds: input.offeredListingIds,
        ownerListingIds: [input.listingId],
        cashFromProposer: input.cashAdded ?? 0,
        cashFromOwner: 0,
        note: input.note ?? "",
      },
      { dealId: input.dealId, threadId: input.threadId },
    );
  }

  makeBuyOffer(input: {
    listingId: string;
    amount: number;
    note?: string;
    dealId?: string;
    threadId?: string;
  }): Res<Deal> {
    if (!input.amount || input.amount <= 0) return err("Enter an offer amount");
    return this.openDeal(
      "buy",
      input.listingId,
      {
        proposerListingIds: [],
        ownerListingIds: [input.listingId],
        cashFromProposer: input.amount,
        cashFromOwner: 0,
        note: input.note ?? "",
      },
      { dealId: input.dealId, threadId: input.threadId },
    );
  }

  claimListing(input: {
    listingId: string;
    note?: string;
    dealId?: string;
    threadId?: string;
  }): Res<Deal> {
    const listing = this.rawListing(input.listingId);
    if (listing && listing.listingType !== "free")
      return err("Only free listings can be claimed");
    return this.openDeal(
      "claim",
      input.listingId,
      {
        proposerListingIds: [],
        ownerListingIds: [input.listingId],
        cashFromProposer: 0,
        cashFromOwner: 0,
        note: input.note ?? "",
      },
      { dealId: input.dealId, threadId: input.threadId },
    );
  }

  counterOffer(dealId: string, terms: OfferTermsInput): Res<Deal> {
    const me = this.currentUser();
    if (!me) return err("Not signed in");
    const deal = this.state.deals.find((d) => d.id === dealId);
    if (!deal) return err("Deal not found");
    if (deal.status !== "open") return err("This deal is no longer open to counters");
    if (deal.proposerId !== me.id && deal.ownerId !== me.id) return err("Not your deal");
    if (this.isBlockedPair(me.id, this.otherParty(deal, me.id)))
      return err("You can't trade with this user");
    if (this.expireOfferIfPast(deal)) {
      this.commit();
      return err("This offer expired before a response");
    }
    const current = this.latestOffer(deal);
    if (current.byUserId === me.id)
      return err("Your offer is already on the table — wait for a response or withdraw it");
    if (terms.proposerListingIds.length === 0 && terms.cashFromProposer <= 0 && deal.kind !== "claim")
      return err("A counter needs items or cash on the proposer side");
    const invalid = this.validateOfferListings(terms, deal.proposerId, deal.ownerId);
    if (invalid) return err(invalid);
    current.status = "superseded";
    const offer = this.makeOffer(me.id, terms);
    deal.offers.push(offer);
    deal.updatedAt = this.now();
    this.appendMessage(deal.threadId, me.id, "offer", this.describeOffer(deal, offer), offer.id);
    if (terms.note.trim()) this.appendMessage(deal.threadId, me.id, "text", terms.note.trim());
    const other = this.otherParty(deal, me.id);
    this.notify(
      other,
      "offer_countered",
      "Counter-offer received",
      `${me.username} countered: ${this.describeOffer(deal, offer)}`,
      `/app/trades/${deal.id}`,
    );
    this.commit();
    return ok(this.hydrateDeal(deal));
  }

  acceptOffer(dealId: string): Res<Deal> {
    const me = this.currentUser();
    if (!me) return err("Not signed in");
    const deal = this.state.deals.find((d) => d.id === dealId);
    if (!deal) return err("Deal not found");
    if (deal.status !== "open") return err("This deal is not open");
    const offer = this.latestOffer(deal);
    if (offer.byUserId === me.id) return err("You can't accept your own offer");
    if (deal.proposerId !== me.id && deal.ownerId !== me.id) return err("Not your deal");
    if (this.isBlockedPair(me.id, this.otherParty(deal, me.id)))
      return err("You can't trade with this user");
    if (this.expireOfferIfPast(deal)) {
      this.commit();
      return err("This offer expired before a response");
    }
    // Everything changing hands must still be available.
    for (const id of [...offer.proposerListingIds, ...offer.ownerListingIds]) {
      const l = this.rawListing(id);
      if (!l || l.status !== "active")
        return err(`"${l?.title ?? "An item"}" is no longer available`);
    }
    offer.status = "accepted";
    deal.status = "accepted";
    deal.acceptedAt = this.now();
    deal.updatedAt = this.now();
    // Lock the items.
    const lockedIds = [...offer.proposerListingIds, ...offer.ownerListingIds];
    for (const id of lockedIds) {
      const l = this.rawListing(id)!;
      l.status = "pending";
      l.updatedAt = this.now();
    }
    // Close competing deals that involve any locked item.
    for (const otherDeal of this.state.deals) {
      if (otherDeal.id === deal.id || otherDeal.status !== "open") continue;
      const o = this.latestOffer(otherDeal);
      const overlaps =
        lockedIds.includes(otherDeal.listingId) ||
        o.proposerListingIds.some((id) => lockedIds.includes(id)) ||
        o.ownerListingIds.some((id) => lockedIds.includes(id));
      if (overlaps) {
        this.closeDeal(otherDeal, "declined", "The item went to another trade.");
        // Notify every party of the competing deal (the accepter may not be
        // one of them when the same item was offered in two negotiations).
        for (const partyId of [otherDeal.proposerId, otherDeal.ownerId]) {
          if (partyId === me.id) continue;
          this.notify(
            partyId,
            "offer_rejected",
            "Item no longer available",
            "An item in your negotiation was committed to another deal.",
            `/app/trades/${otherDeal.id}`,
          );
        }
      }
    }
    this.appendMessage(
      deal.threadId,
      me.id,
      "system",
      `${me.username} accepted the offer. Deal agreed — arrange shipping and mark it complete when your end arrives.`,
    );
    this.notify(
      this.otherParty(deal, me.id),
      "offer_accepted",
      "Offer accepted 🤝",
      `${me.username} accepted your offer. Time to ship.`,
      `/app/trades/${deal.id}`,
    );
    this.commit();
    return ok(this.hydrateDeal(deal));
  }

  declineOffer(dealId: string, reason?: string): Res {
    const me = this.currentUser();
    if (!me) return err("Not signed in");
    const deal = this.state.deals.find((d) => d.id === dealId);
    if (!deal) return err("Deal not found");
    if (deal.status !== "open") return err("This deal is not open");
    if (deal.proposerId !== me.id && deal.ownerId !== me.id) return err("Not your deal");
    if (this.expireOfferIfPast(deal)) {
      this.commit();
      return err("This offer already expired — no need to decline");
    }
    const offer = this.latestOffer(deal);
    if (offer.byUserId === me.id) return err("Use withdraw to pull your own offer");
    offer.status = "declined";
    this.closeDeal(deal, "declined", reason);
    this.appendMessage(
      deal.threadId,
      me.id,
      "system",
      `${me.username} declined the offer.${reason ? ` "${reason}"` : ""}`,
    );
    this.notify(
      this.otherParty(deal, me.id),
      "offer_rejected",
      "Offer declined",
      `${me.username} passed on your offer${reason ? `: "${reason}"` : "."}`,
      `/app/trades/${deal.id}`,
    );
    this.commit();
    return ok(null);
  }

  withdrawOffer(dealId: string): Res {
    const me = this.currentUser();
    if (!me) return err("Not signed in");
    const deal = this.state.deals.find((d) => d.id === dealId);
    if (!deal) return err("Deal not found");
    if (deal.status !== "open") return err("This deal is not open");
    const offer = this.latestOffer(deal);
    if (offer.byUserId !== me.id) return err("You can only withdraw your own offer");
    offer.status = "withdrawn";
    this.closeDeal(deal, "withdrawn");
    this.appendMessage(deal.threadId, me.id, "system", `${me.username} withdrew their offer.`);
    this.notify(
      this.otherParty(deal, me.id),
      "offer_withdrawn",
      "Offer withdrawn",
      `${me.username} withdrew their offer on "${this.rawListing(deal.listingId)?.title ?? "a listing"}".`,
      `/app/trades/${deal.id}`,
    );
    this.commit();
    return ok(null);
  }

  cancelDeal(dealId: string, reason?: string): Res {
    const me = this.currentUser();
    if (!me) return err("Not signed in");
    const deal = this.state.deals.find((d) => d.id === dealId);
    if (!deal) return err("Deal not found");
    if (deal.status !== "accepted") return err("Only accepted deals can be cancelled");
    if (deal.proposerId !== me.id && deal.ownerId !== me.id) return err("Not your deal");
    this.releaseDealListings(deal);
    this.closeDeal(deal, "cancelled", reason);
    this.appendMessage(
      deal.threadId,
      me.id,
      "system",
      `${me.username} cancelled the deal.${reason ? ` "${reason}"` : ""}`,
    );
    this.notify(
      this.otherParty(deal, me.id),
      "deal_cancelled",
      "Deal cancelled",
      `${me.username} backed out of your deal${reason ? `: "${reason}"` : "."}`,
      `/app/trades/${deal.id}`,
    );
    this.commit();
    return ok(null);
  }

  markShipped(dealId: string, tracking?: string): Res {
    const me = this.currentUser();
    if (!me) return err("Not signed in");
    const deal = this.state.deals.find((d) => d.id === dealId);
    if (!deal) return err("Deal not found");
    if (deal.status !== "accepted") return err("The deal isn't in the shipping stage");
    if (deal.proposerId !== me.id && deal.ownerId !== me.id) return err("Not your deal");
    const f: FulfillmentState = deal.fulfillment[me.id] ?? {};
    f.shippedAt = this.now();
    if (tracking?.trim()) f.tracking = tracking.trim();
    deal.fulfillment[me.id] = f;
    deal.updatedAt = this.now();
    this.appendMessage(
      deal.threadId,
      me.id,
      "system",
      `${me.username} marked their end shipped${tracking ? ` — tracking ${tracking}` : ""}.`,
    );
    this.notify(
      this.otherParty(deal, me.id),
      "shipped",
      "Shipment on the way 📦",
      `${me.username} shipped their end of the deal${tracking ? ` (tracking ${tracking})` : ""}.`,
      `/app/trades/${deal.id}`,
    );
    this.commit();
    return ok(null);
  }

  /**
   * Confirm your end of an accepted deal is settled (item received / handoff
   * done). When both parties confirm, the deal completes: items change
   * status, trade counts tick up, and ratings unlock.
   */
  confirmComplete(dealId: string): Res<{ completed: boolean }> {
    const me = this.currentUser();
    if (!me) return err("Not signed in");
    const deal = this.state.deals.find((d) => d.id === dealId);
    if (!deal) return err("Deal not found");
    if (deal.status !== "accepted") return err("The deal isn't awaiting completion");
    if (deal.proposerId !== me.id && deal.ownerId !== me.id) return err("Not your deal");
    const f: FulfillmentState = deal.fulfillment[me.id] ?? {};
    if (f.receivedAt) return err("You already confirmed this deal");
    f.receivedAt = this.now();
    deal.fulfillment[me.id] = f;
    deal.updatedAt = this.now();
    const other = this.otherParty(deal, me.id);
    const bothConfirmed = !!deal.fulfillment[other]?.receivedAt;
    if (!bothConfirmed) {
      this.appendMessage(
        deal.threadId,
        me.id,
        "system",
        `${me.username} confirmed their end is complete. Waiting on the other side.`,
      );
      this.notify(
        other,
        "deal_complete",
        "Almost done",
        `${me.username} confirmed the deal. Confirm your end to complete it and unlock ratings.`,
        `/app/trades/${deal.id}`,
      );
      this.commit();
      return ok({ completed: false });
    }
    // Both sides confirmed — complete the deal.
    deal.status = "completed";
    deal.completedAt = this.now();
    const offer = this.latestOffer(deal);
    for (const id of offer.proposerListingIds) {
      const l = this.rawListing(id);
      if (l) {
        l.status = "traded";
        l.updatedAt = this.now();
      }
    }
    for (const id of offer.ownerListingIds) {
      const l = this.rawListing(id);
      if (l) {
        l.status = deal.kind === "buy" ? "sold" : deal.kind === "claim" ? "claimed" : "traded";
        l.updatedAt = this.now();
      }
    }
    const listing = this.rawListing(deal.listingId);
    this.appendMessage(
      deal.threadId,
      me.id,
      "system",
      "Deal complete 🎉 Both sides confirmed. Rate each other to build trust.",
    );
    for (const userId of [deal.proposerId, deal.ownerId]) {
      this.recomputeReputation(userId);
      this.notify(
        userId,
        "deal_complete",
        "Deal complete 🎉",
        `Your ${deal.kind === "claim" ? "claim" : deal.kind === "buy" ? "purchase" : "trade"} of "${listing?.title ?? "an item"}" is done. Leave a rating.`,
        `/app/trades/${deal.id}`,
      );
    }
    this.pushActivity(
      "deal_completed",
      deal.proposerId,
      deal.id,
      `${this.rawUser(deal.proposerId)?.username} and ${this.rawUser(deal.ownerId)?.username} completed a ${deal.kind === "claim" ? "handoff" : deal.kind === "buy" ? "sale" : "trade"}: "${listing?.title ?? ""}"`,
      `/app/listings/${deal.listingId}`,
    );
    this.commit();
    return ok({ completed: true });
  }

  openDispute(dealId: string, reason: string): Res {
    const me = this.currentUser();
    if (!me) return err("Not signed in");
    const deal = this.state.deals.find((d) => d.id === dealId);
    if (!deal) return err("Deal not found");
    if (deal.status !== "accepted") return err("Only accepted deals can be disputed");
    if (deal.proposerId !== me.id && deal.ownerId !== me.id) return err("Not your deal");
    if (!reason.trim()) return err("Describe the problem");
    deal.status = "disputed";
    deal.disputeReason = reason.trim();
    deal.updatedAt = this.now();
    this.state.reports.push({
      id: uid("r"),
      reporterId: me.id,
      targetType: "deal",
      targetId: deal.id,
      reason: "Deal dispute",
      details: reason.trim(),
      status: "pending",
      createdAt: this.now(),
    });
    this.appendMessage(
      deal.threadId,
      me.id,
      "system",
      `${me.username} opened a dispute: "${reason.trim()}". Moderators will review.`,
    );
    this.notify(
      this.otherParty(deal, me.id),
      "deal_disputed",
      "Dispute opened",
      `${me.username} reported a problem with your deal. Moderators will review.`,
      `/app/trades/${deal.id}`,
    );
    this.commit();
    return ok(null);
  }

  /** Admin: settle a disputed deal by cancelling or force-completing it. */
  resolveDispute(dealId: string, outcome: "cancelled" | "completed", note?: string): Res {
    const deal = this.state.deals.find((d) => d.id === dealId);
    if (!deal) return err("Deal not found");
    if (deal.status !== "disputed") return err("Deal is not disputed");
    if (outcome === "cancelled") {
      this.releaseDealListings(deal);
      this.closeDeal(deal, "cancelled", note ?? "Cancelled by moderators after dispute review");
    } else {
      deal.status = "accepted"; // restore so both confirmations complete it
      deal.fulfillment[deal.proposerId] = {
        ...deal.fulfillment[deal.proposerId],
        receivedAt: this.now(),
      };
      // Trigger normal completion path via the owner side.
      deal.fulfillment[deal.ownerId] = {
        ...deal.fulfillment[deal.ownerId],
        receivedAt: this.now(),
      };
      deal.status = "completed";
      deal.completedAt = this.now();
      const offer = this.latestOffer(deal);
      for (const id of [...offer.proposerListingIds, ...offer.ownerListingIds]) {
        const l = this.rawListing(id);
        if (l && l.status === "pending") {
          l.status = deal.kind === "buy" && offer.ownerListingIds.includes(id) ? "sold" : deal.kind === "claim" && offer.ownerListingIds.includes(id) ? "claimed" : "traded";
        }
      }
      this.recomputeReputation(deal.proposerId);
      this.recomputeReputation(deal.ownerId);
    }
    for (const userId of [deal.proposerId, deal.ownerId]) {
      this.notify(
        userId,
        "system",
        "Dispute resolved",
        `Moderators resolved the dispute: deal ${outcome}.${note ? ` ${note}` : ""}`,
        `/app/trades/${deal.id}`,
      );
    }
    this.appendMessage(
      deal.threadId,
      deal.ownerId,
      "system",
      `Moderators resolved the dispute — deal ${outcome}.`,
    );
    this.commit();
    return ok(null);
  }

  private otherParty(deal: DealRecord, userId: string): string {
    return deal.proposerId === userId ? deal.ownerId : deal.proposerId;
  }

  private releaseDealListings(deal: DealRecord) {
    const offer = this.latestOffer(deal);
    for (const id of [...offer.proposerListingIds, ...offer.ownerListingIds]) {
      const l = this.rawListing(id);
      if (l && l.status === "pending") {
        l.status = "active";
        l.updatedAt = this.now();
      }
    }
  }

  private closeDeal(deal: DealRecord, status: DealStatus, reason?: string) {
    deal.status = status;
    deal.closedAt = this.now();
    deal.updatedAt = this.now();
    if (reason) deal.declineReason = reason;
    const offer = this.latestOffer(deal);
    if (offer.status === "pending") {
      offer.status =
        status === "declined" ? "declined" : status === "withdrawn" ? "withdrawn" : status === "expired" ? "expired" : "superseded";
    }
  }

  /** Human-readable summary of an offer, used in messages and notifications. */
  describeOffer(deal: DealRecord | Deal, offer: Offer): string {
    const names = (ids: string[]) =>
      ids.map((id) => `"${this.rawListing(id)?.title ?? "an item"}"`).join(" + ");
    const proposerSide: string[] = [];
    if (offer.proposerListingIds.length) proposerSide.push(names(offer.proposerListingIds));
    if (offer.cashFromProposer > 0) proposerSide.push(`$${offer.cashFromProposer}`);
    const ownerSide: string[] = [];
    if (offer.ownerListingIds.length) ownerSide.push(names(offer.ownerListingIds));
    if (offer.cashFromOwner > 0) ownerSide.push(`$${offer.cashFromOwner}`);
    if (deal.kind === "claim") return `wants to claim ${ownerSide.join(" + ") || "the item"}`;
    if (deal.kind === "buy")
      return `offers $${offer.cashFromProposer} for ${ownerSide.join(" + ") || "the item"}`;
    return `${proposerSide.join(" + ") || "nothing"} ⇄ ${ownerSide.join(" + ") || "nothing"}`;
  }

  sweepExpirations() {
    let changed = false;
    for (const deal of this.state.deals) {
      if (this.expireOfferIfPast(deal)) changed = true;
    }
    if (changed) this.commit();
  }

  // ── Ratings ────────────────────────────────────────────────────────────────

  canRateDeal(dealId: string): boolean {
    const me = this.currentUser();
    if (!me) return false;
    const deal = this.state.deals.find((d) => d.id === dealId);
    if (!deal || deal.status !== "completed") return false;
    if (deal.proposerId !== me.id && deal.ownerId !== me.id) return false;
    return !this.state.ratings.some((r) => r.dealId === dealId && r.fromUserId === me.id);
  }

  rateDeal(dealId: string, input: RatingInput): Res<Rating> {
    const me = this.currentUser();
    if (!me) return err("Not signed in");
    const deal = this.state.deals.find((d) => d.id === dealId);
    if (!deal) return err("Deal not found");
    if (deal.status !== "completed") return err("Ratings unlock once both parties complete the deal");
    if (deal.proposerId !== me.id && deal.ownerId !== me.id) return err("Not your deal");
    if (this.state.ratings.some((r) => r.dealId === dealId && r.fromUserId === me.id))
      return err("You already rated this deal");
    const clamp = (n: number) => Math.min(5, Math.max(1, Math.round(n)));
    const rating: Rating = {
      id: uid("rt"),
      dealId,
      fromUserId: me.id,
      toUserId: this.otherParty(deal, me.id),
      communication: clamp(input.communication),
      shippingSpeed: clamp(input.shippingSpeed),
      itemAccuracy: clamp(input.itemAccuracy),
      wouldTradeAgain: input.wouldTradeAgain,
      comment: input.comment?.trim() || undefined,
      createdAt: this.now(),
    };
    this.state.ratings.push(rating);
    this.recomputeReputation(rating.toUserId);
    const overall = this.ratingOverall(rating);
    this.notify(
      rating.toUserId,
      "new_rating",
      `New rating from ${me.username}`,
      `${overall.toFixed(1)} stars.${rating.comment ? ` "${rating.comment}"` : ""}${rating.wouldTradeAgain ? " Would trade again." : ""}`,
      "/app/ratings",
    );
    this.pushActivity(
      "new_rating",
      me.id,
      rating.toUserId,
      `${me.username} rated ${this.rawUser(rating.toUserId)?.username} ${overall.toFixed(1)}★`,
      `/app/u/${this.rawUser(rating.toUserId)?.username}`,
    );
    this.commit();
    return ok(rating);
  }

  /** Completed deals the user still needs to rate. */
  pendingRatings(userId: string): Deal[] {
    return this.state.deals
      .filter(
        (d) =>
          d.status === "completed" &&
          (d.proposerId === userId || d.ownerId === userId) &&
          !this.state.ratings.some((r) => r.dealId === d.id && r.fromUserId === userId),
      )
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
      .map((d) => this.hydrateDeal(d));
  }

  // ── Messaging ──────────────────────────────────────────────────────────────

  private appendMessage(
    threadId: string,
    senderId: string,
    kind: MessageKind,
    content: string,
    offerId?: string,
    id?: string,
  ): MessageRecord {
    const msg: MessageRecord = {
      id: id ?? uid("m"),
      threadId,
      senderId,
      kind,
      content,
      offerId,
      createdAt: this.now(),
    };
    this.state.messages.push(msg);
    const thread = this.state.threads.find((t) => t.id === threadId);
    if (thread) {
      thread.updatedAt = msg.createdAt;
      thread.lastRead[senderId] = msg.createdAt;
    }
    return msg;
  }

  getOrCreateThread(
    otherUserId: string,
    context: { listingId?: string; isoPostId?: string } = {},
    threadId?: string,
  ): Res<Thread> {
    const me = this.currentUser();
    if (!me) return err("Not signed in");
    if (otherUserId === me.id) return err("That's you");
    if (!this.rawUser(otherUserId)) return err("User not found");
    if (this.isBlockedPair(me.id, otherUserId)) return err("You can't message this user");
    let thread = this.state.threads.find(
      (t) =>
        t.participantIds.includes(me.id) &&
        t.participantIds.includes(otherUserId) &&
        !t.dealId &&
        (context.listingId ? t.listingId === context.listingId : true) &&
        (context.isoPostId ? t.isoPostId === context.isoPostId : true),
    );
    if (!thread) {
      const now = this.now();
      thread = {
        id: threadId ?? uid("t"),
        participantIds: [me.id, otherUserId],
        listingId: context.listingId,
        isoPostId: context.isoPostId,
        createdAt: now,
        updatedAt: now,
        lastRead: { [me.id]: now },
      };
      this.state.threads.push(thread);
      this.commit();
    }
    return ok(this.hydrateThread(thread, me.id));
  }

  sendMessage(threadId: string, content: string, id?: string): Res<Message> {
    const me = this.currentUser();
    if (!me) return err("Not signed in");
    const thread = this.state.threads.find((t) => t.id === threadId);
    if (!thread || !thread.participantIds.includes(me.id)) return err("Thread not found");
    const trimmed = content.trim();
    if (!trimmed) return err("Message is empty");
    const other = thread.participantIds.find((p) => p !== me.id)!;
    if (this.isBlockedPair(me.id, other)) return err("You can't message this user");
    const msg = this.appendMessage(threadId, me.id, "text", trimmed.slice(0, 2000), undefined, id);
    // Collapse per-thread message notifications so they don't stack up.
    this.state.notifications = this.state.notifications.filter(
      (n) => !(n.userId === other && n.type === "new_message" && n.linkTo === `/app/inbox/${threadId}` && !n.read),
    );
    this.notify(
      other,
      "new_message",
      `Message from ${me.username}`,
      trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed,
      `/app/inbox/${threadId}`,
    );
    this.commit();
    return ok(msg);
  }

  private hydrateThread(record: ThreadRecord, viewerId: string): Thread {
    const msgs = this.state.messages.filter((m) => m.threadId === record.id);
    const lastRead = record.lastRead[viewerId] ?? "";
    const otherId = record.participantIds.find((p) => p !== viewerId) ?? record.participantIds[0];
    const dealRecord = record.dealId
      ? this.state.deals.find((d) => d.id === record.dealId)
      : undefined;
    return {
      ...record,
      participants: record.participantIds.map((id) => this.getUser(id)!).filter(Boolean),
      otherUser: this.getUser(otherId)!,
      lastMessage: msgs[msgs.length - 1],
      unreadCount: msgs.filter((m) => m.senderId !== viewerId && m.createdAt > lastRead).length,
      listing: record.listingId ? this.getListing(record.listingId) ?? undefined : undefined,
      deal: dealRecord ? this.hydrateDeal(dealRecord) : undefined,
    };
  }

  getThread(threadId: string): Thread | null {
    const me = this.requireUser();
    const record = this.state.threads.find((t) => t.id === threadId);
    if (!record || !record.participantIds.includes(me.id)) return null;
    return this.hydrateThread(record, me.id);
  }

  threadMessages(threadId: string): Message[] {
    return this.state.messages
      .filter((m) => m.threadId === threadId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  getOffer(offerId: string): { offer: Offer; deal: Deal } | null {
    for (const deal of this.state.deals) {
      const offer = deal.offers.find((o) => o.id === offerId);
      if (offer) return { offer, deal: this.hydrateDeal(deal) };
    }
    return null;
  }

  listThreads(): Thread[] {
    const me = this.requireUser();
    return this.state.threads
      .filter((t) => t.participantIds.includes(me.id))
      .filter((t) => {
        const other = t.participantIds.find((p) => p !== me.id);
        return !other || !this.isBlockedPair(me.id, other);
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((t) => this.hydrateThread(t, me.id));
  }

  markThreadRead(threadId: string) {
    const me = this.currentUser();
    if (!me) return;
    const thread = this.state.threads.find((t) => t.id === threadId);
    if (!thread) return;
    const msgs = this.state.messages.filter((m) => m.threadId === threadId);
    const last = msgs[msgs.length - 1];
    const current = thread.lastRead[me.id] ?? "";
    const target = last?.createdAt ?? this.now();
    if (current >= target) return;
    thread.lastRead[me.id] = target;
    this.commit();
  }

  unreadMessageCount(): number {
    const me = this.currentUser();
    if (!me) return 0;
    return this.listThreads().reduce((sum, t) => sum + t.unreadCount, 0);
  }

  // ── Notifications ──────────────────────────────────────────────────────────

  private notify(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    linkTo?: string,
  ) {
    this.state.notifications.push({
      id: uid("n"),
      userId,
      type,
      title,
      body,
      read: false,
      createdAt: this.now(),
      linkTo,
    });
  }

  listNotifications(): Notification[] {
    const me = this.requireUser();
    return this.state.notifications
      .filter((n) => n.userId === me.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  unreadNotificationCount(): number {
    const me = this.currentUser();
    if (!me) return 0;
    return this.state.notifications.filter((n) => n.userId === me.id && !n.read).length;
  }

  markNotificationRead(id: string) {
    const n = this.state.notifications.find((x) => x.id === id);
    if (n && !n.read) {
      n.read = true;
      this.commit();
    }
  }

  markAllNotificationsRead() {
    const me = this.currentUser();
    if (!me) return;
    let changed = false;
    for (const n of this.state.notifications) {
      if (n.userId === me.id && !n.read) {
        n.read = true;
        changed = true;
      }
    }
    if (changed) this.commit();
  }

  // ── Moderation: reports & blocks ───────────────────────────────────────────

  reportTarget(targetType: ReportTargetType, targetId: string, reason: string, details?: string): Res {
    const me = this.currentUser();
    if (!me) return err("Not signed in");
    if (!reason.trim()) return err("Pick a reason");
    this.state.reports.push({
      id: uid("r"),
      reporterId: me.id,
      targetType,
      targetId,
      reason: reason.trim(),
      details: details?.trim() || undefined,
      status: "pending",
      createdAt: this.now(),
    });
    this.commit();
    return ok(null);
  }

  isBlockedPair(a: string, b: string): boolean {
    return this.state.blocks.some(
      (x) => (x.blockerId === a && x.blockedId === b) || (x.blockerId === b && x.blockedId === a),
    );
  }

  hasBlocked(targetId: string): boolean {
    const me = this.currentUser();
    if (!me) return false;
    return this.state.blocks.some((b) => b.blockerId === me.id && b.blockedId === targetId);
  }

  blockUser(targetId: string): Res {
    const me = this.currentUser();
    if (!me) return err("Not signed in");
    if (targetId === me.id) return err("You can't block yourself");
    if (this.hasBlocked(targetId)) return err("Already blocked");
    this.state.blocks.push({ blockerId: me.id, blockedId: targetId, createdAt: this.now() });
    this.commit();
    return ok(null);
  }

  unblockUser(targetId: string): Res {
    const me = this.currentUser();
    if (!me) return err("Not signed in");
    const idx = this.state.blocks.findIndex(
      (b) => b.blockerId === me.id && b.blockedId === targetId,
    );
    if (idx < 0) return err("Not blocked");
    this.state.blocks.splice(idx, 1);
    this.commit();
    return ok(null);
  }

  blockedUsers(): User[] {
    const me = this.currentUser();
    if (!me) return [];
    return this.state.blocks
      .filter((b) => b.blockerId === me.id)
      .map((b) => this.getUser(b.blockedId))
      .filter((u): u is User => !!u);
  }

  // ── Linked identities (reputation scaffolding) ─────────────────────────────

  listIdentities(userId: string): IdentityRecord[] {
    return (this.state.identities ?? [])
      .filter((i) => i.userId === userId)
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  }

  linkIdentity(input: {
    id?: string;
    provider: IdentityProvider;
    handle: string;
    url?: string;
  }): Res<IdentityRecord> {
    const me = this.currentUser();
    if (!me) return err("Not signed in");
    const handle = input.handle.trim();
    if (!handle) return err("Enter a handle");
    if (handle.length > 80) return err("Handle is too long (80 characters max)");
    const mine = this.listIdentities(me.id);
    if (mine.length >= 5) return err("You can link up to 5 identities");
    if (
      mine.some(
        (i) => i.provider === input.provider && i.handle.toLowerCase() === handle.toLowerCase(),
      )
    )
      return err("You already linked that handle");
    const record: IdentityRecord = {
      id: input.id ?? uid("idn"),
      userId: me.id,
      provider: input.provider,
      handle,
      url: input.url?.trim() || undefined,
      status: "unverified", // verification is a server-side review
      submittedAt: this.now(),
    };
    if (!this.state.identities) this.state.identities = [];
    this.state.identities.push(record);
    this.commit();
    return ok(record);
  }

  removeIdentity(id: string): Res {
    const me = this.currentUser();
    if (!me) return err("Not signed in");
    const list = this.state.identities ?? [];
    const idx = list.findIndex((i) => i.id === id);
    if (idx < 0) return err("Identity not found");
    if (list[idx].userId !== me.id)
      return err("You can only remove your own linked identities");
    list.splice(idx, 1);
    this.commit();
    return ok(null);
  }

  // ── Payment handles (private — revealed only inside accepted deals) ───────

  myPaymentMethods(): PaymentMethod[] {
    const me = this.currentUser();
    if (!me) return [];
    return this.paymentMethodsFor(me.id);
  }

  /**
   * Payment handles present in local state for a user. For anyone other than
   * the current user, the server only ships these when you share an ACCEPTED
   * deal, so this is inherently deal-scoped.
   */
  paymentMethodsFor(userId: string): PaymentMethod[] {
    return (this.state.paymentMethods ?? [])
      .filter((m) => m.userId === userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  addPaymentMethod(input: {
    id?: string;
    kind: PaymentKind;
    label?: string;
    value: string;
  }): Res<PaymentMethod> {
    const me = this.currentUser();
    if (!me) return err("Not signed in");
    const value = input.value.trim();
    if (!value) return err("Enter the handle or address");
    if (value.length > 120) return err("Handle is too long (120 characters max)");
    const mine = this.myPaymentMethods();
    if (mine.length >= 6) return err("You can save up to 6 payment handles");
    if (mine.some((m) => m.kind === input.kind && m.value === value))
      return err("You already saved that handle");
    const record: PaymentMethod = {
      id: input.id ?? uid("pm"),
      userId: me.id,
      kind: input.kind,
      label: input.label?.trim() || undefined,
      value,
      createdAt: this.now(),
    };
    if (!this.state.paymentMethods) this.state.paymentMethods = [];
    this.state.paymentMethods.push(record);
    this.commit();
    return ok(record);
  }

  removePaymentMethod(id: string): Res {
    const me = this.currentUser();
    if (!me) return err("Not signed in");
    const list = this.state.paymentMethods ?? [];
    const idx = list.findIndex((m) => m.id === id);
    if (idx < 0) return err("Payment handle not found");
    if (list[idx].userId !== me.id) return err("You can only remove your own handles");
    list.splice(idx, 1);
    this.commit();
    return ok(null);
  }

  // ── Deal proof (shipping photos / receipts) ────────────────────────────────

  attachProof(dealId: string, photos: string[]): Res {
    const me = this.currentUser();
    if (!me) return err("Not signed in");
    const deal = this.state.deals.find((d) => d.id === dealId);
    if (!deal) return err("Deal not found");
    if (deal.proposerId !== me.id && deal.ownerId !== me.id) return err("Not your deal");
    if (deal.status !== "accepted" && deal.status !== "disputed")
      return err("Proof can be added while a deal is in progress");
    if (photos.length === 0) return err("Add at least one photo");
    const f: FulfillmentState = deal.fulfillment[me.id] ?? {};
    const existing = f.proofPhotos ?? [];
    if (existing.length >= 4) return err("Proof is capped at 4 photos");
    f.proofPhotos = [...existing, ...photos].slice(0, 4);
    deal.fulfillment[me.id] = f;
    deal.updatedAt = this.now();
    this.appendMessage(
      deal.threadId,
      me.id,
      "system",
      `${me.username} added ${photos.length} proof photo${photos.length > 1 ? "s" : ""} to the deal.`,
    );
    this.commit();
    return ok(null);
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  listReports(status?: ReportStatus): Report[] {
    return this.state.reports
      .filter((r) => (status ? r.status === status : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  resolveReport(
    reportId: string,
    action: "dismiss" | "remove-listing" | "warn-user",
    note?: string,
  ): Res {
    const report = this.state.reports.find((r) => r.id === reportId);
    if (!report) return err("Report not found");
    if (report.status !== "pending") return err("Already handled");
    if (action === "dismiss") {
      report.status = "dismissed";
      report.resolution = note ?? "Dismissed — no action needed";
    } else if (action === "remove-listing") {
      if (report.targetType !== "listing") return err("Not a listing report");
      const res = this.removeListing(report.targetId, { byAdmin: true, reason: note });
      if (!res.ok) return res;
      report.status = "resolved";
      report.resolution = note ?? "Listing removed";
    } else {
      const targetUserId =
        report.targetType === "user"
          ? report.targetId
          : report.targetType === "listing"
            ? this.rawListing(report.targetId)?.sellerId
            : undefined;
      if (!targetUserId) return err("No user to warn for this report");
      this.notify(
        targetUserId,
        "system",
        "Community guidelines warning",
        note ?? "A moderator reviewed a report about your activity. Keep it clean out there.",
      );
      report.status = "resolved";
      report.resolution = note ?? "User warned";
    }
    report.resolvedAt = this.now();
    this.commit();
    return ok(null);
  }

  setUserVerified(userId: string, verified: boolean): Res {
    const user = this.rawUser(userId);
    if (!user) return err("User not found");
    user.isVerified = verified;
    if (verified) {
      this.notify(userId, "system", "You're verified ✓", "Your account passed identity review.");
    }
    this.commit();
    return ok(null);
  }

  adminStats() {
    const deals = this.state.deals;
    return {
      users: this.state.users.length,
      verifiedUsers: this.state.users.filter((u) => u.isVerified).length,
      listings: this.state.listings.filter((l) => l.status !== "removed").length,
      activeListings: this.state.listings.filter((l) => l.status === "active").length,
      isoPosts: this.state.isoPosts.filter((p) => p.status === "active").length,
      dealsTotal: deals.length,
      dealsOpen: deals.filter((d) => d.status === "open").length,
      dealsAccepted: deals.filter((d) => d.status === "accepted").length,
      dealsCompleted: deals.filter((d) => d.status === "completed").length,
      dealsDisputed: deals.filter((d) => d.status === "disputed").length,
      pendingReports: this.state.reports.filter((r) => r.status === "pending").length,
      ratings: this.state.ratings.length,
      messages: this.state.messages.length,
    };
  }

  disputedDeals(): Deal[] {
    return this.state.deals
      .filter((d) => d.status === "disputed")
      .map((d) => this.hydrateDeal(d));
  }

  // ── Activity feed ──────────────────────────────────────────────────────────

  private pushActivity(
    type: ActivityType,
    actorId: string,
    targetId: string | undefined,
    summary: string,
    linkTo?: string,
  ) {
    this.state.activity.push({
      id: uid("a"),
      type,
      actorId,
      targetId,
      summary,
      createdAt: this.now(),
      linkTo,
    });
    if (this.state.activity.length > 200) {
      this.state.activity = this.state.activity.slice(-200);
    }
  }

  listActivity(limit = 20): (ActivityEvent & { actor: User | null })[] {
    const me = this.currentUser();
    return [...this.state.activity]
      .filter((a) => !me || !this.isBlockedPair(me.id, a.actorId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((a) => ({ ...a, actor: this.getUser(a.actorId) }));
  }
}

// ─── Singleton wiring ─────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __poachStore: PoachStore | undefined;
}

/** Client singleton (survives HMR and client-side navigation). */
export function getClientStore(): PoachStore {
  if (!globalThis.__poachStore) {
    globalThis.__poachStore = new PoachStore(true);
  }
  return globalThis.__poachStore;
}

/** Non-persisted store for server rendering — always seed data. */
export function createEphemeralStore(): PoachStore {
  return new PoachStore(false);
}
