import { Star, ShieldCheck, Zap, Package, Trophy, Handshake, HeartHandshake } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Badge } from "@/lib/types";

const BADGE_CONFIG: Record<
  Badge["type"],
  { icon: React.ElementType; color: string; bg: string }
> = {
  "first-trade": {
    icon: Handshake,
    color: "text-teal-700 border-teal-600 dark:text-teal-400 dark:border-teal-400",
    bg: "bg-teal-600/10 dark:bg-teal-400/10",
  },
  generous: {
    icon: HeartHandshake,
    color: "text-pink-700 border-pink-600 dark:text-pink-400 dark:border-pink-400",
    bg: "bg-pink-600/10 dark:bg-pink-400/10",
  },
  founding: {
    icon: Trophy,
    color: "text-amber-700 border-amber-600 dark:text-yellow-400 dark:border-yellow-400",
    bg: "bg-amber-500/10 dark:bg-yellow-400/10",
  },
  trusted: {
    icon: ShieldCheck,
    color: "text-accent border-accent",
    bg: "bg-accent/10",
  },
  veteran: {
    icon: Star,
    color: "text-sky-700 border-sky-600 dark:text-sky-400 dark:border-sky-400",
    bg: "bg-sky-600/10 dark:bg-sky-400/10",
  },
  collector: {
    icon: Package,
    color: "text-purple-700 border-purple-600 dark:text-purple-400 dark:border-purple-400",
    bg: "bg-purple-600/10 dark:bg-purple-400/10",
  },
  "quick-shipper": {
    icon: Zap,
    color: "text-orange-700 border-orange-600 dark:text-orange-400 dark:border-orange-400",
    bg: "bg-orange-500/10 dark:bg-orange-400/10",
  },
};

interface TrustBadgeProps {
  badge: Badge;
  size?: "sm" | "md";
}

export function TrustBadge({ badge, size = "sm" }: TrustBadgeProps) {
  const config = BADGE_CONFIG[badge.type];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border font-display font-bold uppercase tracking-wider",
        config.color,
        config.bg,
        size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1",
      )}
    >
      <Icon size={size === "sm" ? 9 : 11} strokeWidth={2.5} />
      {badge.label}
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
