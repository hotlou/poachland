"use client";

/**
 * Public The Shop — the SEO-facing, signed-out-friendly directory of the gear
 * brands backing the ultimate community. Standalone page chrome (no app
 * shell): the shared public header, a warm hero, a strip of community
 * sponsors, and vendors grouped by category. Every partner links OUT to their
 * own site — Poachland doesn't process their sales. Data comes from the public
 * store snapshot; a join-funnel card closes the page.
 */

import Link from "next/link";
import { Store } from "lucide-react";
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

/** Category display order for the vendor sections. */
const CATEGORY_ORDER: PartnerCategory[] = [
  "jerseys",
  "discs",
  "apparel",
  "cleats",
  "accessories",
  "media",
  "other",
];

/* ── Hero ────────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <div className="pt-9 pb-6 md:pt-12 md:pb-8 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 text-accent mb-4">
        <Store size={26} />
      </div>
      <h1 className="font-display font-black text-3xl md:text-4xl tracking-tight text-balance">
        The Shop
      </h1>
      <p className="text-sm md:text-base text-muted-foreground mt-3 text-balance">
        Brands that back the game — buy direct.
      </p>
    </div>
  );
}

/* ── Logo tile (brand logos: light tile, object-contain, initial fallback) ── */

function LogoTile({
  partner,
  className,
}: {
  partner: Partner;
  className?: string;
}) {
  if (partner.logo) {
    return (
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-lg bg-white border border-border",
          className,
        )}
      >
        {/* plain img: partner logos are user-uploaded data URLs or hosted URLs */}
        <img
          src={partner.logo}
          alt={`${partner.name} logo`}
          className="w-full h-full object-contain p-1"
        />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg bg-surface border border-border font-display font-black text-muted-foreground",
        className,
      )}
      aria-hidden="true"
    >
      {partner.name.charAt(0).toUpperCase()}
    </div>
  );
}

/* ── Loading state ───────────────────────────────────────────────────────── */

function ShopSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-12 w-32 flex-shrink-0 bg-surface rounded-full animate-pulse"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 bg-surface rounded-xl animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

/* ── Community sponsors strip ────────────────────────────────────────────── */

function SponsorsStrip({ sponsors }: { sponsors: Partner[] }) {
  if (sponsors.length === 0) return null;
  return (
    <section className="mb-9">
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-display font-bold mb-3">
        Community sponsors
      </p>
      <div className="flex flex-wrap gap-2.5">
        {sponsors.map((s) => (
          <a
            key={s.id}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 bg-card border border-border rounded-full pl-1.5 pr-4 py-1.5 card-lift"
          >
            <LogoTile partner={s} className="w-8 h-8 text-xs" />
            <span className="text-sm font-semibold text-foreground">
              {s.name}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

/* ── Vendor card ─────────────────────────────────────────────────────────── */

function VendorCard({ vendor }: { vendor: Partner }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3.5 card-lift flex flex-col">
      <div className="flex items-start gap-3">
        <LogoTile
          partner={vendor}
          className="w-12 h-12 flex-shrink-0 text-lg"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground truncate">
              {vendor.name}
            </h3>
            <span className="badge-stamp text-accent border-accent">
              {CATEGORY_LABELS[vendor.category]}
            </span>
          </div>
          {vendor.tagline && (
            <p className="text-xs text-muted-foreground leading-snug mt-1 line-clamp-2">
              {vendor.tagline}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
        <Link
          href={`/vendors/${vendor.slug}`}
          className="text-xs font-semibold text-foreground hover:text-accent transition-colors"
        >
          Details
        </Link>
        {vendor.url && (
          <a
            href={vendor.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs font-bold text-accent"
          >
            Visit →
          </a>
        )}
      </div>
    </div>
  );
}

/* ── Vendors, grouped by category ────────────────────────────────────────── */

function VendorsByCategory({ vendors }: { vendors: Partner[] }) {
  const byCategory = new Map<PartnerCategory, Partner[]>();
  for (const v of vendors) {
    const list = byCategory.get(v.category) ?? [];
    list.push(v);
    byCategory.set(v.category, list);
  }

  const sections = CATEGORY_ORDER.filter((c) => byCategory.has(c));
  if (sections.length === 0) return null;

  return (
    <div className="space-y-9">
      {sections.map((category) => (
        <section key={category}>
          <h2 className="font-display font-bold text-lg tracking-tight mb-3">
            {CATEGORY_LABELS[category]}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {byCategory.get(category)!.map((v) => (
              <VendorCard key={v.id} vendor={v} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────────── */

function EmptyShop() {
  return (
    <div className="py-16 text-center">
      <h2 className="font-display font-bold text-xl tracking-tight mb-1">
        No shops listed yet — check back soon.
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        We&apos;re lining up the brands that back the game.
      </p>
      <Link href="/haul" className="text-accent text-sm font-semibold">
        See what players are trading →
      </Link>
    </div>
  );
}

/* ── Bottom join funnel ──────────────────────────────────────────────────── */

function JoinCta() {
  const store = useStore();
  const signedIn = !!store.sessionMe;
  return (
    <section className="pt-2 pb-12">
      <div className="bg-card border border-border rounded-xl p-7 md:p-9 text-center">
        {signedIn ? (
          <>
            <h2 className="font-display font-black text-2xl tracking-tight mb-2 text-balance">
              Ready to make a move?
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              Jump back into Poachland to trade, buy, and save gear.
            </p>
            <Link href="/app" className={cn(pillPrimary, "px-6 py-3")}>
              Enter Poachland
            </Link>
          </>
        ) : (
          <>
            <h2 className="font-display font-black text-2xl tracking-tight mb-2 text-balance">
              Join the swap meet
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              Free — one email. No fees, no middleman.
            </p>
            <Link href="/login" className={cn(pillPrimary, "px-6 py-3")}>
              Join free
            </Link>
          </>
        )}
      </div>
    </section>
  );
}

/* ── Directory body ──────────────────────────────────────────────────────── */

function ShopBody() {
  const store = useStore();
  const sponsors = store.listSponsors();
  const vendors = store.listVendors();

  if (sponsors.length === 0 && vendors.length === 0) {
    return <EmptyShop />;
  }

  return (
    <>
      <SponsorsStrip sponsors={sponsors} />
      <VendorsByCategory vendors={vendors} />
    </>
  );
}

/* ── Entry ───────────────────────────────────────────────────────────────── */

export function PublicShop() {
  const hydrated = useHydrated();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicSiteHeader />
      <main
        id="main-content"
        className="mx-auto max-w-lg md:max-w-3xl lg:max-w-4xl px-4 md:px-6 pb-12"
      >
        <Hero />
        {!hydrated ? (
          <ShopSkeleton />
        ) : (
          <>
            <ShopBody />
            <div className="mt-8">
              <JoinCta />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
