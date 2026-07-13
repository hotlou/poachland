import type { Metadata } from "next";
import Link from "next/link";
import { Handshake } from "lucide-react";

export const metadata: Metadata = {
  title: "Account closed — Poachland",
  robots: { index: false },
};

export default function GoodbyePage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 text-accent mb-5">
          <Handshake size={28} />
        </div>
        <h1 className="font-display font-black text-3xl tracking-tight mb-2">
          Your account is closed.
        </h1>
        <p className="text-sm text-muted-foreground mb-7 leading-relaxed">
          We scrubbed your personal data. Thanks for being part of Poachland —
          the crate&apos;s always open if you want to come back and start fresh.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 bg-accent text-accent-foreground text-sm font-semibold rounded-full px-6 py-3 shadow-sm hover:opacity-90 transition-opacity"
        >
          Back to Poachland
        </Link>
      </div>
    </div>
  );
}
