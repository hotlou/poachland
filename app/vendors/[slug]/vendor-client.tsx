"use client";

/**
 * Public gear-brand detail — the SEO-facing, signed-out-friendly page for a
 * single partner at /vendors/[slug]. Standalone page chrome (no app shell):
 * the shared public header, the brand's logo, tagline, and description, and a
 * prominent CTA that links OUT to the brand's own site. Poachland doesn't
 * process the seller's sales — buyers go direct. Data comes from the public
 * store snapshot.
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useHydrated, useStore } from "@/lib/store-context";
import { PublicSiteHeader } from "@/app/u/[username]/public-profile";
import type { Partner, PartnerCategory } from "@/lib/types";

const pillPrimary =
  "inline-flex items-center justify-center gap-2 bg-accent text-accent-foreground text-sm font-semibold rounded-full shadow-sm hover:opacity-90 transition-opacity";

const CATEGORY_LABELS: Record<PartnerCategory, string> = {
  jerseys: "Jerseys",
  discs: "Discs",
  apparel: "Apparel",
  cleats: "Cleats",
  accessories: "Accessories",
  media: "Media",
  other: "More",
};

const KIND_LABELS: Record<Partner["kind"], string> = {
  sponsor: "Sponsor",
  vendor: "Vendor",
};

/* ── Loading / missing states ────────────────────────────────────────────── */

function VendorSkeleton() {
  return (
    <div className="px-1 pt-9 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-24 h-24 rounded-xl bg-surface" />
        <div className="flex-1 space-y-3 pt-2">
          <div className="h-6 w-2/3 bg-surface rounded" />
          <div className="h-3 w-1/3 bg-surface rounded" />
        </div>
      </div>
      <div className="h-24 bg-surface rounded-xl mt-6" />
    </div>
  );
}

function NotAvailable() {
  return (
    <div className="px-1 py-24 text-center">
      <div className="bg-card border border-border rounded-xl p-8 md:p-10">
        <h1 className="font-display font-bold text-2xl tracking-tight mb-1">
          This shop isn&apos;t available
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          It may have moved on, or the link is off. Browse the brands still on
          the board.
        </p>
        <Link href="/shop" className={cn(pillPrimary, "px-6 py-3")}>
          Back to The Shop
        </Link>
      </div>
    </div>
  );
}

/* ── Logo tile ───────────────────────────────────────────────────────────── */

function LogoTile({ partner }: { partner: Partner }) {
  if (partner.logo) {
    return (
      <div className="w-24 h-24 md:w-28 md:h-28 flex-shrink-0 flex items-center justify-center overflow-hidden rounded-xl bg-white border border-border">
        {/* plain img: partner logos are user-uploaded data URLs or hosted URLs */}
        <img
          src={partner.logo}
          alt={`${partner.name} logo`}
          className="w-full h-full object-contain p-2"
        />
      </div>
    );
  }
  return (
    <div
      className="w-24 h-24 md:w-28 md:h-28 flex-shrink-0 flex items-center justify-center rounded-xl bg-surface border border-border font-display font-black text-4xl text-muted-foreground"
      aria-hidden="true"
    >
      {partner.name.charAt(0).toUpperCase()}
    </div>
  );
}

/* ── Detail body ─────────────────────────────────────────────────────────── */

function DetailBody({ partner }: { partner: Partner }) {
  return (
    <article className="pt-9 pb-4">
      <div className="mb-6">
        <Link href="/shop" className="text-sm font-semibold text-accent">
          ← All shops
        </Link>
      </div>

      <header className="flex items-start gap-4 md:gap-6">
        <LogoTile partner={partner} />
        <div className="min-w-0 flex-1 pt-1">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="badge-stamp text-accent border-accent">
              {KIND_LABELS[partner.kind]}
            </span>
            <span className="badge-stamp text-muted-foreground border-border">
              {CATEGORY_LABELS[partner.category]}
            </span>
          </div>
          <h1 className="font-display font-black text-3xl tracking-tight text-balance">
            {partner.name}
          </h1>
          {partner.tagline && (
            <p className="text-sm md:text-base text-muted-foreground mt-2 leading-relaxed">
              {partner.tagline}
            </p>
          )}
        </div>
      </header>

      {partner.url && (
        <div className="mt-6">
          <a
            href={partner.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(pillPrimary, "px-6 py-3")}
          >
            Visit {partner.name} →
          </a>
        </div>
      )}

      {partner.description && (
        <div className="mt-8 bg-card border border-border rounded-xl p-5 md:p-6">
          <p className="text-sm md:text-base text-foreground leading-relaxed whitespace-pre-wrap">
            {partner.description}
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-6 leading-relaxed">
        Poachland doesn&apos;t process this seller&apos;s sales — you&apos;re
        buying direct from them.
      </p>
    </article>
  );
}

/* ── Entry ───────────────────────────────────────────────────────────────── */

export function VendorDetail({ slug }: { slug: string }) {
  const store = useStore();
  const hydrated = useHydrated();
  const partner = store.getPartnerBySlug(slug);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicSiteHeader />
      <main
        id="main-content"
        className="mx-auto max-w-lg md:max-w-3xl lg:max-w-4xl px-4 md:px-6 pb-12"
      >
        {!hydrated ? (
          <VendorSkeleton />
        ) : partner ? (
          <DetailBody partner={partner} />
        ) : (
          <NotAvailable />
        )}
      </main>
    </div>
  );
}
