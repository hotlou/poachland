import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/** A community check is distinct from trading ratings and social-account proofs. */
export function VerifiedMark({ size = 16, className, label = "Community verified" }: {
  size?: number;
  className?: string;
  label?: string;
}) {
  return <span role="img" aria-label={label} title={label} className={cn("inline-flex shrink-0 align-middle", className)}>
    <BadgeCheck size={size} className="fill-blue-600 text-white dark:fill-blue-500" strokeWidth={2} aria-hidden="true" />
  </span>;
}
