"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Repeat2, CheckCircle2 } from "lucide-react";
import { DEMO_LISTINGS, DEMO_USERS } from "@/lib/seed-data";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

function NewTradeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listingId = searchParams.get("listing") ?? "l1";
  const wantedListing = DEMO_LISTINGS.find((l) => l.id === listingId) ?? DEMO_LISTINGS[0];

  const [step, setStep] = useState<"select" | "note" | "confirm" | "sent">("select");
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [cashAdded, setCashAdded] = useState("");
  const [note, setNote] = useState("");

  const me = DEMO_USERS[0];
  const myListings = DEMO_LISTINGS.filter((l) => l.sellerId === me.id);
  const selectedListing = myListings.find((l) => l.id === selectedListingId);

  if (step === "sent") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-accent-dim border-2 border-accent flex items-center justify-center mb-6">
          <CheckCircle2 size={40} className="text-accent" />
        </div>
        <h2 className="font-display font-800 text-3xl uppercase tracking-tight mb-3">
          Proposal sent
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed mb-2">
          Your offer is live. Expires in 7 days if no response.
        </p>
        <p className="text-xs text-muted-foreground mb-8">
          We'll notify you the moment they respond.
        </p>
        <button
          onClick={() => router.push("/app/inbox")}
          className="w-full bg-accent text-accent-foreground font-display font-700 uppercase tracking-wide py-4 rounded-sm"
        >
          Go to inbox
        </button>
        <button
          onClick={() => router.push("/app")}
          className="mt-3 text-sm text-muted-foreground"
        >
          Back to feed
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => (step === "select" ? router.back() : setStep("select"))}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display font-800 text-lg uppercase tracking-tight">
          {step === "select" ? "Choose your offer" : step === "note" ? "Add a note" : "Review & send"}
        </h1>
      </header>

      <div className="px-4 py-6">
        {/* They want / You offer header */}
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">
            You're proposing for
          </p>
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 relative">
              <Image
                src={wantedListing.photos[0]}
                alt={wantedListing.title}
                fill
                className="object-cover"
                sizes="64px"
              />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">{wantedListing.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                by @{wantedListing.seller.username}
              </p>
            </div>
          </div>
        </div>

        {step === "select" && (
          <div>
            <h2 className="font-display font-700 text-xl uppercase tracking-tight mb-4">
              What are you offering?
            </h2>
            <div className="flex flex-col gap-3 mb-6">
              {myListings.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-border rounded-lg">
                  <p className="text-muted-foreground text-sm mb-3">
                    You don't have any active listings to offer.
                  </p>
                  <button
                    onClick={() => router.push("/app/create")}
                    className="text-accent text-sm font-semibold"
                  >
                    Post a listing first
                  </button>
                </div>
              ) : (
                myListings.map((listing) => (
                  <button
                    key={listing.id}
                    onClick={() => setSelectedListingId(listing.id)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                      selectedListingId === listing.id
                        ? "border-accent bg-accent-dim"
                        : "border-border bg-card",
                    )}
                  >
                    <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 relative">
                      <Image
                        src={listing.photos[0]}
                        alt={listing.title}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold line-clamp-1">{listing.title}</p>
                      <p className="text-xs text-muted-foreground">{listing.condition} · {listing.type}</p>
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors",
                      selectedListingId === listing.id
                        ? "border-accent bg-accent"
                        : "border-border",
                    )} />
                  </button>
                ))
              )}
            </div>

            {/* Optional cash sweetener */}
            <div className="mb-6">
              <label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 block">
                Add cash to sweeten the deal (optional)
              </label>
              <div className="flex items-center gap-2 bg-surface border border-border rounded-sm px-3 py-3">
                <span className="text-muted-foreground">$</span>
                <input
                  type="number"
                  value={cashAdded}
                  onChange={(e) => setCashAdded(e.target.value)}
                  placeholder="0"
                  className="flex-1 bg-transparent text-sm text-foreground outline-none"
                />
              </div>
            </div>

            <button
              disabled={!selectedListingId}
              onClick={() => setStep("note")}
              className="w-full bg-accent text-accent-foreground font-display font-700 uppercase tracking-wide py-4 rounded-sm disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        )}

        {step === "note" && (
          <div>
            <h2 className="font-display font-700 text-xl uppercase tracking-tight mb-2">
              Add a note
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              Make it real. A good first message goes a long way.
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. That Brute jersey is sick. Offering my 2011 UPA disc — good condition. Let me know what you think."
              rows={5}
              className="w-full bg-surface border border-border rounded-sm px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors resize-none mb-6"
            />
            <button
              onClick={() => setStep("confirm")}
              className="w-full bg-accent text-accent-foreground font-display font-700 uppercase tracking-wide py-4 rounded-sm"
            >
              Preview proposal
            </button>
          </div>
        )}

        {step === "confirm" && selectedListing && (
          <div>
            <h2 className="font-display font-700 text-xl uppercase tracking-tight mb-6">
              Your proposal
            </h2>

            {/* Visual trade summary */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 bg-card border border-border rounded-lg p-3 text-center">
                <div className="relative w-full aspect-square rounded-lg overflow-hidden mb-2">
                  <Image
                    src={selectedListing.photos[0]}
                    alt={selectedListing.title}
                    fill
                    className="object-cover"
                    sizes="150px"
                  />
                </div>
                <p className="text-xs font-semibold line-clamp-2">{selectedListing.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">You offer</p>
              </div>

              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <Repeat2 size={20} className="text-accent" />
                {cashAdded && Number(cashAdded) > 0 && (
                  <span className="badge-stamp text-accent border-accent text-[10px]">
                    +${cashAdded}
                  </span>
                )}
              </div>

              <div className="flex-1 bg-card border border-border rounded-lg p-3 text-center">
                <div className="relative w-full aspect-square rounded-lg overflow-hidden mb-2">
                  <Image
                    src={wantedListing.photos[0]}
                    alt={wantedListing.title}
                    fill
                    className="object-cover"
                    sizes="150px"
                  />
                </div>
                <p className="text-xs font-semibold line-clamp-2">{wantedListing.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">They offer</p>
              </div>
            </div>

            {/* Note preview */}
            {note && (
              <div className="bg-surface border border-border rounded-lg p-3 mb-6">
                <p className="text-xs text-muted-foreground mb-1">Your note</p>
                <p className="text-sm text-foreground leading-relaxed">{note}</p>
              </div>
            )}

            <div className="bg-surface border border-border rounded-lg p-3 mb-6 text-xs text-muted-foreground">
              Expires in 7 days. Both parties can message through the thread.
            </div>

            <button
              onClick={() => setStep("sent")}
              className="w-full bg-accent text-accent-foreground font-display font-700 uppercase tracking-wide py-4 rounded-sm flex items-center justify-center gap-2"
            >
              <Repeat2 size={16} /> Send Proposal
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NewTradePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Spinner className="text-accent" />
        </div>
      }
    >
      <NewTradeContent />
    </Suspense>
  );
}
