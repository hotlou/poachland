"use client";

import { useState } from "react";
import { Gavel } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store-context";
import { timeAgo } from "@/lib/format";
import type { DealRecord } from "@/lib/types";
import { DealStatusBadge } from "@/components/deal-status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type AdminUser, EmptyRow, openPhoto, SectionHeading } from "./admin-shared";

/* ── 4. Disputed deals ───────────────────────────────────────────────────── */

export function DisputesSection({
  disputes,
  findUser,
  onResolve,
}: {
  disputes: DealRecord[];
  findUser: (id: string) => AdminUser | undefined;
  onResolve: (
    deal: DealRecord,
    outcome: "cancelled" | "completed",
    note: string,
  ) => Promise<boolean>;
}) {
  const store = useStore();
  const [resolving, setResolving] = useState<{
    deal: DealRecord;
    outcome: "cancelled" | "completed";
  } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const openResolve = (deal: DealRecord, outcome: "cancelled" | "completed") => {
    setNote("");
    setResolving({ deal, outcome });
  };

  const confirm = async () => {
    if (!resolving || busy) return;
    setBusy(true);
    const ok = await onResolve(resolving.deal, resolving.outcome, note.trim());
    setBusy(false);
    if (ok) {
      toast.success(
        resolving.outcome === "cancelled"
          ? "Deal cancelled — items released back to the market"
          : "Deal force-completed",
      );
      setResolving(null);
    }
  };

  return (
    <section>
      <SectionHeading icon={Gavel} title="Disputed deals" count={disputes.length} />
      {disputes.length === 0 ? (
        <EmptyRow>No open disputes. Peace in the land.</EmptyRow>
      ) : (
        <div className="space-y-2">
          {disputes.map((deal) => {
            const listing = store.getListing(deal.listingId);
            const proposer = findUser(deal.proposerId);
            const owner = findUser(deal.ownerId);
            return (
              <div
                key={deal.id}
                className="bg-card border border-red-700/40 dark:border-red-400/40 rounded-xl p-3.5 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={listing?.photos[0] || "/placeholder.jpg"}
                      alt=""
                      className="w-10 h-10 rounded object-cover border border-border shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {listing?.title ?? "A deal"}
                      </p>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground truncate">
                        {proposer?.username ?? "?"} ⇄ {owner?.username ?? "?"}
                      </p>
                    </div>
                  </div>
                  <DealStatusBadge status={deal.status} className="shrink-0" />
                </div>
                {deal.disputeReason && (
                  <p className="text-sm text-muted-foreground leading-snug">
                    <span className="font-bold text-red-700 dark:text-red-400">Dispute:</span> {deal.disputeReason}
                  </p>
                )}
                {/* Proof photos each party attached — evidence for the call. */}
                {[deal.proposerId, deal.ownerId].map((partyId) => {
                  const photos = deal.fulfillment[partyId]?.proofPhotos ?? [];
                  if (photos.length === 0) return null;
                  const party = findUser(partyId);
                  return (
                    <div key={partyId}>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                        Proof from {party?.username ?? "unknown"}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {photos.map((src, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => void openPhoto(src)}
                            aria-label={`Open proof photo ${i + 1} from ${party?.username ?? "party"}`}
                            className="w-12 h-12 rounded-lg overflow-hidden border border-border hover:border-accent transition-colors"
                          >
                            <img src={src} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-muted-foreground">Updated {timeAgo(deal.updatedAt)}</p>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-full"
                    onClick={() => openResolve(deal, "cancelled")}
                  >
                    Cancel deal
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full text-accent border-accent/40 hover:text-accent"
                    onClick={() => openResolve(deal, "completed")}
                  >
                    Force complete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!resolving} onOpenChange={(open) => !open && setResolving(null)}>
        <DialogContent className="max-w-sm bg-card border-border">
          {resolving && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display font-bold tracking-tight">
                  {resolving.outcome === "cancelled" ? "Cancel this deal?" : "Force complete?"}
                </DialogTitle>
                <DialogDescription>
                  {resolving.outcome === "cancelled"
                    ? "The deal is voided and every locked item goes back on the market. Both parties are notified."
                    : "The deal is marked done for both sides — items change hands on the record and trade counts tick up."}
                </DialogDescription>
              </DialogHeader>
              <div className="py-1">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Resolution rationale for both parties (required)."
                  rows={3}
                  maxLength={2000}
                  className="bg-surface resize-none"
                />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => setResolving(null)}>
                  Back
                </Button>
                <Button
                  variant={resolving.outcome === "cancelled" ? "destructive" : "default"}
                  className={
                    resolving.outcome === "cancelled"
                      ? "rounded-full"
                      : "rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
                  }
                  disabled={busy || note.trim().length < 20}
                  onClick={() => void confirm()}
                >
                  {busy
                    ? "Working…"
                    : resolving.outcome === "cancelled"
                      ? "Cancel the deal"
                      : "Complete the deal"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

