"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRightLeft,
  Check,
  CheckCircle2,
  Crosshair,
  Plus,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Hydrated } from "@/components/hydrated";
import { Slider } from "@/components/ui/slider";
import { useStore } from "@/lib/store-context";
import type { Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

type StepKey = "target" | "offer" | "sweeten" | "note";

const STEP_TITLES: Record<StepKey, string> = {
  target: "Pick your target",
  offer: "What are you offering?",
  sweeten: "Sweeten the deal",
  note: "Add a note",
};

// ── Small pieces ──────────────────────────────────────────────────────────────

function FlowSkeleton() {
  return (
    <div className="px-4 py-6 space-y-4">
      <div className="h-20 bg-card border border-border rounded-lg animate-pulse" />
      <div className="h-5 w-2/3 bg-surface rounded-sm animate-pulse" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-square bg-card border border-border rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function StepDots({ steps, current }: { steps: StepKey[]; current: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {steps.map((key, i) => (
        <span
          key={key}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            i === current ? "w-6 bg-accent" : i < current ? "w-1.5 bg-accent/60" : "w-1.5 bg-border",
          )}
        />
      ))}
    </div>
  );
}

/** Compact "you're poaching this" card pinned to the top of steps 1-3. */
function TargetCard({ listing }: { listing: Listing }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
      <div className="relative w-14 h-14 rounded-md overflow-hidden bg-surface border border-border flex-shrink-0">
        {/* plain img: photos may be data URLs */}
        <img
          src={listing.photos[0] || "/placeholder.jpg"}
          alt={listing.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-display font-bold mb-0.5">
          You&rsquo;re poaching
        </p>
        <p className="text-sm font-semibold text-foreground leading-tight line-clamp-1">
          {listing.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          @{listing.seller.username} · {listing.condition}
        </p>
      </div>
      <Crosshair size={16} className="text-accent flex-shrink-0" />
    </div>
  );
}

function ItemThumbRow({ listing }: { listing: Listing }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-9 h-9 rounded overflow-hidden bg-surface border border-border flex-shrink-0">
        <img
          src={listing.photos[0] || "/placeholder.jpg"}
          alt={listing.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
      <span className="text-xs text-foreground leading-tight line-clamp-2">{listing.title}</span>
    </div>
  );
}

/** Live YOUR ITEMS ⇄ THEIR ITEM comparison. */
function TradeComparison({
  mine,
  target,
  cash,
}: {
  mine: Listing[];
  target: Listing;
  cash: number;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 grid grid-cols-[1fr_auto_1fr] items-start gap-2">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-display font-bold mb-2">
          Your items
        </p>
        <div className="space-y-1.5">
          {mine.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nothing yet</p>
          ) : (
            mine.map((l) => <ItemThumbRow key={l.id} listing={l} />)
          )}
          {cash > 0 && (
            <span className="badge-stamp text-accent border-accent inline-block">
              +${cash} cash
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-center pt-7">
        <ArrowRightLeft size={18} className="text-accent" />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-display font-bold mb-2">
          Their item
        </p>
        <ItemThumbRow listing={target} />
      </div>
    </div>
  );
}

function GuardScreen({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="px-6 py-20 text-center">
      <Crosshair size={32} className="mx-auto mb-4 text-muted-foreground" />
      <h2 className="font-display font-bold uppercase tracking-tight text-xl text-foreground mb-2">
        {title}
      </h2>
      <p className="text-sm text-muted-foreground leading-relaxed mb-6">{body}</p>
      <Link
        href={href}
        className="inline-block bg-accent text-accent-foreground font-display font-bold uppercase tracking-wide text-sm px-6 py-3 rounded-sm"
      >
        {cta}
      </Link>
    </div>
  );
}

// ── The flow ──────────────────────────────────────────────────────────────────

function NewTradeContent() {
  const store = useStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramListingId = searchParams.get("listing");

  const [pickedTargetId, setPickedTargetId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [cash, setCash] = useState(0);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState<{ dealId: string; username: string } | null>(null);

  const steps: StepKey[] = paramListingId
    ? ["offer", "sweeten", "note"]
    : ["target", "offer", "sweeten", "note"];
  const stepKey = steps[Math.min(stepIndex, steps.length - 1)];

  // Store reads (safe during SSR — rendered output is gated behind <Hydrated>).
  const me = store.requireUser();
  const targetId = paramListingId ?? pickedTargetId;
  const target = targetId ? store.getListing(targetId) : null;
  const myListings = store.listListings({ sellerId: me.id });
  const selectedListings = selectedIds
    .map((id) => store.getListing(id))
    .filter((l): l is Listing => !!l);

  const toggleSelected = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const goBack = () => {
    if (sent) return;
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
    else router.back();
  };

  const handleSend = () => {
    if (!target) return;
    const res = store.proposeTrade({
      listingId: target.id,
      offeredListingIds: selectedIds,
      cashAdded: cash,
      note,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setSent({ dealId: res.value.id, username: res.value.owner.username });
  };

  // ── Success screen ──
  if (sent) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-accent-dim border-2 border-accent flex items-center justify-center mb-6 animate-in zoom-in-50 fade-in duration-500">
          <CheckCircle2 size={40} className="text-accent" />
        </div>
        <h2 className="font-display font-bold text-3xl uppercase tracking-tight text-foreground mb-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
          Proposal sent
        </h2>
        <p className="text-sm text-foreground mb-1">
          Proposal sent to <span className="text-accent font-semibold">@{sent.username}</span>.
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed mb-8">
          It expires in 7 days if they don&rsquo;t respond. We&rsquo;ll notify you the moment
          they do.
        </p>
        <div className="w-full max-w-xs space-y-3">
          <Link
            href={`/app/trades/${sent.dealId}`}
            className="block w-full bg-accent text-accent-foreground font-display font-bold uppercase tracking-wide py-3.5 rounded-sm text-center"
          >
            Go to deal room
          </Link>
          <Link
            href="/app"
            className="block w-full text-sm text-muted-foreground py-2 text-center hover:text-foreground transition-colors"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  // ── Target guards ──
  let guard: React.ReactNode = null;
  if (targetId) {
    if (!target) {
      guard = (
        <GuardScreen
          title="Listing not found"
          body="That listing doesn't exist — it may have been removed."
          href="/app/browse"
          cta="Back to browse"
        />
      );
    } else if (target.sellerId === me.id) {
      guard = (
        <GuardScreen
          title="That one's yours"
          body="You can't poach your own listing. Find something from another collector."
          href="/app/browse"
          cta="Browse listings"
        />
      );
    } else if (target.status !== "active") {
      guard = (
        <GuardScreen
          title="Off the market"
          body="This listing is no longer active, so it can't be poached."
          href={`/app/listings/${target.id}`}
          cta="View listing"
        />
      );
    } else {
      const existing = store.activeDealForListing(target.id);
      if (existing) {
        guard = (
          <GuardScreen
            title="Deal already live"
            body="You already have an active deal on this listing. Take it to the deal room."
            href={`/app/trades/${existing.id}`}
            cta="Open deal room"
          />
        );
      }
    }
  }

  const canContinue =
    stepKey === "offer" ? selectedIds.length > 0 : true;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={goBack} aria-label="Back" className="text-foreground">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-display font-bold text-lg uppercase tracking-tight text-foreground flex-1">
            {STEP_TITLES[stepKey]}
          </h1>
          <StepDots steps={steps} current={stepIndex} />
        </div>
      </header>

      <Hydrated fallback={<FlowSkeleton />}>
        {guard ?? (
          <div className="px-4 py-5 space-y-5">
            {target && stepKey !== "target" && <TargetCard listing={target} />}

            {/* ── Step: pick a target ── */}
            {stepKey === "target" && (
              <TargetPicker
                pickedId={pickedTargetId}
                onPick={(id) => {
                  setPickedTargetId(id);
                  setStepIndex(stepIndex + 1);
                }}
              />
            )}

            {/* ── Step: what are you offering ── */}
            {stepKey === "offer" && (
              <div>
                {myListings.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">
                      Nothing in your locker to offer.
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      Post a listing first, then come back for the poach.
                    </p>
                    <Link
                      href="/app/create"
                      className="inline-flex items-center gap-1.5 text-accent text-sm font-semibold"
                    >
                      <Plus size={14} /> Post a listing
                    </Link>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground mb-3">
                      Pick one or more of your active listings to put on the table.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {myListings.map((listing) => {
                        const selected = selectedIds.includes(listing.id);
                        return (
                          <button
                            key={listing.id}
                            type="button"
                            onClick={() => toggleSelected(listing.id)}
                            className={cn(
                              "relative text-left bg-card rounded-lg overflow-hidden border transition-colors",
                              selected ? "border-accent" : "border-border",
                            )}
                          >
                            <div className="relative aspect-square bg-surface">
                              <img
                                src={listing.photos[0] || "/placeholder.jpg"}
                                alt={listing.title}
                                className="absolute inset-0 w-full h-full object-cover"
                              />
                              {selected && (
                                <div className="absolute inset-0 bg-accent/25 flex items-center justify-center">
                                  <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center animate-in zoom-in-75 duration-200">
                                    <Check size={20} className="text-accent-foreground" strokeWidth={3} />
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="p-2.5">
                              <p className="text-xs font-semibold text-foreground line-clamp-1">
                                {listing.title}
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {listing.condition} · {listing.type}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {selectedIds.length > 0 && (
                      <p className="text-xs text-accent font-semibold mt-3">
                        {selectedIds.length} item{selectedIds.length > 1 ? "s" : ""} on the table
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={!canContinue}
                      onClick={() => setStepIndex(stepIndex + 1)}
                      className="mt-5 w-full bg-accent text-accent-foreground font-display font-bold uppercase tracking-wide py-3.5 rounded-sm disabled:opacity-40 transition-opacity"
                    >
                      Continue
                    </button>
                  </>
                )}
              </div>
            )}

            {/* ── Step: sweeten the deal ── */}
            {stepKey === "sweeten" && target && (
              <div className="space-y-5">
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground font-display font-bold mb-3 block">
                    Add cash to sweeten it (optional)
                  </label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[Math.min(cash, 100)]}
                      onValueChange={(v) => setCash(v[0] ?? 0)}
                      min={0}
                      max={100}
                      step={5}
                      className="flex-1"
                    />
                    <div className="flex items-center gap-1 bg-surface border border-border rounded-sm px-2.5 py-2 w-24 flex-shrink-0">
                      <span className="text-muted-foreground text-sm">$</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={cash === 0 ? "" : String(cash)}
                        placeholder="0"
                        onChange={(e) => {
                          const n = Math.round(Number(e.target.value));
                          setCash(Number.isFinite(n) ? Math.min(999, Math.max(0, n)) : 0);
                        }}
                        className="w-full bg-transparent text-sm text-foreground outline-none"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Slide up to $100, or type any amount.
                  </p>
                </div>

                <TradeComparison mine={selectedListings} target={target} cash={cash} />

                <button
                  type="button"
                  onClick={() => setStepIndex(stepIndex + 1)}
                  className="w-full bg-accent text-accent-foreground font-display font-bold uppercase tracking-wide py-3.5 rounded-sm"
                >
                  Continue
                </button>
              </div>
            )}

            {/* ── Step: note + preview + send ── */}
            {stepKey === "note" && target && (
              <div className="space-y-5">
                <div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Make it real. A good first message goes a long way.
                  </p>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 500))}
                    placeholder={`e.g. That ${target.team} piece is exactly what I've been hunting. Offering ${
                      selectedListings[0] ? `my ${selectedListings[0].title}` : "my item"
                    } — let me know what you think.`}
                    rows={5}
                    className="w-full bg-surface border border-border rounded-sm px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors resize-none"
                  />
                  <p
                    className={cn(
                      "text-[11px] text-right mt-1",
                      note.length >= 500 ? "text-red-400" : "text-muted-foreground",
                    )}
                  >
                    {note.length}/500
                  </p>
                </div>

                <div>
                  <h3 className="font-display font-bold uppercase tracking-tight text-sm text-foreground mb-2">
                    Your proposal
                  </h3>
                  <TradeComparison mine={selectedListings} target={target} cash={cash} />
                  {note.trim() && (
                    <div className="bg-surface border border-border rounded-lg p-3 mt-3">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-display font-bold mb-1">
                        Your note
                      </p>
                      <p className="text-sm text-foreground leading-relaxed">{note}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-3">
                    Expires in 7 days if @{target.seller.username} doesn&rsquo;t respond. You
                    can talk it out in the deal thread.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSend}
                  className="w-full bg-accent text-accent-foreground font-display font-bold uppercase tracking-wide py-3.5 rounded-sm flex items-center justify-center gap-2"
                >
                  <Send size={16} /> Send proposal
                </button>
              </div>
            )}
          </div>
        )}
      </Hydrated>
    </div>
  );
}

/** Step 0 grid: pick a listing from other collectors to open a trade on. */
function TargetPicker({
  pickedId,
  onPick,
}: {
  pickedId: string | null;
  onPick: (id: string) => void;
}) {
  const store = useStore();
  const candidates = store
    .listListings({ includeOwn: false })
    .filter((l) => !store.activeDealForListing(l.id));

  if (candidates.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-border rounded-lg">
        <p className="text-sm text-muted-foreground mb-4">
          Nothing to poach right now. Check back soon.
        </p>
        <Link href="/app/browse" className="text-accent text-sm font-semibold">
          Browse the market
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">
        Whose gear are you after? Pick a listing to open a trade on.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {candidates.map((listing) => (
          <button
            key={listing.id}
            type="button"
            onClick={() => onPick(listing.id)}
            className={cn(
              "text-left bg-card rounded-lg overflow-hidden border card-lift transition-colors",
              pickedId === listing.id ? "border-accent" : "border-border",
            )}
          >
            <div className="relative aspect-[4/3] bg-surface">
              <img
                src={listing.photos[0] || "/placeholder.jpg"}
                alt={listing.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
            <div className="p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {listing.team}
              </p>
              <p className="text-xs font-semibold text-foreground line-clamp-1">
                {listing.title}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                @{listing.seller.username}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function NewTradePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background">
          <FlowSkeleton />
        </div>
      }
    >
      <NewTradeContent />
    </Suspense>
  );
}
