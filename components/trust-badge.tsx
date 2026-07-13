import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Badge } from "@/lib/types";
import { BADGE_BY_TYPE, type BadgeTier } from "@/lib/badges";

export const BADGE_TIER_STYLE: Record<BadgeTier, string> = {
  special: "text-accent border-accent bg-accent/10",
  gold: "text-amber-700 border-amber-500 bg-amber-500/10 dark:text-yellow-300 dark:border-yellow-400/50 dark:bg-yellow-400/10",
  silver: "text-slate-600 border-slate-400 bg-slate-400/10 dark:text-slate-300 dark:border-slate-500/60 dark:bg-slate-400/10",
  bronze: "text-orange-800 border-orange-500/70 bg-orange-500/10 dark:text-orange-300 dark:border-orange-400/50 dark:bg-orange-400/10",
};

interface TrustBadgeProps {
  badge: Badge;
  size?: "sm" | "md";
}

export function TrustBadge({ badge, size = "sm" }: TrustBadgeProps) {
  const def = BADGE_BY_TYPE[badge.type];
  if (!def) return null;

  return (
    <span
      title={def.description}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border font-display font-bold uppercase tracking-wider",
        BADGE_TIER_STYLE[def.tier],
        size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1",
      )}
    >
      <span aria-hidden className={size === "sm" ? "text-[11px] leading-none" : "text-sm leading-none"}>
        {def.emoji}
      </span>
      {def.label}
    </span>
  );
}

interface TrustScoreProps {
  score: number;
  trades: number;
  size?: "sm" | "md" | "lg";
}

export function TrustScore({ score, trades, size = "md" }: TrustScoreProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            size={size === "sm" ? 11 : size === "lg" ? 16 : 13}
            className={cn(
              s <= Math.round(score)
                ? "fill-amber-500 text-amber-500 dark:fill-yellow-400 dark:text-yellow-400"
                : "fill-transparent text-muted-foreground",
            )}
            strokeWidth={1.5}
          />
        ))}
      </div>
      <span
        className={cn(
          "font-semibold text-foreground",
          size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm",
        )}
      >
        {score.toFixed(1)}
      </span>
      <span
        className={cn(
          "text-muted-foreground",
          size === "sm" ? "text-xs" : "text-sm",
        )}
      >
        ({trades} trades)
      </span>
    </div>
  );
}
