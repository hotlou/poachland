import { cn } from "@/lib/utils";
import { DEAL_STATUS_COLORS, DEAL_STATUS_LABELS } from "@/lib/constants";
import type { DealStatus } from "@/lib/types";

export function DealStatusBadge({
  status,
  className,
}: {
  status: DealStatus;
  className?: string;
}) {
  return (
    <span className={cn("badge-stamp", DEAL_STATUS_COLORS[status], className)}>
      {DEAL_STATUS_LABELS[status]}
    </span>
  );
}
