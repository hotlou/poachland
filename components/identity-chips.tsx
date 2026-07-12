"use client";

import Link from "next/link";
import { BadgeCheck, Facebook, Globe, Instagram, Trophy } from "lucide-react";
import { useStore } from "@/lib/store-context";
import { cn } from "@/lib/utils";
import type { IdentityProvider, IdentityStatus } from "@/lib/types";

export const IDENTITY_PROVIDER_META: Record<
  IdentityProvider,
  { label: string; icon: React.ElementType }
> = {
  instagram: { label: "Instagram", icon: Instagram },
  facebook: { label: "Facebook", icon: Facebook },
  usau: { label: "USAU", icon: Trophy },
  other: { label: "Other", icon: Globe },
};

export const IDENTITY_STATUS_META: Record<IdentityStatus, { label: string; cls: string }> = {
  unverified: { label: "Unverified", cls: "text-muted-foreground border-border" },
  pending: { label: "In review", cls: "text-yellow-400 border-yellow-400" },
  verified: { label: "Verified ✓", cls: "text-accent border-accent" },
  rejected: { label: "Rejected", cls: "text-red-400 border-red-400" },
};

/**
 * Linked real-life identities as a compact chip row (profile pages).
 * Own-profile chips route to settings to manage; others linkify their URL.
 */
export function IdentityChips({
  userId,
  ownProfile = false,
}: {
  userId: string;
  ownProfile?: boolean;
}) {
  const store = useStore();
  const identities = store.listIdentities(userId);
  if (identities.length === 0) return null;

  return (
    <div className="flex gap-1.5 mt-3 flex-wrap">
      {identities.map((identity) => {
        const meta = IDENTITY_PROVIDER_META[identity.provider];
        const Icon = meta.icon;
        const verified = identity.status === "verified";
        const chipCls = cn(
          "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs transition-colors",
          verified
            ? "border-accent/50 text-accent bg-accent/5"
            : "border-border text-muted-foreground bg-surface",
          (ownProfile || identity.url) && "hover:border-accent/60 hover:text-accent",
        );
        const body = (
          <>
            <Icon size={11} strokeWidth={2} aria-label={meta.label} />
            <span className="max-w-32 truncate">@{identity.handle}</span>
            {verified && <BadgeCheck size={11} className="text-accent" strokeWidth={2.5} />}
          </>
        );
        if (ownProfile) {
          return (
            <Link
              key={identity.id}
              href="/app/settings"
              className={chipCls}
              title={`${meta.label} — manage in settings`}
            >
              {body}
            </Link>
          );
        }
        if (identity.url) {
          return (
            <a
              key={identity.id}
              href={identity.url}
              target="_blank"
              rel="noopener noreferrer"
              className={chipCls}
              title={meta.label}
            >
              {body}
            </a>
          );
        }
        return (
          <span key={identity.id} className={chipCls} title={meta.label}>
            {body}
          </span>
        );
      })}
    </div>
  );
}
