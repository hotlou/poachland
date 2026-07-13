"use client";

/**
 * Global error boundary — catches unhandled render/runtime errors anywhere in
 * the app and shows a branded recovery screen instead of a blank page.
 */

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaces in Vercel logs; swap for Sentry etc. when wired.
    console.error("[poachland] unhandled error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-pop/10 text-pop mb-5">
          <AlertTriangle size={28} />
        </div>
        <h1 className="font-display font-black text-3xl tracking-tight mb-2">
          A pass got dropped.
        </h1>
        <p className="text-sm text-muted-foreground mb-7 leading-relaxed">
          Something went wrong on our end. Give it another go — if it keeps
          happening, it&apos;s on us, not you.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 bg-accent text-accent-foreground text-sm font-semibold rounded-full px-6 py-3 shadow-sm hover:opacity-90 transition-opacity"
          >
            <RotateCcw size={16} /> Try again
          </button>
          <Link
            href="/app"
            className="inline-flex items-center justify-center text-sm font-semibold text-muted-foreground hover:text-accent transition-colors px-4 py-3"
          >
            Back to Poachland
          </Link>
        </div>
        {error.digest && (
          <p className="text-[11px] text-muted-foreground/70 mt-6">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
