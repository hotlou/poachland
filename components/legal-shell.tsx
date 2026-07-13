/**
 * Standalone chrome for the public legal pages (/terms, /privacy). Server
 * component — plain wordmark header, readable prose column, cross-links.
 */

import Link from "next/link";
import type { ReactNode } from "react";

export function LegalShell({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="mx-auto max-w-2xl flex items-center justify-between px-5 py-3.5">
          <Link href="/" className="font-display font-black text-xl tracking-tight text-accent">
            Poachland
          </Link>
          <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Join free
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-10">
        <h1 className="font-display font-black text-3xl md:text-4xl tracking-tight mb-1">{title}</h1>
        <p className="text-xs text-muted-foreground mb-8">Last updated {lastUpdated}</p>
        <div className="legal-prose flex flex-col gap-5 text-sm leading-relaxed text-foreground/90">
          {children}
        </div>

        <footer className="mt-12 pt-6 border-t border-border flex items-center gap-4 text-xs text-muted-foreground">
          <Link href="/terms" className="hover:text-accent transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-accent transition-colors">Privacy</Link>
          <Link href="/" className="hover:text-accent transition-colors">Home</Link>
        </footer>
      </main>
    </div>
  );
}

/** Section heading used inside the legal prose. */
export function LegalHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display font-bold text-lg tracking-tight text-foreground mt-4">
      {children}
    </h2>
  );
}
