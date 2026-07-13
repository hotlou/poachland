/**
 * Branded 404 — shown for any unknown route (server component).
 */

import Link from "next/link";
import { Compass } from "lucide-react";

export const metadata = {
  title: "Not found — Poachland",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 text-accent mb-5">
          <Compass size={28} />
        </div>
        <p className="font-display font-black text-5xl tracking-tight text-accent mb-1">
          404
        </p>
        <h1 className="font-display font-bold text-2xl tracking-tight mb-2">
          Nothing to poach here.
        </h1>
        <p className="text-sm text-muted-foreground mb-7 leading-relaxed">
          This page doesn&apos;t exist — or the listing already found a new home.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/app/browse"
            className="inline-flex items-center justify-center gap-2 bg-accent text-accent-foreground text-sm font-semibold rounded-full px-6 py-3 shadow-sm hover:opacity-90 transition-opacity"
          >
            Browse the crate
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center text-sm font-semibold text-muted-foreground hover:text-accent transition-colors px-4 py-3"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
