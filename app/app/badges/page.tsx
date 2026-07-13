"use client";

import { Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store-context";
import { Hydrated } from "@/components/hydrated";
import { BADGE_CATALOG, type BadgeCategory } from "@/lib/badges";
import { BADGE_TIER_STYLE } from "@/components/trust-badge";

const CATEGORY_LABEL: Record<BadgeCategory, string> = {
  founder: "Founder",
  trading: "Trading milestones",
  trust: "Trust & quality",
  collecting: "Collecting",
  generosity: "Generosity",
  community: "Community",
  identity: "Identity",
};

const CATEGORY_ORDER: BadgeCategory[] = [
  "founder",
  "trading",
  "trust",
  "collecting",
  "generosity",
  "community",
  "identity",
];

function Showcase() {
  const store = useStore();
  const me = store.requireUser();
  const earned = new Set(me.badges.map((b) => b.type));
  const total = BADGE_CATALOG.length;

  return (
    <div className="px-4 md:px-6 pb-8">
      <div className="mt-4 mb-6 rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
          <Award size={24} />
        </div>
        <div className="min-w-0">
          <p className="font-display font-bold text-lg tracking-tight">
            {earned.size} of {total} badges
          </p>
          <p className="text-xs text-muted-foreground">
            Earn them by trading, giving gear away, and showing off clean deals.
          </p>
        </div>
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const defs = BADGE_CATALOG.filter((b) => b.category === cat);
        if (defs.length === 0) return null;
        return (
          <section key={cat} className="mb-7">
            <h2 className="font-display font-bold text-sm tracking-tight mb-3 text-muted-foreground uppercase tracking-widest">
              {CATEGORY_LABEL[cat]}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {defs.map((def) => {
                const has = earned.has(def.type);
                return (
                  <div
                    key={def.type}
                    className={cn(
                      "rounded-xl border p-3.5 flex flex-col items-center text-center gap-1.5",
                      has ? "bg-card border-border card-lift" : "bg-surface/40 border-dashed border-border",
                    )}
                  >
                    <span
                      className={cn(
                        "w-11 h-11 rounded-full flex items-center justify-center text-xl border",
                        has ? BADGE_TIER_STYLE[def.tier] : "border-border grayscale opacity-40",
                      )}
                    >
                      {def.emoji}
                    </span>
                    <p
                      className={cn(
                        "font-display font-bold text-[13px] tracking-tight leading-tight mt-0.5",
                        !has && "text-muted-foreground",
                      )}
                    >
                      {def.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      {def.description}
                    </p>
                    {has ? (
                      <span className="badge-stamp text-accent border-accent mt-1">Earned</span>
                    ) : (
                      <span className="badge-stamp text-muted-foreground border-border mt-1">Locked</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function BadgesPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="md:hidden sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-2">
        <Award size={20} className="text-accent" strokeWidth={2.5} />
        <h1 className="font-display font-bold text-xl tracking-tight">Badges</h1>
      </header>
      <p className="px-4 md:px-6 mt-4 text-sm text-muted-foreground">
        Every badge you can earn on Poachland — and how.
      </p>
      <Hydrated
        fallback={
          <div className="px-4 md:px-6 mt-6 grid grid-cols-2 md:grid-cols-3 gap-3 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 bg-surface rounded-xl" />
            ))}
          </div>
        }
      >
        <Showcase />
      </Hydrated>
    </div>
  );
}
