"use client";

import { useState } from "react";
import Link from "next/link";
import { Star, Trophy } from "lucide-react";
import { toast } from "sonner";
import { StarRatingInput } from "@/components/star-rating-input";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store-context";
import type { Deal, User } from "@/lib/types";

export function RateBlock({ deal, other }: { deal: Deal; other: User }) {
  const store = useStore();
  const [communication, setCommunication] = useState(5);
  const [shippingSpeed, setShippingSpeed] = useState(5);
  const [itemAccuracy, setItemAccuracy] = useState(5);
  const [wouldTradeAgain, setWouldTradeAgain] = useState(true);
  const [comment, setComment] = useState("");

  const submit = () => {
    const result = store.rateDeal(deal.id, {
      communication,
      shippingSpeed,
      itemAccuracy,
      wouldTradeAgain,
      comment,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Rep updated.");
  };

  return (
    <div className="rounded-xl border border-accent/40 bg-card p-4">
      <h3 className="font-display font-bold text-sm text-foreground mb-1">Rate @{other.username}</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Ratings build the trust that keeps Poachland fee-free.
      </p>
      <div className="space-y-3 mb-4">
        <StarRatingInput label="Communication" value={communication} onChange={setCommunication} size={20} />
        <StarRatingInput label="Shipping speed" value={shippingSpeed} onChange={setShippingSpeed} size={20} />
        <StarRatingInput label="Item accuracy" value={itemAccuracy} onChange={setItemAccuracy} size={20} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-foreground">Would trade again?</span>
          <Switch checked={wouldTradeAgain} onCheckedChange={setWouldTradeAgain} />
        </div>
      </div>
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        maxLength={500}
        placeholder="Optional — a line about how it went"
        rows={2}
        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors resize-none mb-3"
      />
      <button
        type="button"
        onClick={submit}
        className="w-full bg-accent text-accent-foreground font-display font-semibold text-sm px-5 py-2.5 rounded-full shadow-sm flex items-center justify-center gap-2"
      >
        <Star size={15} /> Submit rating
      </button>
    </div>
  );
}

export function ShareToHaul({ deal }: { deal: Deal }) {
  const store = useStore();
  const existing = store.haulForDeal(deal.id);

  if (existing && !existing.hidden) {
    return (
      <div className="rounded-full border border-border bg-card px-4 py-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Trophy size={14} className="text-accent" />
        <span className="font-semibold text-foreground">On the Haul</span>
        <Link href="/app/haul" className="text-accent font-semibold">View →</Link>
      </div>
    );
  }

  const share = () => {
    const result = store.shareHaul({ dealId: deal.id });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Shared to the Haul 🏆");
  };

  return (
    <div>
      <button
        type="button"
        onClick={share}
        className="w-full border border-accent/50 bg-card text-accent font-display font-semibold text-sm px-5 py-2.5 rounded-full flex items-center justify-center gap-2 hover:bg-accent/10 transition-colors"
      >
        <Trophy size={15} /> {existing?.hidden ? "Re-share to the Haul" : "Show off this trade"}
      </button>
      <p className="text-[11px] text-muted-foreground text-center mt-1.5">
        Celebrate the swap — your trade partner can hide it anytime.
      </p>
    </div>
  );
}
