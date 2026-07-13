"use client";

import Link from "next/link";
import { Copy, Gift, Share2, Sprout, Users } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store-context";
import { Hydrated } from "@/components/hydrated";

function InviteBody() {
  const store = useStore();
  const me = store.requireUser();
  const session = store.sessionMe;
  const referralCount = session?.referralCount ?? 0;
  const memberNumber = session?.memberNumber ?? 0;
  const isFounder = me.badges.some((b) => b.type === "founding");

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://poachland.com";
  const link = `${origin}/?ref=${me.username}`;

  const copy = () => {
    if (!navigator.clipboard) {
      toast.error("Copy it straight from the box");
      return;
    }
    navigator.clipboard.writeText(link).then(
      () => toast.success("Invite link copied"),
      () => toast.error("Couldn't copy — grab it from the box"),
    );
  };
  const share = () => {
    if (navigator.share) {
      navigator
        .share({
          title: "Join me on Poachland",
          text: "Trade ultimate frisbee jerseys & discs with me on Poachland — no fees.",
          url: link,
        })
        .catch(() => {});
    } else {
      copy();
    }
  };

  return (
    <div className="px-4 md:px-6 pb-8">
      {/* Founder flex */}
      {isFounder && (
        <div className="mt-4 rounded-2xl border border-accent/40 bg-accent/5 p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-accent/15 text-accent flex items-center justify-center flex-shrink-0">
            <Sprout size={24} />
          </div>
          <div className="min-w-0">
            <p className="font-display font-bold text-base tracking-tight">
              Founding Member{memberNumber ? ` #${memberNumber}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              You got here early. Bring the people who&apos;ll make it worth staying.
            </p>
          </div>
        </div>
      )}

      {/* Pitch */}
      <div className="mt-4 text-center md:text-left">
        <h2 className="font-display font-black text-2xl tracking-tight">
          Better with friends.
        </h2>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
          Poachland is only as good as who&apos;s on it. Share your link — every
          player who joins through it earns you the{" "}
          <span className="font-semibold text-foreground">🔗 Connector</span> badge,
          and makes the crate deeper for everyone.
        </p>
      </div>

      {/* Link box */}
      <div className="mt-5 flex items-center gap-2 bg-surface border border-border rounded-xl p-2 pl-3.5">
        <span className="flex-1 min-w-0 font-mono text-[13px] text-foreground truncate" title={link}>
          {link}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy invite link"
          className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:border-accent hover:text-accent transition-colors"
        >
          <Copy size={13} /> Copy
        </button>
      </div>
      <button
        type="button"
        onClick={share}
        className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-accent text-accent-foreground text-sm font-display font-semibold rounded-full px-5 py-2.5 shadow-sm hover:opacity-90 transition-opacity"
      >
        <Share2 size={15} /> Share your invite
      </button>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <Users size={18} className="mx-auto text-accent mb-1.5" />
          <p className="font-display font-black text-2xl tracking-tight">{referralCount}</p>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground mt-0.5">
            Friends joined
          </p>
        </div>
        <Link
          href="/app/badges"
          className="rounded-xl border border-border bg-card p-4 text-center card-lift flex flex-col justify-center"
        >
          <Gift size={18} className="mx-auto text-pop mb-1.5" />
          <p className="font-display font-bold text-sm tracking-tight">
            {referralCount > 0 ? "🔗 Connector earned" : "Earn 🔗 Connector"}
          </p>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground mt-1">
            See all badges
          </p>
        </Link>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="md:hidden sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-2">
        <Gift size={20} className="text-accent" strokeWidth={2.5} />
        <h1 className="font-display font-bold text-xl tracking-tight">Invite friends</h1>
      </header>
      <Hydrated
        fallback={<div className="px-4 md:px-6 mt-6 h-40 bg-surface rounded-2xl animate-pulse" />}
      >
        <InviteBody />
      </Hydrated>
    </div>
  );
}
