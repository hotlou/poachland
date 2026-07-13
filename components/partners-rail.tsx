"use client";

/**
 * A slim, tasteful "Supported by" strip for the signed-in home feed. Shows a
 * de-duped, capped row of the community's sponsors and featured vendors as
 * quiet logo+name chips — sponsors link out to their own sites, vendors link
 * to their /vendors/[slug] page. Deliberately small and unobtrusive: it's a
 * nod to the brands backing the game, not an ad banner. Renders nothing when
 * there are no partners.
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store-context";
import type { Partner } from "@/lib/types";

const MAX_PARTNERS = 8;

/* ── Logo / initial tile ─────────────────────────────────────────────────── */

function ChipLogo({ partner }: { partner: Partner }) {
  if (partner.logo) {
    return (
      <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center overflow-hidden rounded-md bg-white border border-border">
        {/* plain img: partner logos are user-uploaded data URLs or hosted URLs */}
        <img
          src={partner.logo}
          alt=""
          className="w-full h-full object-contain p-0.5"
        />
      </span>
    );
  }
  return (
    <span
      className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-md bg-surface border border-border font-display font-bold text-[11px] text-muted-foreground"
      aria-hidden="true"
    >
      {partner.name.charAt(0).toUpperCase()}
    </span>
  );
}

/* ── Chip ────────────────────────────────────────────────────────────────── */

const chipClass =
  "inline-flex items-center gap-2 bg-card border border-border rounded-full pl-1.5 pr-3.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors";

function PartnerChip({ partner }: { partner: Partner }) {
  const inner = (
    <>
      <ChipLogo partner={partner} />
      <span className="truncate max-w-[10rem]">{partner.name}</span>
    </>
  );

  if (partner.kind === "sponsor") {
    if (!partner.url) {
      return <span className={chipClass}>{inner}</span>;
    }
    return (
      <a
        href={partner.url}
        target="_blank"
        rel="noopener noreferrer"
        className={chipClass}
      >
        {inner}
      </a>
    );
  }

  return (
    <Link href={`/vendors/${partner.slug}`} className={chipClass}>
      {inner}
    </Link>
  );
}

/* ── Rail ────────────────────────────────────────────────────────────────── */

export function PartnersRail({ className }: { className?: string }) {
  const store = useStore();
  const sponsors = store.listSponsors();
  const featured = store.featuredPartners();

  // Prefer sponsors, then featured vendors; de-dupe by id and cap the row.
  const seen = new Set<string>();
  const partners: Partner[] = [];
  for (const p of [...sponsors, ...featured]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    partners.push(p);
    if (partners.length >= MAX_PARTNERS) break;
  }

  if (partners.length === 0) return null;

  return (
    <section className={cn(className)} aria-label="Supported by">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-display font-bold mb-2.5">
        Supported by
      </p>
      <div className="flex flex-wrap gap-2">
        {partners.map((p) => (
          <PartnerChip key={p.id} partner={p} />
        ))}
      </div>
    </section>
  );
}
