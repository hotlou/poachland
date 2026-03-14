/**
 * DEMO / SEED DATA — for display purposes only.
 * Replace with real database queries when connecting to a backend.
 */

export type Condition = "Mint" | "Near Mint" | "Good" | "Fair" | "Worn";
export type ListingType = "trade" | "sell" | "trade+cash" | "free";
export type ItemType = "jersey" | "disc";
export type Level = "club" | "college" | "pro" | "national" | "tournament";
export type Division = "open" | "women" | "mixed" | "masters";

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  location: string;
  favoriteTeams: string[];
  trustScore: number;
  tradesCompleted: number;
  memberSince: string;
  badges: Badge[];
  isVerified: boolean;
}

export interface Badge {
  id: string;
  label: string;
  type: "founding" | "trusted" | "veteran" | "collector" | "quick-shipper";
}

export interface Listing {
  id: string;
  sellerId: string;
  seller: User;
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
  shippingPreference: "seller-pays" | "buyer-pays" | "local-only";
  tags: string[];
  isRare?: boolean;
  isFeatured?: boolean;
}

export interface ISOPost {
  id: string;
  userId: string;
  user: User;
  itemType: ItemType;
  description: string;
  team?: string;
  size?: string;
  maxPrice?: number;
  createdAt: string;
  saves: number;
}

export interface TradeProposal {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromUser: User;
  toUser: User;
  offeredListingId: string;
  wantedListingId: string;
  cashAdded?: number;
  note: string;
  status: "pending" | "accepted" | "rejected" | "countered" | "completed" | "expired";
  createdAt: string;
  expiresAt: string;
}

export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: "trade_proposal" | "offer_accepted" | "offer_rejected" | "iso_match" | "new_message" | "deal_complete" | "new_rating";
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  linkTo?: string;
}

// ─── USERS ───────────────────────────────────────────────────────────────────

export const DEMO_USERS: User[] = [
  {
    id: "u1",
    username: "discwitch",
    displayName: "Mara Chen",
    avatar: "/images/avatar-2.jpg",
    bio: "Open div, 12 years deep. Collecting national team jerseys since 2016. Will trade almost anything for a 2019 Brute Squad game jersey.",
    location: "Boston, MA",
    favoriteTeams: ["Brute Squad", "Scandal", "Riot"],
    trustScore: 4.9,
    tradesCompleted: 47,
    memberSince: "2022-03-14",
    badges: [
      { id: "b1", label: "Founding Trader", type: "founding" },
      { id: "b2", label: "Trusted Trader", type: "trusted" },
      { id: "b3", label: "Quick Shipper", type: "quick-shipper" },
    ],
    isVerified: true,
  },
  {
    id: "u2",
    username: "flick_therapy",
    displayName: "Jake Torres",
    avatar: "/images/avatar-1.jpg",
    bio: "Midwest club open. Hoarder of tournament discs. Ask me about my 2011 UPA Championship disc.",
    location: "Chicago, IL",
    favoriteTeams: ["Johnny Bravo", "Ring of Fire", "Machine"],
    trustScore: 4.7,
    tradesCompleted: 31,
    memberSince: "2022-08-01",
    badges: [
      { id: "b4", label: "Trusted Trader", type: "trusted" },
      { id: "b5", label: "Collector", type: "collector" },
    ],
    isVerified: true,
  },
  {
    id: "u3",
    username: "huck_and_pray",
    displayName: "Sam Rivera",
    avatar: "/images/avatar-3.jpg",
    bio: "Mixed div, Pacific NW. Trade stack is deep. Send offers.",
    location: "Portland, OR",
    favoriteTeams: ["Mixtape", "AMP", "Drag'n Thrust"],
    trustScore: 4.5,
    tradesCompleted: 18,
    memberSince: "2023-01-20",
    badges: [
      { id: "b6", label: "Veteran Trader", type: "veteran" },
    ],
    isVerified: false,
  },
];

// ─── LISTINGS ────────────────────────────────────────────────────────────────

export const DEMO_LISTINGS: Listing[] = [
  {
    id: "l1",
    sellerId: "u1",
    seller: DEMO_USERS[0],
    type: "jersey",
    title: "2022 Brute Squad Game Jersey — #14",
    team: "Brute Squad",
    year: "2022",
    division: "women",
    level: "club",
    size: "M",
    condition: "Near Mint",
    listingType: "trade",
    tradeFor: "Any 2019-2022 national team jersey, open to offers",
    photos: ["/images/jersey-1.jpg"],
    description: "Authentic game jersey, worn twice. No stains, no pulls. Sublimated Tokay design. The actual jersey worn at nationals.",
    views: 342,
    saves: 28,
    createdAt: "2024-11-15T10:22:00Z",
    shippingPreference: "seller-pays",
    tags: ["nationals", "brute-squad", "rare", "womens"],
    isRare: true,
    isFeatured: true,
  },
  {
    id: "l2",
    sellerId: "u2",
    seller: DEMO_USERS[1],
    type: "disc",
    title: "2019 WFDF World Championship Disc — Cologne",
    team: "Team USA",
    year: "2019",
    level: "national",
    condition: "Mint",
    listingType: "sell",
    askingPrice: 65,
    photos: ["/images/disc-1.jpg"],
    description: "Never thrown. Straight out of the bag from Cologne worlds. Full color WFDF stamp on back. One of maybe 200 in circulation.",
    views: 218,
    saves: 41,
    createdAt: "2024-11-12T14:05:00Z",
    shippingPreference: "buyer-pays",
    tags: ["worlds", "wfdf", "mint", "rare"],
    isRare: true,
    isFeatured: true,
  },
  {
    id: "l3",
    sellerId: "u3",
    seller: DEMO_USERS[2],
    type: "jersey",
    title: "Mixtape 2021 USAU Nationals Jersey",
    team: "Mixtape",
    year: "2021",
    division: "mixed",
    level: "club",
    size: "L",
    condition: "Good",
    listingType: "trade+cash",
    askingPrice: 20,
    tradeFor: "Mixed division jerseys, collector discs",
    photos: ["/images/jersey-2.jpg"],
    description: "Real game jersey from USAU Nationals in San Diego. Minor wear on hem, barely visible. Great addition to any mixed collection.",
    views: 156,
    saves: 12,
    createdAt: "2024-11-10T09:00:00Z",
    shippingPreference: "buyer-pays",
    tags: ["mixtape", "mixed", "nationals"],
    isRare: false,
    isFeatured: false,
  },
  {
    id: "l4",
    sellerId: "u1",
    seller: DEMO_USERS[0],
    type: "jersey",
    title: "Riot 2018 Club Nationals Practice Jersey",
    team: "Riot",
    year: "2018",
    division: "women",
    level: "club",
    size: "S",
    condition: "Good",
    listingType: "sell",
    askingPrice: 35,
    photos: ["/images/jersey-3.jpg"],
    description: "Practice jersey from Riot's 2018 club season. Some fading from washing but all graphics intact.",
    views: 89,
    saves: 7,
    createdAt: "2024-11-08T11:30:00Z",
    shippingPreference: "seller-pays",
    tags: ["riot", "womens", "practice"],
    isRare: false,
  },
  {
    id: "l5",
    sellerId: "u2",
    seller: DEMO_USERS[1],
    type: "disc",
    title: "2011 UPA Club Championship Disc — Sarasota",
    team: "Multiple",
    year: "2011",
    level: "club",
    condition: "Good",
    listingType: "sell",
    askingPrice: 45,
    photos: ["/images/disc-2.jpg"],
    description: "Vintage disc from the last year of UPA branding before USAU. Significant historical value. Some scuffs from age but fully collectible.",
    views: 304,
    saves: 33,
    createdAt: "2024-11-05T16:45:00Z",
    shippingPreference: "buyer-pays",
    tags: ["vintage", "upa", "historical"],
    isRare: true,
    isFeatured: true,
  },
  {
    id: "l6",
    sellerId: "u3",
    seller: DEMO_USERS[2],
    type: "jersey",
    title: "AMP 2023 USAU Mixed Nationals Jersey",
    team: "AMP",
    year: "2023",
    division: "mixed",
    level: "club",
    size: "XL",
    condition: "Near Mint",
    listingType: "trade",
    tradeFor: "Open to mixed or club jerseys. Especially interested in Drag'n Thrust.",
    photos: ["/images/jersey-4.jpg"],
    description: "Barely worn. Worn one point in pool play as a sub. Basically a collectible at this point.",
    views: 201,
    saves: 19,
    createdAt: "2024-11-02T08:15:00Z",
    shippingPreference: "seller-pays",
    tags: ["amp", "mixed", "nationals", "near-mint"],
    isRare: false,
  },
  {
    id: "l7",
    sellerId: "u1",
    seller: DEMO_USERS[0],
    type: "disc",
    title: "Matte Black Chain Lightning Tour Disc — 2020",
    team: "Chain Lightning",
    year: "2020",
    level: "club",
    condition: "Mint",
    listingType: "sell",
    askingPrice: 30,
    photos: ["/images/disc-3.jpg"],
    description: "Tour disc from Chain Lightning's 2020 campaign. Never thrown. Matte finish, neon green artwork.",
    views: 127,
    saves: 22,
    createdAt: "2024-10-28T13:00:00Z",
    shippingPreference: "seller-pays",
    tags: ["chain-lightning", "matte", "tour-disc"],
    isRare: false,
  },
  {
    id: "l8",
    sellerId: "u2",
    seller: DEMO_USERS[1],
    type: "jersey",
    title: "Revolver 2017 Club Nationals Jersey",
    team: "Revolver",
    year: "2017",
    division: "open",
    level: "club",
    size: "M",
    condition: "Fair",
    listingType: "free",
    photos: ["/images/jersey-5.jpg"],
    description: "Looking to rehome this. Got two Revolver jerseys, only need one. Some pilling on back but it's real game-worn.",
    views: 512,
    saves: 44,
    createdAt: "2024-10-25T09:30:00Z",
    shippingPreference: "buyer-pays",
    tags: ["revolver", "open", "free", "game-worn"],
    isRare: false,
  },
];

// ─── ISO POSTS ───────────────────────────────────────────────────────────────

export const DEMO_ISO_POSTS: ISOPost[] = [
  {
    id: "iso1",
    userId: "u2",
    user: DEMO_USERS[1],
    itemType: "jersey",
    description: "ISO: Any Sockeye jersey from 2015-2019. Will pay or trade. Been hunting for three years.",
    team: "Sockeye",
    size: "L",
    maxPrice: 80,
    createdAt: "2024-11-14T10:00:00Z",
    saves: 8,
  },
  {
    id: "iso2",
    userId: "u3",
    user: DEMO_USERS[2],
    itemType: "disc",
    description: "Looking for a 2017 WFDF Worlds disc from Cincinnati. Will pay top dollar or trade multiple discs.",
    team: "WFDF",
    maxPrice: 120,
    createdAt: "2024-11-13T14:30:00Z",
    saves: 15,
  },
  {
    id: "iso3",
    userId: "u1",
    user: DEMO_USERS[0],
    itemType: "jersey",
    description: "ISO: Any Scandal women's jersey, any year. Have a solid trade stack including Brute, Riot, Fury.",
    team: "Scandal",
    size: "S",
    createdAt: "2024-11-11T08:45:00Z",
    saves: 11,
  },
  {
    id: "iso4",
    userId: "u2",
    user: DEMO_USERS[1],
    itemType: "disc",
    description: "Hunting vintage UPA era discs (pre-2013). Any condition considered. More interested in the history than the shine.",
    createdAt: "2024-11-09T16:00:00Z",
    saves: 6,
  },
];

// ─── TRADE PROPOSALS ─────────────────────────────────────────────────────────

export const DEMO_PROPOSALS: TradeProposal[] = [
  {
    id: "tp1",
    fromUserId: "u2",
    toUserId: "u1",
    fromUser: DEMO_USERS[1],
    toUser: DEMO_USERS[0],
    offeredListingId: "l5",
    wantedListingId: "l1",
    cashAdded: 15,
    note: "That Brute Jersey is sick. Offering my 2011 UPA disc + $15 cash. Let me know.",
    status: "pending",
    createdAt: "2024-11-15T18:00:00Z",
    expiresAt: "2024-11-22T18:00:00Z",
  },
  {
    id: "tp2",
    fromUserId: "u3",
    toUserId: "u2",
    fromUser: DEMO_USERS[2],
    toUser: DEMO_USERS[1],
    offeredListingId: "l3",
    wantedListingId: "l5",
    note: "Mixtape jersey for your UPA disc straight up? Both Good condition. Fair trade imo.",
    status: "countered",
    createdAt: "2024-11-14T12:00:00Z",
    expiresAt: "2024-11-21T12:00:00Z",
  },
];

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────

export const DEMO_NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    userId: "u1",
    type: "trade_proposal",
    title: "New trade proposal",
    body: "flick_therapy wants to trade their 2011 UPA disc + $15 for your Brute Squad jersey.",
    read: false,
    createdAt: "2024-11-15T18:02:00Z",
    linkTo: "/trades/tp1",
  },
  {
    id: "n2",
    userId: "u1",
    type: "iso_match",
    title: "ISO match found",
    body: "A new Scandal jersey listing matches your wanted post.",
    read: false,
    createdAt: "2024-11-15T14:30:00Z",
    linkTo: "/listings/l6",
  },
  {
    id: "n3",
    userId: "u1",
    type: "new_rating",
    title: "New rating from flick_therapy",
    body: "5 stars. Shipped fast, item exactly as described. Would trade again.",
    read: true,
    createdAt: "2024-11-14T09:00:00Z",
    linkTo: "/profile/u1",
  },
  {
    id: "n4",
    userId: "u1",
    type: "deal_complete",
    title: "Deal marked complete",
    body: "Your trade with huck_and_pray has been completed. Leave a rating.",
    read: true,
    createdAt: "2024-11-13T16:00:00Z",
    linkTo: "/trades/tp2",
  },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

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
