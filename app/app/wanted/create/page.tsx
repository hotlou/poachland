"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ItemType } from "@/lib/seed-data";

export default function CreateISOPage() {
  const router = useRouter();
  const [itemType, setItemType] = useState<ItemType>("jersey");
  const [description, setDescription] = useState("");
  const [team, setTeam] = useState("");
  const [size, setSize] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display font-800 text-lg uppercase tracking-tight">
          Post Wanted / ISO
        </h1>
      </header>

      <div className="px-4 py-6">
        <h2 className="font-display font-800 text-2xl uppercase tracking-tight mb-1">
          What are you hunting?
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Post what you're looking for. Get notified when a match drops.
        </p>

        <div className="flex flex-col gap-5">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 block">
              Item type
            </label>
            <div className="flex gap-2">
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
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 block">
              Describe what you're looking for
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Be specific — team, year, condition, what you'd offer in return."
              rows={4}
              className="w-full bg-surface border border-border rounded-sm px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors resize-none"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 block">
              Team / Tournament (optional)
            </label>
            <input
              type="text"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              placeholder="e.g. Brute Squad, WFDF Worlds"
              className="w-full bg-surface border border-border rounded-sm px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors"
            />
          </div>

          {itemType === "jersey" && (
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 block">
                Size (optional)
              </label>
              <div className="flex gap-2">
                {["XS", "S", "M", "L", "XL", "XXL"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSize(s === size ? "" : s)}
                    className={cn(
                      "flex-1 py-2 rounded-sm text-xs font-semibold border transition-colors",
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

          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 block">
              Max price willing to pay (optional)
            </label>
            <div className="flex items-center gap-2 bg-surface border border-border rounded-sm px-3 py-3">
              <span className="text-muted-foreground">$</span>
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Leave blank if trade only"
                className="flex-1 bg-transparent text-sm text-foreground outline-none"
              />
            </div>
          </div>
        </div>

        <button
          onClick={() => router.push("/app/wanted")}
          className="w-full mt-8 bg-accent text-accent-foreground font-display font-700 uppercase tracking-wide py-4 rounded-sm"
        >
          Pin It to the Board
        </button>
      </div>
    </div>
  );
}
