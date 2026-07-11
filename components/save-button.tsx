"use client";

import { Bookmark, Heart } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store-context";
import type { SaveTargetType } from "@/lib/types";

interface SaveButtonProps {
  targetType: SaveTargetType;
  targetId: string;
  /** "heart" for listings, "bookmark" for ISO posts. */
  variant?: "heart" | "bookmark";
  showCount?: number;
  className?: string;
  size?: number;
}

export function SaveButton({
  targetType,
  targetId,
  variant = "heart",
  showCount,
  className,
  size = 18,
}: SaveButtonProps) {
  const store = useStore();
  const saved = store.isSaved(targetType, targetId);
  const Icon = variant === "heart" ? Heart : Bookmark;

  return (
    <button
      type="button"
      aria-label={saved ? "Unsave" : "Save"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const res = store.toggleSave(targetType, targetId);
        if (!res.ok) toast.error(res.error);
      }}
      className={cn(
        "inline-flex items-center gap-1 transition-colors",
        saved ? "text-accent" : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <Icon size={size} className={saved ? "fill-current" : ""} strokeWidth={2} />
      {showCount !== undefined && (
        <span className="text-xs tabular-nums">{showCount}</span>
      )}
    </button>
  );
}
