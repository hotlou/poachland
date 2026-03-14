import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ShieldCheck, Repeat2, Star } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-border">
        <span className="font-display font-900 text-2xl tracking-tight text-foreground uppercase">
          Poachland
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/onboarding"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/onboarding"
            className="text-sm font-semibold bg-accent text-accent-foreground px-4 py-2 rounded-sm transition-opacity hover:opacity-90"
          >
            Join
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-5 pt-12 pb-10 overflow-hidden">
        <div className="relative z-10 max-w-sm mx-auto text-center">
          <div className="badge-stamp text-accent border-accent inline-flex mx-auto mb-5">
            Ultimate Frisbee Only
          </div>
          <h1 className="font-display font-900 text-5xl uppercase leading-none tracking-tight text-balance mb-4">
            Trade the&nbsp;
            <span className="text-accent">jerseys</span>
            .&nbsp;Collect the&nbsp;
            <span className="text-accent">discs</span>.
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed mb-8 text-pretty">
            A marketplace built by players, for players. Free to list. Free to trade.
            Community trust built in.
          </p>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 bg-accent text-accent-foreground font-display font-700 uppercase tracking-wide text-base px-8 py-3.5 rounded-sm hover:opacity-90 transition-opacity"
          >
            Start poaching <ArrowRight size={18} />
          </Link>
          <p className="mt-4 text-xs text-muted-foreground">
            No fees. No algorithms. Just players.
          </p>
        </div>
      </section>

      {/* Sample listings marquee-style scroll */}
      <section className="px-5 py-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-4">
          What's in the crate right now
        </p>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-5 px-5">
          {[
            { img: "/images/jersey-1.jpg", label: "Brute Squad '22", cond: "NM" },
            { img: "/images/disc-1.jpg", label: "WFDF Worlds '19", cond: "Mint" },
            { img: "/images/jersey-2.jpg", label: "Mixtape '21", cond: "Good" },
            { img: "/images/disc-2.jpg", label: "UPA Champs '11", cond: "Good" },
            { img: "/images/jersey-4.jpg", label: "AMP '23", cond: "NM" },
          ].map((item, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-36 rounded-lg overflow-hidden border border-border bg-card"
            >
              <div className="relative aspect-square">
                <Image src={item.img} alt={item.label} fill className="object-cover" sizes="144px" />
                <span className="absolute top-1.5 left-1.5 badge-stamp text-accent border-accent bg-background/80 backdrop-blur-sm text-[9px]">
                  {item.cond}
                </span>
              </div>
              <div className="p-2">
                <p className="text-xs font-semibold leading-tight">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-5 py-8 border-t border-border">
        <h2 className="font-display font-700 text-2xl uppercase tracking-tight mb-6 text-balance">
          Built for the community
        </h2>
        <div className="flex flex-col gap-5">
          {[
            {
              icon: Repeat2,
              title: "Trade, sell, or give it away",
              desc: "Item-for-item trades, trade+cash deals, straight sales, or free listings. Your call.",
            },
            {
              icon: ShieldCheck,
              title: "Trust is the product",
              desc: "Reputation scores, condition ratings, and trade history — all public. No anonymous flakes.",
            },
            {
              icon: Star,
              title: "Collector-grade condition language",
              desc: "Mint / Near Mint / Good / Fair / Worn. Same language everyone uses, built into every listing.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-4 items-start">
              <div className="flex-shrink-0 w-10 h-10 rounded-sm bg-accent-dim flex items-center justify-center">
                <Icon size={20} className="text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-0.5">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ISO Board preview */}
      <section className="px-5 py-8 border-t border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-700 text-2xl uppercase tracking-tight">
            The wanted board
          </h2>
          <Link href="/app/wanted" className="text-xs text-accent font-semibold">
            View all
          </Link>
        </div>
        <div className="flex flex-col gap-3">
          {[
            { user: "discwitch", want: "ISO: Any Scandal women's jersey, any year", saves: 11 },
            { user: "flick_therapy", want: "ISO: Sockeye jersey 2015–2019, size L", saves: 8 },
            { user: "huck_and_pray", want: "Hunting WFDF Worlds disc — Cologne 2017", saves: 15 },
          ].map((post, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-lg p-3.5 flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-surface-raised flex-shrink-0 flex items-center justify-center text-xs text-muted-foreground font-bold">
                {post.user[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">@{post.user}</p>
                <p className="text-sm text-foreground leading-snug">{post.want}</p>
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {post.saves} saves
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA footer */}
      <section className="px-5 pt-8 pb-16 border-t border-border">
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <h2 className="font-display font-800 text-3xl uppercase tracking-tight mb-2 text-balance">
            What are you hunting?
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            Join 400,000 players who actually care about this stuff.
          </p>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 bg-accent text-accent-foreground font-display font-700 uppercase tracking-wide text-sm px-7 py-3 rounded-sm hover:opacity-90 transition-opacity"
          >
            Create free account <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
