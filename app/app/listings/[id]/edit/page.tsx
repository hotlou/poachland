"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, SearchX } from "lucide-react";
import { toast } from "sonner";

import { Hydrated } from "@/components/hydrated";
import { PhotoPicker } from "@/components/photo-picker";
import { Switch } from "@/components/ui/switch";
import type { CreateListingInput } from "@/lib/engine";
import { useStore } from "@/lib/store-context";
import type {
  Condition,
  Division,
  Level,
  Listing,
  ListingType,
  ShippingPreference,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const CONDITIONS: Condition[] = ["Mint", "Near Mint", "Good", "Fair", "Worn"];
const LEVELS: Level[] = ["club", "college", "pro", "national", "tournament"];
const DIVISIONS: Division[] = ["open", "women", "mixed", "masters"];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

const LISTING_TYPES: { value: ListingType; label: string; desc: string }[] = [
  { value: "trade", label: "Trade", desc: "Item for item only" },
  { value: "sell", label: "For Sale", desc: "Cash only" },
  { value: "trade+cash", label: "Trade + Cash", desc: "Item + cash deal" },
  { value: "free", label: "Free", desc: "Give it a good home" },
];

const SHIPPING_OPTIONS: { value: ShippingPreference; label: string }[] = [
  { value: "seller-pays", label: "I'll cover shipping" },
  { value: "buyer-pays", label: "Buyer pays shipping" },
  { value: "local-only", label: "Local meetup only" },
];

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Hydrated fallback={<EditSkeleton />}>
      <EditGate id={id} />
    </Hydrated>
  );
}

function EditSkeleton() {
  return (
    <div className="animate-pulse px-4 pt-4 space-y-4">
      <div className="h-6 w-40 bg-surface rounded-sm" />
      <div className="h-20 w-full bg-surface rounded-lg" />
      <div className="h-12 w-full bg-surface rounded-sm" />
      <div className="h-12 w-full bg-surface rounded-sm" />
      <div className="h-32 w-full bg-surface rounded-sm" />
    </div>
  );
}

/** Owner-only guard: everyone else is bounced back to the listing. */
function EditGate({ id }: { id: string }) {
  const store = useStore();
  const router = useRouter();
  const me = store.requireUser();
  const listing = store.getListing(id);
  const isOwner = !!listing && listing.sellerId === me.id;

  useEffect(() => {
    if (listing && !isOwner) {
      router.replace(`/app/listings/${id}`);
    }
  }, [listing, isOwner, router, id]);

  if (!listing) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-8 text-center">
        <SearchX size={40} className="text-muted-foreground mb-4" strokeWidth={1.5} />
        <h1 className="font-display font-bold text-xl uppercase tracking-tight mb-1">
          Listing not found
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Nothing to edit here.
        </p>
        <Link
          href="/app/browse"
          className="px-4 py-2.5 rounded-sm bg-accent text-accent-foreground font-display font-bold uppercase tracking-wide text-sm"
        >
          Browse the rack
        </Link>
      </div>
    );
  }

  if (!isOwner) return null; // redirecting

  return <EditForm listing={listing} />;
}

function EditForm({ listing }: { listing: Listing }) {
  const store = useStore();
  const router = useRouter();

  const [photos, setPhotos] = useState<string[]>(listing.photos);
  const [title, setTitle] = useState(listing.title);
  const [team, setTeam] = useState(listing.team);
  const [year, setYear] = useState(listing.year ?? "");
  const [level, setLevel] = useState<Level>(listing.level);
  const [division, setDivision] = useState<Division | undefined>(listing.division);
  const [size, setSize] = useState(listing.size ?? "");
  const [condition, setCondition] = useState<Condition>(listing.condition);
  const [listingType, setListingType] = useState<ListingType>(listing.listingType);
  const [price, setPrice] = useState(
    listing.askingPrice !== undefined ? String(listing.askingPrice) : "",
  );
  const [tradeFor, setTradeFor] = useState(listing.tradeFor ?? "");
  const [description, setDescription] = useState(listing.description);
  const [shippingPreference, setShippingPreference] = useState<ShippingPreference>(
    listing.shippingPreference,
  );
  const [tags, setTags] = useState(listing.tags.join(", "));
  const [isRare, setIsRare] = useState(!!listing.isRare);
  const [saving, setSaving] = useState(false);

  const isActive = listing.status === "active";
  const needsPrice = listingType === "sell" || listingType === "trade+cash";
  const wantsTrade = listingType === "trade" || listingType === "trade+cash";

  const save = () => {
    if (saving) return;
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!team.trim()) {
      toast.error("Team is required");
      return;
    }
    if (photos.length === 0) {
      toast.error("Keep at least one photo");
      return;
    }
    const parsedPrice = price.trim() ? Number(price) : undefined;
    if (needsPrice && listingType === "sell" && (!parsedPrice || parsedPrice <= 0)) {
      toast.error("Set an asking price for a sale listing");
      return;
    }
    if (parsedPrice !== undefined && (Number.isNaN(parsedPrice) || parsedPrice < 0)) {
      toast.error("That price doesn't parse");
      return;
    }

    const patch: Partial<CreateListingInput> = {
      title: title.trim(),
      team: team.trim(),
      year: year.trim() || undefined,
      level,
      division,
      size: size.trim() || undefined,
      condition,
      listingType,
      askingPrice: needsPrice ? parsedPrice : undefined,
      tradeFor: wantsTrade ? tradeFor.trim() || undefined : undefined,
      photos,
      description: description.trim(),
      shippingPreference,
      tags: tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      isRare,
    };

    setSaving(true);
    const res = store.updateListing(listing.id, patch);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Listing updated.");
    router.push(`/app/listings/${listing.id}`);
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <button type="button" aria-label="Go back" onClick={() => router.back()}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-bold text-lg uppercase tracking-tight">
            Edit Listing
          </h1>
          <p className="text-xs text-muted-foreground truncate">{listing.title}</p>
        </div>
      </header>

      {!isActive && (
        <div className="mx-4 mt-4 p-3 rounded-lg border border-yellow-400/40 bg-yellow-400/10 text-sm text-yellow-400">
          Only active listings can be edited — this one is{" "}
          {listing.status === "pending" ? "locked in a deal" : listing.status}.
        </div>
      )}

      <div className="px-4 py-6 flex flex-col gap-6">
        {/* Photos */}
        <section>
          <FieldLabel>Photos</FieldLabel>
          <PhotoPicker photos={photos} onChange={setPhotos} itemType={listing.type} />
        </section>

        {/* Title */}
        <section>
          <FieldLabel>Listing title</FieldLabel>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              listing.type === "jersey"
                ? "e.g. Brute Squad 2022 Game Jersey"
                : "e.g. 2019 WFDF Worlds Disc — Cologne"
            }
            className={inputClass}
          />
        </section>

        {/* Team */}
        <section>
          <FieldLabel>Team / Tournament</FieldLabel>
          <input
            type="text"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            placeholder="e.g. Brute Squad, USAU Nationals"
            className={inputClass}
          />
        </section>

        {/* Year */}
        <section>
          <FieldLabel>Year</FieldLabel>
          <input
            type="text"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="e.g. 2022"
            className={inputClass}
          />
        </section>

        {/* Level */}
        <section>
          <FieldLabel>Level</FieldLabel>
          <div className="flex gap-2 flex-wrap">
            {LEVELS.map((l) => (
              <Chip key={l} selected={level === l} onClick={() => setLevel(l)}>
                {l}
              </Chip>
            ))}
          </div>
        </section>

        {/* Division (jerseys) */}
        {listing.type === "jersey" && (
          <section>
            <FieldLabel>Division</FieldLabel>
            <div className="flex gap-2 flex-wrap">
              {DIVISIONS.map((d) => (
                <Chip
                  key={d}
                  selected={division === d}
                  onClick={() => setDivision(division === d ? undefined : d)}
                >
                  {d}
                </Chip>
              ))}
            </div>
          </section>
        )}

        {/* Size (jerseys) */}
        {listing.type === "jersey" && (
          <section>
            <FieldLabel>Size</FieldLabel>
            <div className="flex gap-2 flex-wrap">
              {SIZES.map((s) => (
                <Chip
                  key={s}
                  selected={size === s}
                  onClick={() => setSize(size === s ? "" : s)}
                  className="w-12 justify-center"
                >
                  {s}
                </Chip>
              ))}
            </div>
          </section>
        )}

        {/* Condition */}
        <section>
          <FieldLabel>Condition</FieldLabel>
          <div className="flex gap-2 flex-wrap">
            {CONDITIONS.map((c) => (
              <Chip key={c} selected={condition === c} onClick={() => setCondition(c)}>
                {c}
              </Chip>
            ))}
          </div>
        </section>

        {/* Listing type */}
        <section>
          <FieldLabel>Listing type</FieldLabel>
          <div className="flex flex-col gap-2">
            {LISTING_TYPES.map(({ value, label, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => setListingType(value)}
                className={cn(
                  "flex items-center gap-3 p-3.5 rounded-sm border text-left transition-colors",
                  listingType === value
                    ? "border-accent bg-accent-dim"
                    : "border-border bg-surface",
                )}
              >
                <span
                  className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
                    listingType === value ? "bg-accent" : "bg-border",
                  )}
                />
                <span>
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="block text-xs text-muted-foreground">{desc}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Price */}
        {needsPrice && (
          <section>
            <FieldLabel>
              {listingType === "trade+cash" ? "Cash value (optional)" : "Asking price"}
            </FieldLabel>
            <div className="flex items-center gap-2 bg-surface border border-border rounded-sm px-3 py-3 focus-within:border-accent transition-colors">
              <span className="text-muted-foreground">$</span>
              <input
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                className="flex-1 bg-transparent text-sm text-foreground outline-none"
              />
            </div>
          </section>
        )}

        {/* Trade for */}
        {wantsTrade && (
          <section>
            <FieldLabel>What are you looking for in return?</FieldLabel>
            <textarea
              value={tradeFor}
              onChange={(e) => setTradeFor(e.target.value)}
              placeholder="Specific items, teams, or open to anything?"
              rows={3}
              className={cn(inputClass, "resize-none")}
            />
          </section>
        )}

        {/* Description */}
        <section>
          <FieldLabel>Description</FieldLabel>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the item honestly. Any known flaws, who wore it, the story behind it."
            rows={4}
            className={cn(inputClass, "resize-none")}
          />
        </section>

        {/* Shipping */}
        <section>
          <FieldLabel>Shipping preference</FieldLabel>
          <div className="flex flex-col gap-2">
            {SHIPPING_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setShippingPreference(value)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-sm border text-left text-sm transition-colors",
                  shippingPreference === value
                    ? "border-accent bg-accent-dim text-foreground"
                    : "border-border bg-surface text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
                    shippingPreference === value ? "bg-accent" : "bg-border",
                  )}
                />
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Tags */}
        <section>
          <FieldLabel>Tags</FieldLabel>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="comma, separated, tags"
            className={inputClass}
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Comma-separated. Helps hunters find it.
          </p>
        </section>

        {/* Rare */}
        <section className="flex items-center justify-between p-3.5 rounded-sm border border-border bg-surface">
          <div>
            <p className="text-sm font-semibold">Rare item</p>
            <p className="text-xs text-muted-foreground">
              Limited run, game-worn, or otherwise hard to find.
            </p>
          </div>
          <Switch checked={isRare} onCheckedChange={setIsRare} aria-label="Rare item" />
        </section>

        {/* Save */}
        <div className="flex flex-col gap-2 mt-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full bg-accent text-accent-foreground font-display font-bold uppercase tracking-wide py-4 rounded-sm disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <Link
            href={`/app/listings/${listing.id}`}
            className="w-full text-center py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Discard and go back
          </Link>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full bg-surface border border-border rounded-sm px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 block">
      {children}
    </label>
  );
}

function Chip({
  children,
  selected,
  onClick,
  className,
}: {
  children: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-sm text-xs font-semibold uppercase tracking-wide border transition-colors inline-flex items-center",
        selected
          ? "bg-accent text-accent-foreground border-accent"
          : "text-muted-foreground border-border hover:border-muted-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}
