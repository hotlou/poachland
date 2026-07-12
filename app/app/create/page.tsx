"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Disc3, Flame, Shirt, X } from "lucide-react";
import { toast } from "sonner";
import { PhotoPicker } from "@/components/photo-picker";
import { Switch } from "@/components/ui/switch";
import type { CreateListingInput } from "@/lib/engine";
import { useStore } from "@/lib/store-context";
import { cn } from "@/lib/utils";
import type {
  Condition,
  Division,
  ItemType,
  Level,
  ListingType,
  ShippingPreference,
} from "@/lib/types";

const CONDITIONS: Condition[] = ["Mint", "Near Mint", "Good", "Fair", "Worn"];

const CONDITION_DESC: Record<Condition, string> = {
  Mint: "Never worn / thrown. Perfect.",
  "Near Mint": "Handled a few times. Looks new.",
  Good: "Regular play wear, no damage.",
  Fair: "Visible wear, minor pilling or fading.",
  Worn: "Heavy use, damage or major fading.",
};

const LISTING_TYPES: { value: ListingType; label: string; desc: string }[] = [
  { value: "trade", label: "Trade", desc: "Item for item. The classic." },
  { value: "sell", label: "For Sale", desc: "Cash only. You set the price." },
  { value: "trade+cash", label: "Trade + Cash", desc: "Open to items, cash, or a mix." },
  { value: "free", label: "Free", desc: "Give it a good home. You pick who claims it." },
];

const LISTING_TYPE_SELECTED: Record<ListingType, string> = {
  trade: "border-accent bg-accent-dim",
  sell: "border-sky-600 bg-sky-600/10 dark:border-sky-400 dark:bg-sky-400/10",
  "trade+cash": "border-purple-600 bg-purple-600/10 dark:border-purple-400 dark:bg-purple-400/10",
  free: "border-pop bg-pop/10",
};

const LEVELS: Level[] = ["club", "college", "pro", "national", "tournament"];
const DIVISIONS: Division[] = ["open", "women", "mixed", "masters"];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

const SHIPPING_OPTIONS: { value: ShippingPreference; label: string; desc: string }[] = [
  { value: "seller-pays", label: "I'll cover shipping", desc: "Good karma. Traders remember it." },
  { value: "buyer-pays", label: "Other side pays shipping", desc: "They cover the postage." },
  { value: "local-only", label: "Local meetup only", desc: "Sideline handoff. No mail." },
];

const MAX_TAGS = 8;

const inputCls =
  "w-full bg-card border border-border rounded-lg px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors";

/** Sentence-case display for lowercase enum values ("club" → "Club"). */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Shared option-chip style: quiet at rest, accent when selected. */
const chipCls = (active: boolean) =>
  cn(
    "px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-colors",
    active
      ? "bg-accent text-accent-foreground border-accent shadow-sm"
      : "bg-card text-muted-foreground border-border hover:border-muted-foreground",
  );

function FieldLabel({
  children,
  hint,
  htmlFor,
}: {
  children: React.ReactNode;
  hint?: string;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="flex items-baseline justify-between text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2"
    >
      <span>{children}</span>
      {hint && <span className="normal-case tracking-normal font-normal">{hint}</span>}
    </label>
  );
}

function SectionHeading({ index, title, sub }: { index: string; title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <p className="text-[10px] font-display font-bold tracking-[0.2em] text-accent mb-1">
        {index}
      </p>
      <h2 className="font-display font-bold text-xl tracking-tight">{title}</h2>
      {sub && <p className="text-sm text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function ErrorHint({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-xs text-red-700 dark:text-red-400 mt-1.5">{message}</p>;
}

export default function CreateListingPage() {
  const store = useStore();
  const router = useRouter();

  const [itemType, setItemType] = useState<ItemType>("jersey");
  const [listingType, setListingType] = useState<ListingType>("trade");
  const [title, setTitle] = useState("");
  const [team, setTeam] = useState("");
  const [year, setYear] = useState("");
  const [level, setLevel] = useState<Level>("club");
  const [division, setDivision] = useState<Division | null>(null);
  const [size, setSize] = useState("M");
  const [condition, setCondition] = useState<Condition>("Good");
  const [price, setPrice] = useState("");
  const [tradeFor, setTradeFor] = useState("");
  const [description, setDescription] = useState("");
  const [shippingPref, setShippingPref] = useState<ShippingPreference>("seller-pays");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [isRare, setIsRare] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const wantsPrice = listingType === "sell" || listingType === "trade+cash";
  const wantsTradeFor = listingType === "trade" || listingType === "trade+cash";
  const priceNum = Number(price);

  // Mirrors the engine's createListing rules so nobody hits a dead-end submit.
  const errors = {
    title: title.trim() ? null : "Give it a title.",
    team: team.trim() ? null : "Team or tournament is required.",
    price:
      listingType === "sell" && !(priceNum > 0)
        ? "A sale listing needs an asking price."
        : null,
    photos: photos.length > 0 ? null : "Add at least one photo — they do the selling.",
  };
  const firstError = errors.title ?? errors.team ?? errors.price ?? errors.photos;

  const commitTag = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/,+$/, "").trim();
    if (!tag) return;
    if (tags.includes(tag)) {
      setTagDraft("");
      return;
    }
    if (tags.length >= MAX_TAGS) {
      toast.error(`Max ${MAX_TAGS} tags`);
      return;
    }
    setTags([...tags, tag]);
    setTagDraft("");
  };

  const handleSubmit = () => {
    if (submitting) return;
    if (firstError) {
      setAttempted(true);
      toast.error(firstError);
      return;
    }
    const input: CreateListingInput = {
      type: itemType,
      title,
      team,
      year: year.trim() || undefined,
      division: itemType === "jersey" && division ? division : undefined,
      level,
      size: itemType === "jersey" ? size : undefined,
      condition,
      listingType,
      askingPrice: wantsPrice && priceNum > 0 ? priceNum : undefined,
      tradeFor: wantsTradeFor && tradeFor.trim() ? tradeFor : undefined,
      photos,
      description,
      shippingPreference: shippingPref,
      tags: tagDraft.trim() ? [...tags, tagDraft] : tags,
      isRare: isRare || undefined,
    };
    setSubmitting(true);
    const res = store.createListing(input);
    if (!res.ok) {
      setSubmitting(false);
      toast.error(res.error);
      return;
    }
    toast.success("Listed. Happy hunting.");
    router.push(`/app/listings/${res.value.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 md:top-14 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="mx-auto w-full max-w-2xl flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="text-foreground hover:text-accent transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="font-display font-bold text-lg tracking-tight">
              Post a listing
            </h1>
            <p className="text-xs text-muted-foreground">No fees. Ever. That&apos;s the point.</p>
          </div>
        </div>
      </header>

      <form
        className="mx-auto w-full max-w-2xl px-4 py-6 flex flex-col gap-10"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        {/* ── 01 · The item ─────────────────────────────────────────── */}
        <section>
          <SectionHeading index="01" title="The item" sub="Be specific. Traders respect detail." />

          {/* Item type toggle */}
          <div className="flex gap-2 mb-6">
            {(
              [
                { value: "jersey" as ItemType, label: "Jersey", Icon: Shirt },
                { value: "disc" as ItemType, label: "Disc", Icon: Disc3 },
              ] as const
            ).map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setItemType(value)}
                aria-pressed={itemType === value}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1.5 py-4 rounded-xl border font-display font-bold text-sm transition-colors",
                  itemType === value
                    ? "bg-accent text-accent-foreground border-accent shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:border-muted-foreground",
                )}
              >
                <Icon size={22} strokeWidth={itemType === value ? 2.5 : 2} />
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-5">
            {/* Title */}
            <div>
              <FieldLabel htmlFor="listing-title">Listing title</FieldLabel>
              <input
                id="listing-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  itemType === "jersey"
                    ? "e.g. Brute Squad 2022 Game Jersey"
                    : "e.g. 2019 WFDF Worlds Disc — Cologne"
                }
                className={cn(
                  inputCls,
                  attempted && errors.title && "border-red-600 dark:border-red-400",
                )}
              />
              {attempted && <ErrorHint message={errors.title} />}
            </div>

            {/* Team */}
            <div>
              <FieldLabel htmlFor="listing-team">Team / Tournament</FieldLabel>
              <input
                id="listing-team"
                type="text"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                placeholder="e.g. Brute Squad, USAU Nationals"
                className={cn(
                  inputCls,
                  attempted && errors.team && "border-red-600 dark:border-red-400",
                )}
              />
              {attempted && <ErrorHint message={errors.team} />}
            </div>

            {/* Year */}
            <div>
              <FieldLabel htmlFor="listing-year" hint="optional">
                Year
              </FieldLabel>
              <input
                id="listing-year"
                type="text"
                inputMode="numeric"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g. 2022"
                className={cn(inputCls, "max-w-xs")}
              />
            </div>

            {/* Level */}
            <div>
              <FieldLabel>Level</FieldLabel>
              <div className="flex gap-2 flex-wrap">
                {LEVELS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLevel(l)}
                    aria-pressed={level === l}
                    className={chipCls(level === l)}
                  >
                    {cap(l)}
                  </button>
                ))}
              </div>
            </div>

            {/* Division (jerseys only) */}
            {itemType === "jersey" && (
              <div>
                <FieldLabel hint="optional — tap again to clear">Division</FieldLabel>
                <div className="flex gap-2 flex-wrap">
                  {DIVISIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDivision(division === d ? null : d)}
                      aria-pressed={division === d}
                      className={chipCls(division === d)}
                    >
                      {cap(d)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size (jerseys only) */}
            {itemType === "jersey" && (
              <div>
                <FieldLabel>Size</FieldLabel>
                <div className="flex gap-2 flex-wrap">
                  {SIZES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSize(s)}
                      aria-pressed={size === s}
                      className={cn(chipCls(size === s), "min-w-12 text-center")}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Condition */}
            <div>
              <FieldLabel>Condition</FieldLabel>
              <div className="flex gap-2 flex-wrap">
                {CONDITIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCondition(c)}
                    aria-pressed={condition === c}
                    className={chipCls(condition === c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">{CONDITION_DESC[condition]}</p>
            </div>
          </div>
        </section>

        {/* ── 02 · The deal ─────────────────────────────────────────── */}
        <section>
          <SectionHeading
            index="02"
            title="The deal"
            sub="Every listing is free to post. Pick how you want to transact."
          />

          {/* Listing type cards */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            {LISTING_TYPES.map(({ value, label, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => setListingType(value)}
                aria-pressed={listingType === value}
                className={cn(
                  "flex flex-col gap-1 p-3.5 rounded-xl border text-left transition-colors card-lift",
                  listingType === value
                    ? cn(LISTING_TYPE_SELECTED[value], "shadow-sm")
                    : "border-border bg-card hover:border-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "font-display font-bold text-sm",
                    listingType === value ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
                <span className="text-xs text-muted-foreground leading-snug">{desc}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-5">
            {/* Asking price (sell & trade+cash) */}
            {wantsPrice && (
              <div>
                <FieldLabel
                  htmlFor="listing-price"
                  hint={listingType === "trade+cash" ? "optional cash benchmark" : undefined}
                >
                  Asking price
                </FieldLabel>
                <div
                  className={cn(
                    "flex items-center gap-2 max-w-xs bg-card border border-border rounded-lg px-3 py-3 focus-within:border-accent transition-colors",
                    attempted && errors.price && "border-red-600 dark:border-red-400",
                  )}
                >
                  <span className="text-muted-foreground text-sm">$</span>
                  <input
                    id="listing-price"
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0"
                    className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>
                {attempted && <ErrorHint message={errors.price} />}
                {listingType === "trade+cash" && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    A rough cash value helps traders balance an item + cash offer.
                  </p>
                )}
              </div>
            )}

            {/* Trade for (trade & trade+cash) */}
            {wantsTradeFor && (
              <div>
                <FieldLabel htmlFor="listing-tradefor" hint="optional">
                  What are you hunting in return?
                </FieldLabel>
                <textarea
                  id="listing-tradefor"
                  value={tradeFor}
                  onChange={(e) => setTradeFor(e.target.value)}
                  placeholder="Specific teams, sizes, years — or open to anything?"
                  rows={3}
                  className={cn(inputCls, "resize-none")}
                />
              </div>
            )}

            {/* Shipping */}
            <div>
              <FieldLabel>Shipping preference</FieldLabel>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Shipping preference">
                {SHIPPING_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={shippingPref === value}
                    onClick={() => setShippingPref(value)}
                    className={chipCls(shippingPref === value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {SHIPPING_OPTIONS.find((o) => o.value === shippingPref)?.desc}
              </p>
            </div>
          </div>
        </section>

        {/* ── 03 · The story ────────────────────────────────────────── */}
        <section>
          <SectionHeading
            index="03"
            title="The story"
            sub="Honest detail closes deals. Flaws included."
          />

          <div className="flex flex-col gap-5">
            {/* Description */}
            <div>
              <FieldLabel htmlFor="listing-description">Description</FieldLabel>
              <textarea
                id="listing-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Who wore it, where it's been, any known flaws. The story is half the value."
                rows={4}
                className={cn(inputCls, "resize-none")}
              />
            </div>

            {/* Tags */}
            <div>
              <FieldLabel htmlFor="listing-tags" hint="comma or enter to add">
                Tags
              </FieldLabel>
              <div
                className={cn(
                  "flex flex-wrap items-center gap-1.5 bg-card border border-border rounded-lg px-3 py-2.5 focus-within:border-accent transition-colors",
                )}
              >
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 bg-surface border border-border rounded-full px-2.5 py-1 text-xs text-foreground"
                  >
                    {tag}
                    <button
                      type="button"
                      aria-label={`Remove tag ${tag}`}
                      onClick={() => setTags(tags.filter((t) => t !== tag))}
                      className="text-muted-foreground hover:text-red-700 dark:hover:text-red-400 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <input
                  id="listing-tags"
                  type="text"
                  value={tagDraft}
                  onChange={(e) => {
                    if (e.target.value.endsWith(",")) commitTag(e.target.value);
                    else setTagDraft(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitTag(tagDraft);
                    } else if (e.key === "Backspace" && !tagDraft && tags.length) {
                      setTags(tags.slice(0, -1));
                    }
                  }}
                  onBlur={() => commitTag(tagDraft)}
                  placeholder={tags.length ? "" : "e.g. nationals, gamer, throwback"}
                  className="flex-1 min-w-24 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground py-0.5"
                />
              </div>
            </div>

            {/* Rare switch */}
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-card">
              <div className="flex items-start gap-3">
                <Flame
                  size={18}
                  className={cn("mt-0.5 shrink-0", isRare ? "text-accent" : "text-muted-foreground")}
                />
                <div>
                  <p className="text-sm font-semibold">Rare find</p>
                  <p className="text-xs text-muted-foreground">
                    Limited run, retired team, one-off gamer. Flag it and it gets the stamp.
                  </p>
                </div>
              </div>
              <Switch checked={isRare} onCheckedChange={setIsRare} aria-label="Mark as rare find" />
            </div>
          </div>
        </section>

        {/* ── 04 · Photos ───────────────────────────────────────────── */}
        <section>
          <SectionHeading
            index="04"
            title="Photos"
            sub="First one is the cover. Show front, back, tag, and any damage."
          />
          <div
            className={cn(
              "rounded-xl border bg-card p-3",
              attempted && errors.photos
                ? "border-red-600 dark:border-red-400"
                : "border-border",
            )}
          >
            <PhotoPicker photos={photos} onChange={setPhotos} itemType={itemType} />
          </div>
          {attempted && <ErrorHint message={errors.photos} />}
        </section>

        {/* ── Submit ────────────────────────────────────────────────── */}
        <div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-accent text-accent-foreground text-sm font-semibold py-3 rounded-full shadow-sm hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {submitting ? "Posting…" : "Post listing — it's free"}
          </button>
          <p className="text-xs text-muted-foreground text-center mt-3 leading-relaxed">
            Hunters with a matching wanted post get pinged the moment this goes live.
            <br />
            No fees, no cut, no algorithm. Just the trade.
          </p>
        </div>
      </form>
    </div>
  );
}
