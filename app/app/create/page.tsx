"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Plus, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Condition, ListingType, ItemType, Level, Division } from "@/lib/seed-data";

const CONDITIONS: Condition[] = ["Mint", "Near Mint", "Good", "Fair", "Worn"];
const CONDITION_DESC: Record<Condition, string> = {
  Mint: "Never worn / thrown. Perfect.",
  "Near Mint": "Worn/thrown a handful of times. Looks new.",
  Good: "Regular play wear, no damage. Clearly used.",
  Fair: "Visible wear, minor pilling or fading.",
  Worn: "Heavy use, damage or major fading.",
};

const LISTING_TYPES: { value: ListingType; label: string; desc: string }[] = [
  { value: "trade", label: "Trade", desc: "Item for item only" },
  { value: "sell", label: "For Sale", desc: "Cash only" },
  { value: "trade+cash", label: "Trade + Cash", desc: "Item + cash deal" },
  { value: "free", label: "Free", desc: "Give it a good home" },
];

const LEVELS: Level[] = ["club", "college", "pro", "national", "tournament"];
const DIVISIONS: Division[] = ["open", "women", "mixed", "masters"];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

export default function CreateListingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [itemType, setItemType] = useState<ItemType>("jersey");
  const [title, setTitle] = useState("");
  const [team, setTeam] = useState("");
  const [year, setYear] = useState("");
  const [level, setLevel] = useState<Level>("club");
  const [division, setDivision] = useState<Division>("open");
  const [size, setSize] = useState("M");
  const [condition, setCondition] = useState<Condition>("Good");
  const [listingType, setListingType] = useState<ListingType>("trade");
  const [price, setPrice] = useState("");
  const [tradeFor, setTradeFor] = useState("");
  const [description, setDescription] = useState("");
  const [shippingPref, setShippingPref] = useState<"seller-pays" | "buyer-pays" | "local-only">("seller-pays");
  const [photoCount, setPhotoCount] = useState(1);

  const totalSteps = 3;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => (step > 1 ? setStep(s => s - 1) : router.back())}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-800 text-lg uppercase tracking-tight">
            Post a Listing
          </h1>
          <p className="text-xs text-muted-foreground">Step {step} of {totalSteps}</p>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-border">
        <div
          className="h-full bg-accent transition-all duration-300"
          style={{ width: `${(step / totalSteps) * 100}%` }}
        />
      </div>

      <div className="px-4 py-6">
        {/* Step 1: Item type + photos */}
        {step === 1 && (
          <div>
            <h2 className="font-display font-800 text-2xl uppercase tracking-tight mb-1">
              What are you listing?
            </h2>
            <p className="text-sm text-muted-foreground mb-6">Add photos first — they do the selling.</p>

            {/* Item type toggle */}
            <div className="flex gap-2 mb-6">
              {(["jersey", "disc"] as ItemType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setItemType(t)}
                  className={cn(
                    "flex-1 py-3 rounded-sm font-display font-700 uppercase tracking-wide text-sm border transition-colors",
                    itemType === t
                      ? "bg-accent text-accent-foreground border-accent"
                      : "bg-surface text-muted-foreground border-border",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Photo upload */}
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">
                Photos (up to 8)
              </p>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: photoCount }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 cursor-pointer",
                      i === 0 ? "border-accent" : "border-border",
                    )}
                  >
                    <Camera size={20} className="text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      {i === 0 ? "Front" : i === 1 ? "Back" : i === 2 ? "Tag" : "Detail"}
                    </span>
                  </div>
                ))}
                {photoCount < 8 && (
                  <button
                    onClick={() => setPhotoCount((n) => Math.min(8, n + 1))}
                    className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center"
                  >
                    <Plus size={20} className="text-muted-foreground" />
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                First photo is the cover. Show front, back, tag, and any damage.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Item details */}
        {step === 2 && (
          <div>
            <h2 className="font-display font-800 text-2xl uppercase tracking-tight mb-1">
              Tell us about it
            </h2>
            <p className="text-sm text-muted-foreground mb-6">Be specific. Traders respect detail.</p>

            <div className="flex flex-col gap-5">
              {/* Title */}
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 block">
                  Listing title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={itemType === "jersey" ? "e.g. Brute Squad 2022 Game Jersey" : "e.g. 2019 WFDF Worlds Disc — Cologne"}
                  className="w-full bg-surface border border-border rounded-sm px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors"
                />
              </div>

              {/* Team */}
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 block">
                  Team / Tournament
                </label>
                <input
                  type="text"
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                  placeholder="e.g. Brute Squad, USAU Nationals"
                  className="w-full bg-surface border border-border rounded-sm px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors"
                />
              </div>

              {/* Year */}
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 block">
                  Year
                </label>
                <input
                  type="text"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="e.g. 2022"
                  className="w-full bg-surface border border-border rounded-sm px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors"
                />
              </div>

              {/* Level */}
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 block">
                  Level
                </label>
                <div className="flex gap-2 flex-wrap">
                  {LEVELS.map((l) => (
                    <button
                      key={l}
                      onClick={() => setLevel(l)}
                      className={cn(
                        "px-3 py-1.5 rounded-sm text-xs font-semibold uppercase tracking-wide border transition-colors",
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

              {/* Division (jersey only) */}
              {itemType === "jersey" && (
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 block">
                    Division
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {DIVISIONS.map((d) => (
                      <button
                        key={d}
                        onClick={() => setDivision(d)}
                        className={cn(
                          "px-3 py-1.5 rounded-sm text-xs font-semibold uppercase tracking-wide border transition-colors",
                          division === d
                            ? "bg-accent text-accent-foreground border-accent"
                            : "text-muted-foreground border-border",
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Size (jersey only) */}
              {itemType === "jersey" && (
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 block">
                    Size
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {SIZES.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSize(s)}
                        className={cn(
                          "w-12 py-2 rounded-sm text-xs font-semibold border transition-colors",
                          size === s
                            ? "bg-accent text-accent-foreground border-accent"
                            : "text-muted-foreground border-border",
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Condition */}
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 block">
                  Condition
                </label>
                <div className="flex flex-col gap-2">
                  {CONDITIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCondition(c)}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-sm border text-left transition-colors",
                        condition === c
                          ? "border-accent bg-accent-dim"
                          : "border-border bg-surface",
                      )}
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full mt-1 flex-shrink-0",
                        condition === c ? "bg-accent" : "bg-border",
                      )} />
                      <div>
                        <p className="text-sm font-semibold">{c}</p>
                        <p className="text-xs text-muted-foreground">{CONDITION_DESC[c]}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 block">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the item honestly. Any known flaws, who wore it, the story behind it."
                  rows={4}
                  className="w-full bg-surface border border-border rounded-sm px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Trade/price preferences */}
        {step === 3 && (
          <div>
            <h2 className="font-display font-800 text-2xl uppercase tracking-tight mb-1">
              How do you want to deal?
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              All listings are free. Pick how you want to transact.
            </p>

            <div className="flex flex-col gap-5">
              {/* Listing type */}
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 block">
                  Listing type
                </label>
                <div className="flex flex-col gap-2">
                  {LISTING_TYPES.map(({ value, label, desc }) => (
                    <button
                      key={value}
                      onClick={() => setListingType(value)}
                      className={cn(
                        "flex items-center gap-3 p-3.5 rounded-sm border text-left transition-colors",
                        listingType === value
                          ? "border-accent bg-accent-dim"
                          : "border-border bg-surface",
                      )}
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        listingType === value ? "bg-accent" : "bg-border",
                      )} />
                      <div>
                        <p className="text-sm font-semibold">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Price (if sell or trade+cash) */}
              {(listingType === "sell" || listingType === "trade+cash") && (
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 block">
                    {listingType === "trade+cash" ? "Cash to add" : "Asking price"}
                  </label>
                  <div className="flex items-center gap-2 bg-surface border border-border rounded-sm px-3 py-3">
                    <span className="text-muted-foreground">$</span>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0"
                      className="flex-1 bg-transparent text-sm text-foreground outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Trade for (if trade or trade+cash) */}
              {(listingType === "trade" || listingType === "trade+cash") && (
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 block">
                    What are you looking for in return?
                  </label>
                  <textarea
                    value={tradeFor}
                    onChange={(e) => setTradeFor(e.target.value)}
                    placeholder="Specific items, teams, or open to anything?"
                    rows={3}
                    className="w-full bg-surface border border-border rounded-sm px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors resize-none"
                  />
                </div>
              )}

              {/* Shipping */}
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 block">
                  Shipping preference
                </label>
                <div className="flex flex-col gap-2">
                  {[
                    { v: "seller-pays", l: "I'll cover shipping" },
                    { v: "buyer-pays", l: "Buyer pays shipping" },
                    { v: "local-only", l: "Local meetup only" },
                  ].map(({ v, l }) => (
                    <button
                      key={v}
                      onClick={() => setShippingPref(v as typeof shippingPref)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-sm border text-left text-sm transition-colors",
                        shippingPref === v
                          ? "border-accent bg-accent-dim text-foreground"
                          : "border-border bg-surface text-muted-foreground",
                      )}
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        shippingPref === v ? "bg-accent" : "bg-border",
                      )} />
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-8">
          {step < totalSteps ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="w-full bg-accent text-accent-foreground font-display font-700 uppercase tracking-wide py-4 rounded-sm"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={() => router.push("/app")}
              className="w-full bg-accent text-accent-foreground font-display font-700 uppercase tracking-wide py-4 rounded-sm"
            >
              Post Listing — It's Free
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
