"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { ListingCard } from "@/components/listing-card";
import { DEMO_LISTINGS } from "@/lib/seed-data";
import type { ListingType, Condition, ItemType } from "@/lib/seed-data";
import { cn } from "@/lib/utils";

const LEVELS = ["all", "club", "college", "pro", "national", "tournament"] as const;
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const CONDITIONS: Condition[] = ["Mint", "Near Mint", "Good", "Fair", "Worn"];
const LISTING_TYPES: ListingType[] = ["trade", "sell", "trade+cash", "free"];
const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "saves", label: "Most Saved" },
  { value: "views", label: "Most Viewed" },
  { value: "price-low", label: "Price: Low" },
  { value: "price-high", label: "Price: High" },
];

export default function BrowsePage() {
  const [query, setQuery] = useState("");
  const [itemType, setItemType] = useState<"all" | ItemType>("all");
  const [level, setLevel] = useState<string>("all");
  const [selectedConditions, setSelectedConditions] = useState<Condition[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<ListingType[]>([]);
  const [sort, setSort] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);

  const toggleCondition = (c: Condition) =>
    setSelectedConditions((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  const toggleType = (t: ListingType) =>
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );

  const filtered = DEMO_LISTINGS.filter((l) => {
    if (query && !l.title.toLowerCase().includes(query.toLowerCase()) && !l.team.toLowerCase().includes(query.toLowerCase())) return false;
    if (itemType !== "all" && l.type !== itemType) return false;
    if (level !== "all" && l.level !== level) return false;
    if (selectedConditions.length && !selectedConditions.includes(l.condition)) return false;
    if (selectedTypes.length && !selectedTypes.includes(l.listingType)) return false;
    return true;
  }).sort((a, b) => {
    if (sort === "saves") return b.saves - a.saves;
    if (sort === "views") return b.views - a.views;
    if (sort === "price-low") return (a.askingPrice ?? 999) - (b.askingPrice ?? 999);
    if (sort === "price-high") return (b.askingPrice ?? 0) - (a.askingPrice ?? 0);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const activeFilterCount =
    (itemType !== "all" ? 1 : 0) +
    (level !== "all" ? 1 : 0) +
    selectedConditions.length +
    selectedTypes.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <h1 className="font-display font-800 text-xl uppercase tracking-tight mb-3">
          Browse
        </h1>
        {/* Search bar */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-surface rounded-sm px-3 py-2.5 border border-border">
            <Search size={16} className="text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search teams, items..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")}>
                <X size={14} className="text-muted-foreground" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 rounded-sm border text-sm font-semibold transition-colors",
              showFilters || activeFilterCount > 0
                ? "bg-accent text-accent-foreground border-accent"
                : "bg-surface border-border text-muted-foreground",
            )}
          >
            <SlidersHorizontal size={15} />
            {activeFilterCount > 0 && (
              <span className="text-xs font-bold">{activeFilterCount}</span>
            )}
          </button>
        </div>

        {/* Quick type filter */}
        <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide">
          {(["all", "jersey", "disc"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setItemType(t)}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 rounded-sm text-xs font-semibold uppercase tracking-wide border transition-colors",
                itemType === t
                  ? "bg-accent text-accent-foreground border-accent"
                  : "bg-transparent text-muted-foreground border-border",
              )}
            >
              {t === "all" ? "All" : t === "jersey" ? "Jerseys" : "Discs"}
            </button>
          ))}
          {LISTING_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 rounded-sm text-xs font-semibold uppercase tracking-wide border transition-colors",
                selectedTypes.includes(t)
                  ? "bg-accent text-accent-foreground border-accent"
                  : "bg-transparent text-muted-foreground border-border",
              )}
            >
              {t === "trade+cash" ? "Trade+$" : t}
            </button>
          ))}
        </div>
      </header>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-surface border-b border-border px-4 py-4">
          {/* Level */}
          <div className="mb-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">
              Level
            </p>
            <div className="flex gap-2 flex-wrap">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={cn(
                    "px-2.5 py-1 rounded-sm text-xs font-semibold uppercase tracking-wide border transition-colors",
                    level === l
                      ? "bg-accent text-accent-foreground border-accent"
                      : "text-muted-foreground border-border",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Condition */}
          <div className="mb-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">
              Condition
            </p>
            <div className="flex gap-2 flex-wrap">
              {CONDITIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => toggleCondition(c)}
                  className={cn(
                    "px-2.5 py-1 rounded-sm text-xs font-semibold uppercase tracking-wide border transition-colors",
                    selectedConditions.includes(c)
                      ? "bg-accent text-accent-foreground border-accent"
                      : "text-muted-foreground border-border",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">
              Sort by
            </p>
            <div className="flex gap-2 flex-wrap">
              {SORT_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSort(s.value)}
                  className={cn(
                    "px-2.5 py-1 rounded-sm text-xs font-semibold uppercase tracking-wide border transition-colors",
                    sort === s.value
                      ? "bg-accent text-accent-foreground border-accent"
                      : "text-muted-foreground border-border",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              setLevel("all");
              setSelectedConditions([]);
              setSelectedTypes([]);
              setSort("newest");
              setItemType("all");
            }}
            className="mt-4 text-xs text-destructive font-semibold"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Results */}
      <div className="px-4 py-4">
        <p className="text-xs text-muted-foreground mb-4">
          {filtered.length} listing{filtered.length !== 1 ? "s" : ""}
          {query ? ` for "${query}"` : ""}
        </p>
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-display font-700 text-xl uppercase text-muted-foreground mb-2">
              Nothing here yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Be the first to poach it.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
