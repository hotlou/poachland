"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRatingInput({
  value,
  onChange,
  label,
  size = 24,
}: {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  size?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      {label && <span className="text-sm text-foreground">{label}</span>}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            aria-label={`${s} star${s > 1 ? "s" : ""}`}
            onClick={() => onChange(s)}
            className="p-0.5 transition-transform active:scale-90"
          >
            <Star
              size={size}
              strokeWidth={1.5}
              className={cn(
                s <= value
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-transparent text-muted-foreground",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
