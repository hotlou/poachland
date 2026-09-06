"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import type { HydratedRating, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TrustScore } from "@/components/trust-badge";

export function PartyChip({ user, isMe }: { user: User; isMe: boolean }) {
  return (
    <Link href={`/app/u/${user.username}`} className="flex flex-col items-center gap-1.5 min-w-0">
      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-border">
        <img src={user.avatar} alt={user.displayName} className="w-full h-full object-cover" />
      </div>
      <span className="text-xs font-semibold text-foreground truncate max-w-[7rem]">
        @{user.username}
        {isMe && <span className="text-muted-foreground font-normal"> (you)</span>}
      </span>
      <TrustScore score={user.trustScore} trades={user.tradesCompleted} size="sm" />
    </Link>
  );
}

export function StatusBanner({
  tone,
  icon: Icon,
  title,
  detail,
}: {
  tone: "red" | "orange" | "muted";
  icon: React.ElementType;
  title: string;
  detail?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3 flex items-start gap-3",
        tone === "red" && "border-red-600/40 bg-red-600/10 dark:border-red-400/50 dark:bg-red-400/10",
        tone === "orange" && "border-orange-600/40 bg-orange-600/10 dark:border-orange-400/50 dark:bg-orange-400/10",
        tone === "muted" && "border-border bg-card",
      )}
    >
      <Icon
        size={18}
        className={cn(
          "flex-shrink-0 mt-0.5",
          tone === "red" && "text-red-600 dark:text-red-400",
          tone === "orange" && "text-orange-700 dark:text-orange-400",
          tone === "muted" && "text-muted-foreground",
        )}
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {detail && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">&ldquo;{detail}&rdquo;</p>}
      </div>
    </div>
  );
}

function MiniStars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((score) => (
        <Star
          key={score}
          size={12}
          strokeWidth={1.5}
          className={cn(
            score <= Math.round(value)
              ? "fill-amber-500 text-amber-500 dark:fill-yellow-400 dark:text-yellow-400"
              : "fill-transparent text-muted-foreground",
          )}
        />
      ))}
      <span className="text-xs font-semibold text-foreground ml-1">{value.toFixed(1)}</span>
    </span>
  );
}

export function ExchangedRating({ rating, heading }: { rating: HydratedRating; heading: string }) {
  const overall = (rating.communication + rating.shippingSpeed + rating.itemAccuracy) / 3;
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-display font-bold">
          {heading}
        </p>
        <MiniStars value={overall} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Communication {rating.communication} · Shipping {rating.shippingSpeed} · Accuracy {rating.itemAccuracy}
        {rating.wouldTradeAgain ? " · Would trade again" : ""}
      </p>
      {rating.comment && (
        <p className="text-xs text-foreground leading-relaxed mt-1.5">&ldquo;{rating.comment}&rdquo;</p>
      )}
    </div>
  );
}
