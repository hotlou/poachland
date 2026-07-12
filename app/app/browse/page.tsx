"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { ListingCard } from "@/components/listing-card";
import { TrustScore } from "@/components/trust-badge";
import { Hydrated } from "@/components/hydrated";
import { useStore } from "@/lib/store-context";
import type { ListingFilter } from "@/lib/engine";
import type { Condition, ItemType, ListingType } from "@/lib/types";
import { cn } from "@/lib/utils";

const CONDITIONS: Condition[] = ["Mint", "Near Mint", "Good", "Fair", "Worn"];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const ITEM_TYPE_CHIPS: { value: "all" | ItemType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "jersey", label: "Jerseys" },
  { value: "disc", label: "Discs" },
];
const LISTING_TYPE_CHIPS: { value: "all" | ListingType; label: string }[] = [
  { value: "all", label: "Any deal" },
  { value: "trade", label: "Trade" },
  { value: "sell", label: "For sale" },
  { value: "free", label: "Free" },
  { value: "trade+cash", label: "Trade + cash" },
];
const SORT_OPTIONS: { value: NonNullable<ListingFilter["sort"]>; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "most-saved", label: "Most saved" },
  { value: "most-viewed", label: "Most viewed" },
  { value: "price-low", label: "Price: low to high" },
  { value: "price-high", label: "Price: high to low" },
];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-colors",
        active
          ? "bg-accent text-accent-foreground border-accent shadow-sm"
          : "bg-card text-muted-foreground border-border hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function parsePrice(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function ResultsSkeleton() {
  return (
    <div>
      <div className="h-3 w-24 bg-surface rounded-sm mb-4 animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="aspect-[4/3] bg-surface animate-pulse" />
            <div className="p-3 space-y-2">
              <div className="h-2.5 w-2/3 bg-surface rounded-sm animate-pulse" />
              <div className="h-3.5 w-full bg-surface rounded-sm animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BrowseContent() {
  const store = useStore();
  const searchParams = useSearchParams();
  const qParam = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(qParam);
  const [itemType, setItemType] = useState<"all" | ItemType>("all");
  const [listingType, setListingType] = useState<"all" | ListingType>("all");
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [team, setTeam] = useState("");
  const [size, setSize] = useState("");
  const [sort, setSort] = useState<NonNullable<ListingFilter["sort"]>>("newest");
  const [showFilters, setShowFilters] = useState(false);

  // Follow ?q= if a link navigates here while the page is already mounted.
  useEffect(() => {
    setQuery(qParam);
  }, [qParam]);

  const toggleCondition = (c: Condition) =>
    setConditions((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const panelFilterCount =
    conditions.length +
    (parsePrice(minPrice) !== undefined ? 1 : 0) +
    (parsePrice(maxPrice) !== undefined ? 1 : 0) +
    (team.trim() ? 1 : 0) +
    (size ? 1 : 0) +
    (sort !== "newest" ? 1 : 0);

  const hasAnyFilter =
    !!query.trim() || itemType !== "all" || listingType !== "all" || panelFilterCount > 0;

  const clearPanelFilters = () => {
    setConditions([]);
    setMinPrice("");
    setMaxPrice("");
    setTeam("");
    setSize("");
    setSort("newest");
  };

  const clearEverything = () => {
    setQuery("");
    setItemType("all");
    setListingType("all");
    clearPanelFilters();
  };

  const results = store.listListings({
    query: query.trim() || undefined,
    itemType,
    listingType,
    conditions: conditions.length ? conditions : undefined,
    minPrice: parsePrice(minPrice),
    maxPrice: parsePrice(maxPrice),
    team: team.trim() || undefined,
    size: size || undefined,
    sort,
  });

  const q = query.trim().toLowerCase();
  const traders =
    q.length >= 2
      ? store
          .listUsers()
          .filter(
            (u) =>
              u.username.toLowerCase().includes(q) ||
              u.displayName.toLowerCase().includes(q),
          )
          .slice(0, 6)
      : [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 md:top-14 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 md:px-6 py-3">
        <h1 className="font-display font-bold text-xl tracking-tight mb-3">
          Browse
        </h1>

        {/* Search bar + filter toggle */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-card rounded-full px-4 py-2.5 border border-border">
            <Search size={16} className="text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search teams, items, tags..."
              className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            {query && (
              <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>
                <X size={14} className="text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2.5 rounded-full border text-sm font-semibold transition-colors",
              showFilters || panelFilterCount > 0
                ? "bg-accent text-accent-foreground border-accent"
                : "bg-card border-border text-muted-foreground",
            )}
          >
            <SlidersHorizontal size={15} />
            {panelFilterCount > 0 && (
              <span className="text-xs font-bold tabular-nums">{panelFilterCount}</span>
            )}
          </button>
        </div>

        {/* Quick chips: item type then deal type */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {ITEM_TYPE_CHIPS.map((c) => (
            <Chip key={c.value} active={itemType === c.value} onClick={() => setItemType(c.value)}>
              {c.label}
            </Chip>
          ))}
          <span className="w-px h-5 bg-border" aria-hidden />
          {LISTING_TYPE_CHIPS.map((c) => (
            <Chip
              key={c.value}
              active={listingType === c.value}
              onClick={() => setListingType(c.value)}
            >
              {c.label}
            </Chip>
          ))}
        </div>
      </header>

      {/* Collapsible filter panel */}
      {showFilters && (
        <div className="bg-surface border-b border-border px-4 md:px-6 py-4 space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-4">
          {/* Condition multi-select */}
          <div className="md:col-span-2">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">
              Condition
            </p>
            <div className="flex gap-2 flex-wrap">
              {CONDITIONS.map((c) => (
                <Chip key={c} active={conditions.includes(c)} onClick={() => toggleCondition(c)}>
                  {c}
                </Chip>
              ))}
            </div>
          </div>

          {/* Price range */}
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">
              Price
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-1 bg-card border border-border rounded-lg px-2.5 py-2">
                <span className="text-xs text-muted-foreground">$</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="Min"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <span className="text-xs text-muted-foreground">to</span>
              <div className="flex-1 flex items-center gap-1 bg-card border border-border rounded-lg px-2.5 py-2">
                <span className="text-xs text-muted-foreground">$</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Max"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
          </div>

          {/* Team */}
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">
              Team
            </p>
            <input
              type="text"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              placeholder="e.g. Revolver, Truck Stop..."
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-accent"
            />
          </div>

          {/* Size */}
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">
              Size
            </p>
            <div className="flex gap-2 flex-wrap">
              {SIZES.map((s) => (
                <Chip key={s} active={size === s} onClick={() => setSize(size === s ? "" : s)}>
                  {s}
                </Chip>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <label
              htmlFor="browse-sort"
              className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2"
            >
              Sort by
            </label>
            <select
              id="browse-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as NonNullable<ListingFilter["sort"]>)}
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {panelFilterCount > 0 && (
            <button
              type="button"
              onClick={clearPanelFilters}
              className="md:col-span-2 text-left text-xs text-destructive font-semibold"
            >
              Reset filters
            </button>
          )}
        </div>
      )}

      {/* Results */}
      <div className="px-4 md:px-6 py-4">
        <Hydrated fallback={<ResultsSkeleton />}>
          {/* Traders matching the query */}
          {traders.length > 0 && (
            <div className="mb-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">
                Traders
              </p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:-mx-6 md:px-6 pb-1">
                {traders.map((u) => (
                  <Link
                    key={u.id}
                    href={`/app/u/${u.username}`}
                    className="flex-shrink-0 flex items-center gap-2.5 bg-card border border-border rounded-xl px-3 py-2 card-lift"
                  >
                    {/* plain img: avatars may be data URLs */}
                    <img
                      src={u.avatar}
                      alt={u.displayName}
                      className="w-9 h-9 rounded-full object-cover border border-border flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-tight">
                        {u.displayName}{" "}
                        <span className="text-xs text-muted-foreground font-normal">
                          @{u.username}
                        </span>
                      </p>
                      <TrustScore score={u.trustScore} trades={u.tradesCompleted} size="sm" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground mb-4">
            {results.length} listing{results.length !== 1 ? "s" : ""}
            {query.trim() ? ` for "${query.trim()}"` : ""}
          </p>

          {results.length === 0 ? (
            <div className="text-center py-14 px-6">
              <p className="font-display font-bold text-xl text-muted-foreground mb-1">
                Nothing here yet.
              </p>
              <p className="text-sm text-muted-foreground mb-5">
                {hasAnyFilter
                  ? "No listings match that combo. Loosen up the filters or put a bounty on it."
                  : "Be the first to poach it."}
              </p>
              <div className="flex flex-col items-center gap-3">
                {hasAnyFilter && (
                  <button
                    type="button"
                    onClick={clearEverything}
                    className="bg-accent text-accent-foreground px-5 py-2.5 rounded-full text-sm font-semibold shadow-sm"
                  >
                    Clear search & filters
                  </button>
                )}
                <Link href="/app/wanted" className="text-accent text-sm font-semibold">
                  Post an ISO on the Wanted Board
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {results.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </Hydrated>
      </div>
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={null}>
      <BrowseContent />
    </Suspense>
  );
}
