"use client";

import { useRef, useState } from "react";
import { Ban, CheckCircle2, Handshake, ImagePlus, Package, ShieldAlert, Truck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store-context";
import type { Deal, ShippingCarrier, User } from "@/lib/types";
import { uploadImage } from "@/lib/image";
import { timeAgo } from "@/lib/format";
import { carrierTrackingUrl, SHIPPING_CARRIER_LABELS } from "@/lib/shipping";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// ─── Settle up (payment handles) ──────────────────────────────────────────────

/** data: URLs can't be opened as top-level navigations — route them via a blob. */
async function openPhoto(src: string) {
  if (!src.startsWith("data:")) {
    window.open(src, "_blank", "noopener,noreferrer");
    return;
  }
  try {
    const blob = await (await fetch(src)).blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    toast.error("Couldn't open the photo");
  }
}

// ─── Proof photos ─────────────────────────────────────────────────────────────

const MAX_PROOF_PHOTOS = 4;

export function ProofSection({ deal, me, other }: { deal: Deal; me: User; other: User }) {
  const store = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const myPhotos = deal.fulfillment[me.id]?.proofPhotos ?? [];
  const theirPhotos = deal.fulfillment[other.id]?.proofPhotos ?? [];
  const room = MAX_PROOF_PHOTOS - myPhotos.length;

  const onFiles = async (files: File[]) => {
    if (files.length === 0) return;
    if (files.length > room) {
      toast.error(`Only ${room} proof slot${room === 1 ? "" : "s"} left`);
    }
    setUploading(true);
    const photos: string[] = [];
    for (const file of files.slice(0, room)) {
      try {
        photos.push(await uploadImage(file, 800));
      } catch {
        toast.error(`Couldn't read ${file.name}`);
      }
    }
    setUploading(false);
    if (photos.length === 0) return;
    const res = store.attachProof(deal.id, photos);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Added ${photos.length} proof photo${photos.length > 1 ? "s" : ""}`);
  };

  const photoRow = (label: string, photos: string[]) =>
    photos.length > 0 && (
      <div>
        <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
        <div className="flex flex-wrap gap-1.5">
          {photos.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => void openPhoto(src)}
              aria-label={`Open proof photo ${i + 1}`}
              className="w-14 h-14 rounded-lg overflow-hidden border border-border hover:border-accent transition-colors"
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-display font-bold mb-2">
        Proof
      </p>
      {(myPhotos.length > 0 || theirPhotos.length > 0) && (
        <div className="space-y-2.5 mb-3">
          {photoRow("Your proof", myPhotos)}
          {photoRow(`@${other.username}'s proof`, theirPhotos)}
        </div>
      )}
      {room > 0 ? (
        <>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full border border-border bg-card text-foreground font-display font-semibold text-sm px-5 py-2.5 rounded-full flex items-center justify-center gap-1.5 hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
          >
            <ImagePlus size={14} /> {uploading ? "Adding…" : "Add proof photos"}
          </button>
          <p className="text-[11px] text-muted-foreground text-center mt-1.5">
            Up to 4 photos — packed item, receipt, tracking label.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              void onFiles(files);
            }}
          />
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground text-center">
          Your proof is maxed out at 4 photos.
        </p>
      )}
    </div>
  );
}

// ─── Fulfillment panel ────────────────────────────────────────────────────────

function TrackingReference({ carrier, tracking }: { carrier?: ShippingCarrier; tracking: string }) {
  const label = carrier ? SHIPPING_CARRIER_LABELS[carrier] : "Tracking";
  const url = carrierTrackingUrl(carrier, tracking);
  const content = <>{label} #{tracking}</>;
  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 hover:text-accent"
    >
      {content}
    </a>
  ) : content;
}

export function FulfillmentPanel({ deal, me, other }: { deal: Deal; me: User; other: User }) {
  const store = useStore();
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState<ShippingCarrier>("usps");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeOpen, setDisputeOpen] = useState(false);

  const mine = deal.fulfillment[me.id];
  const theirs = deal.fulfillment[other.id];
  const handoffWording = deal.kind !== "trade";
  const shipmentStarted = Object.values(deal.fulfillment).some(
    (side) => side.shippedAt || side.receivedAt,
  );

  const ship = () => {
    const res = store.markShipped(deal.id, tracking, tracking.trim() ? carrier : undefined);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Marked shipped 📦");
    setTracking("");
  };

  const confirm = () => {
    const res = store.confirmComplete(deal.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.value.completed) {
      toast.success("Deal complete 🎉");
    } else {
      toast.success(`Confirmed — waiting on @${other.username}`);
    }
  };

  const cancel = () => {
    const res = store.cancelDeal(deal.id, cancelReason);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Deal cancelled");
    setCancelOpen(false);
  };

  const dispute = () => {
    const res = store.openDispute(deal.id, disputeReason);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Dispute opened — moderators will review");
    setDisputeOpen(false);
  };

  const sideStatus = (user: User, f: typeof mine, isMe: boolean) => (
    <div className="flex items-start gap-3 py-2.5">
      <div className="w-9 h-9 rounded-full overflow-hidden border border-border flex-shrink-0">
        <img src={user.avatar} alt={user.displayName} className="w-full h-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          @{user.username}
          {isMe && <span className="text-muted-foreground font-normal"> (you)</span>}
        </p>
        <p className={cn("text-xs mt-0.5", f?.shippedAt ? "text-accent" : "text-muted-foreground")}>
          {f?.shippedAt ? (
            <>
              <Truck size={11} className="inline mr-1 -mt-0.5" />
              Shipped {timeAgo(f.shippedAt)}
              {f.tracking && (
                <span className="text-muted-foreground">
                  {" · "}
                  <TrackingReference carrier={f.carrier} tracking={f.tracking} />
                </span>
              )}
            </>
          ) : (
            "Not shipped yet"
          )}
        </p>
        <p className={cn("text-xs mt-0.5", f?.receivedAt ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
          {f?.receivedAt ? (
            <>
              <CheckCircle2 size={11} className="inline mr-1 -mt-0.5" />
              Confirmed complete {timeAgo(f.receivedAt)}
            </>
          ) : (
            "Not confirmed yet"
          )}
        </p>
      </div>
    </div>
  );

  return (
    <div className="rounded-xl border border-accent/40 bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Handshake size={16} className="text-accent" />
        <h3 className="font-display font-bold text-sm text-foreground">
          Deal agreed — time to deliver
        </h3>
      </div>
      <p className="text-xs text-muted-foreground mb-2">
        Items are reserved. Ship or hand off your end, then confirm when yours arrives.
      </p>
      <div className="divide-y divide-border mb-3">
        {sideStatus(me, mine, true)}
        {sideStatus(other, theirs, false)}
      </div>

      {!mine?.shippedAt && (
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="shipping-carrier">Shipping carrier</label>
            <select
              id="shipping-carrier"
              value={carrier}
              onChange={(event) => setCarrier(event.target.value as ShippingCarrier)}
              className="bg-surface border border-border rounded-full px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
              aria-label="Shipping carrier"
            >
              <option value="usps">USPS</option>
              <option value="ups">UPS</option>
              <option value="fedex">FedEx</option>
              <option value="dhl">DHL</option>
              <option value="other">Other</option>
            </select>
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="Tracking # (optional)"
              aria-label="Tracking number"
              className="flex-1 bg-surface border border-border rounded-full px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors"
            />
            <button
              type="button"
              onClick={ship}
              className="flex-shrink-0 bg-card border border-accent text-accent font-display font-semibold text-sm px-4 py-2.5 rounded-full flex items-center gap-1.5"
            >
              <Package size={14} /> Mark shipped
            </button>
          </div>
        </div>
      )}

      {!mine?.receivedAt ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              className="w-full bg-accent text-accent-foreground font-display font-semibold text-sm px-5 py-2.5 rounded-full shadow-sm flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={16} /> Confirm complete
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm your end is done?</AlertDialogTitle>
              <AlertDialogDescription>
                {handoffWording
                  ? "Confirm you've received / handed off your end of this deal. Once both sides confirm, the deal completes and ratings unlock."
                  : "Confirm you've received their end of the trade. Once both sides confirm, the deal completes and ratings unlock."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Not yet</AlertDialogCancel>
              <AlertDialogAction onClick={confirm}>Confirm</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <div className="rounded-lg bg-surface border border-border px-3 py-2.5 text-sm text-muted-foreground text-center">
          You&apos;ve confirmed — waiting on @{other.username}.
        </div>
      )}

      <div className="border-t border-border mt-3 pt-3">
        <ProofSection deal={deal} me={me} other={other} />
      </div>

      <div className="flex items-center justify-center gap-4 mt-3">
        {!shipmentStarted ? <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <DialogTrigger asChild>
            <button type="button" className="text-xs text-muted-foreground hover:text-orange-700 dark:hover:text-orange-400 transition-colors flex items-center gap-1">
              <Ban size={12} /> Cancel deal
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel this deal?</DialogTitle>
              <DialogDescription>
                Reserved items go back on the market. The other side gets notified — repeated backouts hurt your rep.
              </DialogDescription>
            </DialogHeader>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason (at least 10 characters)"
              maxLength={500}
              rows={2}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors resize-none"
            />
            <button
              type="button"
              onClick={cancel}
              disabled={cancelReason.trim().length < 10}
              className="w-full bg-orange-600/10 border border-orange-600 text-orange-700 dark:bg-orange-400/15 dark:border-orange-400 dark:text-orange-400 font-display font-semibold text-sm px-5 py-2.5 rounded-full disabled:opacity-40"
            >
              Cancel the deal
            </button>
          </DialogContent>
        </Dialog> : (
          <span className="text-xs text-muted-foreground">Shipping started—use Report a problem</span>
        )}

        <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
          <DialogTrigger asChild>
            <button type="button" className="text-xs text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors flex items-center gap-1">
              <ShieldAlert size={12} /> Report a problem
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report a problem</DialogTitle>
              <DialogDescription>
                Item never showed, not as described, gone quiet? Open a dispute and moderators will step in.
              </DialogDescription>
            </DialogHeader>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Describe what went wrong"
              rows={3}
              maxLength={2000}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors resize-none"
            />
            <button
              type="button"
              onClick={dispute}
              disabled={disputeReason.trim().length < 20}
              className="w-full bg-red-600/10 border border-red-600 text-red-600 dark:bg-red-400/15 dark:border-red-400 dark:text-red-400 font-display font-semibold text-sm px-5 py-2.5 rounded-full disabled:opacity-40"
            >
              Open dispute
            </button>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
