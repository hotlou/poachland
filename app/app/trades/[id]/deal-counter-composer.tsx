"use client";

import { useState } from "react";
import { ArrowRightLeft, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { OfferTermsInput } from "@/lib/engine";
import { useStore } from "@/lib/store-context";
import type { Deal, Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

function SideChecklist({
  label,
  candidates,
  selected,
  onToggle,
  cash,
  onCash,
}: {
  label: string;
  candidates: Listing[];
  selected: string[];
  onToggle: (id: string) => void;
  cash: string;
  onCash: (value: string) => void;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-display font-bold mb-2">
        {label}
      </p>
      {candidates.length === 0 ? (
        <p className="text-xs text-muted-foreground italic mb-2">No listings to offer</p>
      ) : (
        <div className="space-y-1.5 mb-2">
          {candidates.map((listing) => {
            const selectedListing = selected.includes(listing.id);
            return (
              <button
                key={listing.id}
                type="button"
                onClick={() => onToggle(listing.id)}
                className={cn(
                  "w-full flex items-center gap-2 p-1.5 rounded-md border text-left transition-colors",
                  selectedListing ? "border-accent bg-accent/10" : "border-border bg-card",
                )}
              >
                <div className="w-8 h-8 rounded overflow-hidden bg-surface flex-shrink-0">
                  <img
                    src={listing.photos[0] || "/placeholder.jpg"}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="flex-1 text-[11px] leading-tight line-clamp-2 text-foreground">
                  {listing.title}
                </span>
                <span
                  className={cn(
                    "w-4 h-4 rounded-sm border flex items-center justify-center flex-shrink-0",
                    selectedListing ? "border-accent bg-accent text-accent-foreground" : "border-border",
                  )}
                >
                  {selectedListing && <Check size={11} strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-1.5 bg-surface border border-border rounded-lg px-2 py-2">
        <span className="text-muted-foreground text-xs">$</span>
        <input
          type="number"
          min={0}
          value={cash}
          onChange={(event) => onCash(event.target.value)}
          placeholder="0"
          className="w-full bg-transparent text-xs text-foreground outline-none"
          aria-label={`${label} cash`}
        />
      </div>
    </div>
  );
}

export function CounterComposer({ deal, onDone }: { deal: Deal; onDone: () => void }) {
  const store = useStore();
  const current = deal.currentOffer;
  const [proposerSelection, setProposerSelection] = useState<string[]>(current.proposerListingIds);
  const [ownerSelection, setOwnerSelection] = useState<string[]>(current.ownerListingIds);
  const [proposerCash, setProposerCash] = useState(current.cashFromProposer > 0 ? String(current.cashFromProposer) : "");
  const [ownerCash, setOwnerCash] = useState(current.cashFromOwner > 0 ? String(current.cashFromOwner) : "");
  const [note, setNote] = useState("");

  const candidatesFor = (sellerId: string, includeIds: string[]): Listing[] => {
    const active = store.listListings({ sellerId, statuses: ["active"] });
    const byId = new Map(active.map((listing) => [listing.id, listing]));
    for (const id of includeIds) {
      if (!byId.has(id)) {
        const listing = store.getListing(id);
        if (listing) byId.set(id, listing);
      }
    }
    return [...byId.values()];
  };

  const toggle = (list: string[], set: (value: string[]) => void) => (id: string) =>
    set(list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id]);

  const submit = () => {
    const terms: OfferTermsInput = {
      proposerListingIds: proposerSelection,
      ownerListingIds: ownerSelection,
      cashFromProposer: Number(proposerCash) || 0,
      cashFromOwner: Number(ownerCash) || 0,
      note,
    };
    const result = store.counterOffer(deal.id, terms);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Counter-offer sent");
    onDone();
  };

  return (
    <div className="rounded-xl border border-accent/40 bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-bold text-sm text-foreground">Your counter</h3>
        <button type="button" onClick={onDone} aria-label="Close composer" className="text-muted-foreground">
          <X size={16} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:gap-6 mb-3">
        <SideChecklist
          label={`@${deal.proposer.username} gives`}
          candidates={candidatesFor(deal.proposerId, current.proposerListingIds)}
          selected={proposerSelection}
          onToggle={toggle(proposerSelection, setProposerSelection)}
          cash={proposerCash}
          onCash={setProposerCash}
        />
        <SideChecklist
          label={`@${deal.owner.username} gives`}
          candidates={candidatesFor(deal.ownerId, current.ownerListingIds)}
          selected={ownerSelection}
          onToggle={toggle(ownerSelection, setOwnerSelection)}
          cash={ownerCash}
          onCash={setOwnerCash}
        />
      </div>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Add a note — why this counter works for both of you"
        rows={2}
        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors resize-none mb-3"
      />
      <button
        type="button"
        onClick={submit}
        className="w-full bg-accent text-accent-foreground font-display font-semibold text-sm px-5 py-2.5 rounded-full shadow-sm flex items-center justify-center gap-2"
      >
        <ArrowRightLeft size={15} /> Send counter
      </button>
      <p className="text-[11px] text-muted-foreground text-center mt-2">
        Replaces the current offer. Expires in 7 days if no response.
      </p>
    </div>
  );
}
