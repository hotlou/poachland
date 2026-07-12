"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Radar } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store-context";
import { cn } from "@/lib/utils";
import type { ItemType } from "@/lib/types";

const MIN_DESCRIPTION = 10;
const JERSEY_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

export default function CreateISOPage() {
  const store = useStore();
  const router = useRouter();
  const [itemType, setItemType] = useState<ItemType>("jersey");
  const [description, setDescription] = useState("");
  const [team, setTeam] = useState("");
  const [size, setSize] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const descLength = description.trim().length;
  const descValid = descLength >= MIN_DESCRIPTION;

  const submit = () => {
    if (submitting) return;
    if (!descValid) {
      toast.error(
        `Describe what you're hunting (at least ${MIN_DESCRIPTION} characters)`,
      );
      return;
    }
    let price: number | undefined;
    if (maxPrice.trim()) {
      const n = Number(maxPrice);
      if (!Number.isFinite(n) || n <= 0) {
        toast.error("Max price needs to be a positive number");
        return;
      }
      price = Math.round(n);
    }
    setSubmitting(true);
    const res = store.createISOPost({
      itemType,
      description: description.trim(),
      team: team.trim() || undefined,
      size: itemType === "jersey" && size ? size : undefined,
      maxPrice: price,
    });
    if (!res.ok) {
      setSubmitting(false);
      toast.error(res.error);
      return;
    }
    toast.success("Posted. The board is watching.");
    router.push("/app/wanted");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 md:top-14 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 md:px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Back"
            className="text-foreground hover:text-accent transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-display font-bold text-lg tracking-tight">
            Post wanted / ISO
          </h1>
        </div>
      </header>

      <div className="px-4 md:px-6 py-6 max-w-2xl mx-auto">
        <h2 className="font-display font-bold text-2xl tracking-tight mb-1">
          What are you hunting?
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Pin it to the board. You&apos;ll get pinged the moment a matching
          listing drops.
        </p>

        <div className="flex flex-col gap-5">
          {/* Item type */}
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 block">
              Item type
            </label>
            <div className="flex flex-wrap gap-2">
              {(["jersey", "disc"] as ItemType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setItemType(t);
                    if (t === "disc") setSize("");
                  }}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full capitalize text-[13px] font-medium border transition-colors",
                    itemType === t
                      ? "bg-accent text-accent-foreground border-accent shadow-sm"
                      : "bg-card text-muted-foreground border-border hover:text-foreground",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label
                htmlFor="iso-description"
                className="text-xs uppercase tracking-widest text-muted-foreground font-semibold"
              >
                Describe what you&apos;re looking for
              </label>
              <span
                className={cn(
                  "text-[11px] tabular-nums",
                  descValid ? "text-accent" : "text-muted-foreground",
                )}
              >
                {descLength}/{MIN_DESCRIPTION} min
              </span>
            </div>
            <textarea
              id="iso-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Be specific — team, year, condition, what you'd offer in return."
              rows={4}
              className="w-full bg-card border border-border rounded-xl px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors resize-none"
            />
          </div>

          {/* Team */}
          <div>
            <label
              htmlFor="iso-team"
              className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 block"
            >
              Team / Tournament (optional)
            </label>
            <input
              id="iso-team"
              type="text"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              placeholder="e.g. Brute Squad, WFDF Worlds"
              className="w-full bg-card border border-border rounded-xl px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Naming a team sharpens the match alerts.
            </p>
          </div>

          {/* Size (jerseys only) */}
          {itemType === "jersey" && (
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 block">
                Size (optional)
              </label>
              <div className="flex flex-wrap gap-2">
                {JERSEY_SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(s === size ? "" : s)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-colors",
                      size === s
                        ? "bg-accent text-accent-foreground border-accent shadow-sm"
                        : "bg-card text-muted-foreground border-border hover:text-foreground",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Max price */}
          <div>
            <label
              htmlFor="iso-max-price"
              className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 block"
            >
              Max price willing to pay (optional)
            </label>
            <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-3 focus-within:border-accent transition-colors">
              <span className="text-muted-foreground">$</span>
              <input
                id="iso-max-price"
                type="number"
                min={1}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Leave blank if trade only"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!descValid || submitting}
          className="w-full mt-8 bg-accent text-accent-foreground text-sm font-semibold py-3 rounded-full shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {submitting ? "Pinning…" : "Pin it to the board"}
        </button>

        <p className="flex items-start gap-2 text-[11px] text-muted-foreground mt-4 leading-relaxed">
          <Radar size={13} className="shrink-0 mt-0.5 text-accent" />
          <span>
            If something on the{" "}
            <Link href="/app/browse" className="text-accent underline-offset-2 hover:underline">
              market
            </Link>{" "}
            already matches, you&apos;ll hear about it the second you post.
          </span>
        </p>
      </div>
    </div>
  );
}
