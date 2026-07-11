"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Flag,
  Gavel,
  LayoutGrid,
  Package,
  ShieldAlert,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store-context";
import { Hydrated } from "@/components/hydrated";
import { DealStatusBadge } from "@/components/deal-status-badge";
import { formatMonthYear, timeAgo } from "@/lib/format";
import { LISTING_STATUS_LABELS } from "@/lib/constants";
import type { Deal, Listing, Report } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/* ── Small shared pieces ─────────────────────────────────────────────────── */

function SectionHeading({
  icon: Icon,
  title,
  count,
}: {
  icon: React.ElementType;
  title: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={16} className="text-accent" strokeWidth={2.5} />
      <h2 className="font-display font-bold uppercase tracking-wider text-base text-foreground">
        {title}
      </h2>
      {count !== undefined && count > 0 && (
        <span className="badge-stamp text-accent border-accent">{count}</span>
      )}
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

const REPORT_STATUS_STAMP: Record<Report["status"], { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "text-yellow-400 border-yellow-400" },
  resolved: { label: "Resolved", cls: "text-emerald-400 border-emerald-400" },
  dismissed: { label: "Dismissed", cls: "text-muted-foreground border-border" },
};

/* ── 1. Stats grid ───────────────────────────────────────────────────────── */

function StatsSection() {
  const store = useStore();
  const s = store.adminStats();
  const tiles: { label: string; value: number; tone?: "warn" | "alert" }[] = [
    { label: "Members", value: s.users },
    { label: "Verified", value: s.verifiedUsers },
    { label: "Active listings", value: s.activeListings },
    { label: "ISO posts", value: s.isoPosts },
    { label: "Ratings", value: s.ratings },
    { label: "Deals open", value: s.dealsOpen },
    { label: "Deals agreed", value: s.dealsAccepted },
    { label: "Completed", value: s.dealsCompleted },
    { label: "Disputed", value: s.dealsDisputed, tone: s.dealsDisputed > 0 ? "alert" : undefined },
    {
      label: "Pending reports",
      value: s.pendingReports,
      tone: s.pendingReports > 0 ? "warn" : undefined,
    },
  ];
  return (
    <section>
      <SectionHeading icon={LayoutGrid} title="The State of the Land" />
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {tiles.map((t) => (
          <div
            key={t.label}
            className={cn(
              "bg-card border border-border rounded-lg p-3",
              t.tone === "alert" && "border-red-400/50",
              t.tone === "warn" && "border-yellow-400/50",
            )}
          >
            <p
              className={cn(
                "font-display font-bold text-2xl leading-none",
                t.tone === "alert"
                  ? "text-red-400"
                  : t.tone === "warn"
                    ? "text-yellow-400"
                    : "text-foreground",
              )}
            >
              {t.value}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1.5 font-medium">
              {t.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── 2. Reports queue ────────────────────────────────────────────────────── */

type ResolveAction = "remove-listing" | "warn-user" | "dismiss";

const RESOLVE_COPY: Record<
  ResolveAction,
  { title: string; description: string; cta: string; destructive?: boolean }
> = {
  "remove-listing": {
    title: "Remove listing",
    description:
      "The listing comes down, open negotiations on it close, and the seller is notified.",
    cta: "Remove it",
    destructive: true,
  },
  "warn-user": {
    title: "Warn user",
    description: "Sends a community-guidelines warning to the user behind this report.",
    cta: "Send warning",
  },
  dismiss: {
    title: "Dismiss report",
    description: "No action taken. The report is filed away as handled.",
    cta: "Dismiss",
  },
};

function ReportTarget({ report }: { report: Report }) {
  const store = useStore();
  if (report.targetType === "listing") {
    const listing = store.getListing(report.targetId);
    if (!listing)
      return <p className="text-xs text-muted-foreground">Listing no longer exists.</p>;
    return (
      <Link
        href={`/app/listings/${listing.id}`}
        className="flex items-center gap-2.5 group min-w-0"
      >
        <img
          src={listing.photos[0] || "/placeholder.jpg"}
          alt=""
          className="w-10 h-10 rounded object-cover border border-border shrink-0"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate group-hover:text-accent transition-colors">
            {listing.title}
          </p>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Listing · {LISTING_STATUS_LABELS[listing.status]} · {listing.seller.username}
          </p>
        </div>
      </Link>
    );
  }
  if (report.targetType === "user") {
    const user = store.getUser(report.targetId);
    if (!user) return <p className="text-xs text-muted-foreground">User no longer exists.</p>;
    return (
      <Link href={`/app/u/${user.username}`} className="flex items-center gap-2.5 group min-w-0">
        <img
          src={user.avatar}
          alt=""
          className="w-10 h-10 rounded-full object-cover border border-border shrink-0"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate group-hover:text-accent transition-colors">
            {user.username}
          </p>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            User · {user.displayName}
          </p>
        </div>
      </Link>
    );
  }
  const deal = store.getDeal(report.targetId);
  if (!deal) return <p className="text-xs text-muted-foreground">Deal no longer exists.</p>;
  return (
    <Link href={`/app/trades/${deal.id}`} className="flex items-center gap-2.5 group min-w-0">
      <img
        src={deal.listing.photos[0] || "/placeholder.jpg"}
        alt=""
        className="w-10 h-10 rounded object-cover border border-border shrink-0"
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground truncate group-hover:text-accent transition-colors">
          {deal.listing.title}
        </p>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground truncate">
          Deal · {deal.proposer.username} ⇄ {deal.owner.username}
        </p>
      </div>
    </Link>
  );
}

function ReportRow({
  report,
  onAction,
}: {
  report: Report;
  onAction?: (report: Report, action: ResolveAction) => void;
}) {
  const store = useStore();
  const reporter = store.getUser(report.reporterId);
  const stamp = REPORT_STATUS_STAMP[report.status];
  return (
    <div className="bg-card border border-border rounded-lg p-3.5 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <ReportTarget report={report} />
        <span className={cn("badge-stamp shrink-0", stamp.cls)}>{stamp.label}</span>
      </div>
      <div className="text-sm">
        <p className="font-bold text-foreground">{report.reason}</p>
        {report.details && (
          <p className="text-muted-foreground mt-0.5 leading-snug">{report.details}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1.5">
          Reported by{" "}
          {reporter ? (
            <Link
              href={`/app/u/${reporter.username}`}
              className="text-foreground hover:text-accent transition-colors font-medium"
            >
              {reporter.username}
            </Link>
          ) : (
            "an ex-member"
          )}{" "}
          · {timeAgo(report.createdAt)}
        </p>
      </div>
      {report.status === "pending" && onAction && (
        <div className="flex flex-wrap gap-2 pt-1">
          {report.targetType === "listing" && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onAction(report, "remove-listing")}
            >
              Remove listing
            </Button>
          )}
          {report.targetType !== "deal" && (
            <Button
              size="sm"
              variant="outline"
              className="text-yellow-400 border-yellow-400/40 hover:text-yellow-400"
              onClick={() => onAction(report, "warn-user")}
            >
              Warn user
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onAction(report, "dismiss")}>
            Dismiss
          </Button>
          {report.targetType === "deal" && (
            <span className="text-[11px] text-muted-foreground self-center">
              Settle the deal itself under Disputed Deals below.
            </span>
          )}
        </div>
      )}
      {report.status !== "pending" && (
        <p className="text-xs text-muted-foreground border-t border-border pt-2">
          Resolution: <span className="text-foreground">{report.resolution ?? "—"}</span>
          {report.resolvedAt ? ` · ${timeAgo(report.resolvedAt)}` : ""}
        </p>
      )}
    </div>
  );
}

function ReportsSection() {
  const store = useStore();
  const [resolving, setResolving] = useState<{ report: Report; action: ResolveAction } | null>(
    null,
  );
  const [note, setNote] = useState("");

  const pending = store.listReports("pending");
  const handled = store.listReports().filter((r) => r.status !== "pending");

  const openAction = (report: Report, action: ResolveAction) => {
    setNote("");
    setResolving({ report, action });
  };

  const confirm = () => {
    if (!resolving) return;
    const res = store.resolveReport(
      resolving.report.id,
      resolving.action,
      note.trim() || undefined,
    );
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      resolving.action === "remove-listing"
        ? "Listing removed and seller notified"
        : resolving.action === "warn-user"
          ? "Warning sent"
          : "Report dismissed",
    );
    setResolving(null);
  };

  const copy = resolving ? RESOLVE_COPY[resolving.action] : null;

  return (
    <section>
      <SectionHeading icon={Flag} title="Reports Queue" count={pending.length} />
      <Tabs defaultValue="pending">
        <TabsList className="mb-2">
          <TabsTrigger value="pending">
            Pending{pending.length > 0 ? ` (${pending.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="handled">
            Handled{handled.length > 0 ? ` (${handled.length})` : ""}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="space-y-2">
          {pending.length === 0 ? (
            <EmptyRow>Queue&apos;s clear. The community polices itself. Mostly.</EmptyRow>
          ) : (
            pending.map((r) => <ReportRow key={r.id} report={r} onAction={openAction} />)
          )}
        </TabsContent>
        <TabsContent value="handled" className="space-y-2">
          {handled.length === 0 ? (
            <EmptyRow>Nothing handled yet. Get to work, mod.</EmptyRow>
          ) : (
            handled.map((r) => <ReportRow key={r.id} report={r} />)
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!resolving} onOpenChange={(open) => !open && setResolving(null)}>
        <DialogContent className="max-w-sm bg-card border-border">
          {resolving && copy && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display font-bold uppercase tracking-wide">
                  {copy.title}
                </DialogTitle>
                <DialogDescription>{copy.description}</DialogDescription>
              </DialogHeader>
              <div className="py-1">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note — goes in the record (and to the user, if they're being warned or removed)."
                  rows={3}
                  className="bg-surface resize-none"
                />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setResolving(null)}>
                  Cancel
                </Button>
                <Button
                  variant={copy.destructive ? "destructive" : "default"}
                  className={
                    copy.destructive
                      ? undefined
                      : "bg-accent text-accent-foreground hover:bg-accent/90"
                  }
                  onClick={confirm}
                >
                  {copy.cta}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ── 3. Disputed deals ───────────────────────────────────────────────────── */

function DisputesSection() {
  const store = useStore();
  const disputes = store.disputedDeals();
  const [resolving, setResolving] = useState<{
    deal: Deal;
    outcome: "cancelled" | "completed";
  } | null>(null);
  const [note, setNote] = useState("");

  const openResolve = (deal: Deal, outcome: "cancelled" | "completed") => {
    setNote("");
    setResolving({ deal, outcome });
  };

  const confirm = () => {
    if (!resolving) return;
    const res = store.resolveDispute(resolving.deal.id, resolving.outcome, note.trim() || undefined);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      resolving.outcome === "cancelled"
        ? "Deal cancelled — items released back to the market"
        : "Deal force-completed",
    );
    setResolving(null);
  };

  return (
    <section>
      <SectionHeading icon={Gavel} title="Disputed Deals" count={disputes.length} />
      {disputes.length === 0 ? (
        <EmptyRow>No open disputes. Peace in the land.</EmptyRow>
      ) : (
        <div className="space-y-2">
          {disputes.map((deal) => (
            <div key={deal.id} className="bg-card border border-red-400/40 rounded-lg p-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/app/trades/${deal.id}`}
                  className="flex items-center gap-2.5 group min-w-0"
                >
                  <img
                    src={deal.listing.photos[0] || "/placeholder.jpg"}
                    alt=""
                    className="w-10 h-10 rounded object-cover border border-border shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate group-hover:text-accent transition-colors">
                      {deal.listing.title}
                    </p>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground truncate">
                      {deal.proposer.username} ⇄ {deal.owner.username}
                    </p>
                  </div>
                </Link>
                <DealStatusBadge status={deal.status} className="shrink-0" />
              </div>
              {deal.disputeReason && (
                <p className="text-sm text-muted-foreground leading-snug">
                  <span className="font-bold text-red-400">Dispute:</span> {deal.disputeReason}
                </p>
              )}
              <p className="text-xs text-muted-foreground">Updated {timeAgo(deal.updatedAt)}</p>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => openResolve(deal, "cancelled")}
                >
                  Cancel deal
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-accent border-accent/40 hover:text-accent"
                  onClick={() => openResolve(deal, "completed")}
                >
                  Force complete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!resolving} onOpenChange={(open) => !open && setResolving(null)}>
        <DialogContent className="max-w-sm bg-card border-border">
          {resolving && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display font-bold uppercase tracking-wide">
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
                  placeholder="Optional note for both parties."
                  rows={3}
                  className="bg-surface resize-none"
                />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setResolving(null)}>
                  Back
                </Button>
                <Button
                  variant={resolving.outcome === "cancelled" ? "destructive" : "default"}
                  className={
                    resolving.outcome === "cancelled"
                      ? undefined
                      : "bg-accent text-accent-foreground hover:bg-accent/90"
                  }
                  onClick={confirm}
                >
                  {resolving.outcome === "cancelled" ? "Cancel the deal" : "Complete the deal"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ── 4. Users ────────────────────────────────────────────────────────────── */

function UsersSection() {
  const store = useStore();
  const users = store.listUsers();

  const toggleVerified = (userId: string, username: string, verified: boolean) => {
    const res = store.setUserVerified(userId, verified);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(verified ? `${username} is now verified` : `Verification pulled from ${username}`);
  };

  return (
    <section>
      <SectionHeading icon={Users} title="Members" />
      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 px-3.5 py-3">
            <Link href={`/app/u/${u.username}`} className="shrink-0">
              <img
                src={u.avatar}
                alt={u.displayName}
                className="w-9 h-9 rounded-full object-cover border border-border"
              />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground flex items-center gap-1 min-w-0">
                <Link
                  href={`/app/u/${u.username}`}
                  className="truncate hover:text-accent transition-colors"
                >
                  {u.username}
                </Link>
                {u.isVerified && (
                  <BadgeCheck size={14} className="text-accent shrink-0" strokeWidth={2.5} />
                )}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                <Star size={10} className="inline fill-yellow-400 text-yellow-400 -mt-0.5" />{" "}
                {u.trustScore.toFixed(1)} · {u.tradesCompleted} trades · since{" "}
                {formatMonthYear(u.memberSince)}
              </p>
            </div>
            <label className="flex items-center gap-2 shrink-0 cursor-pointer">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium hidden sm:inline">
                Verified
              </span>
              <Switch
                checked={u.isVerified}
                onCheckedChange={(v) => toggleVerified(u.id, u.username, v)}
                className="data-[state=checked]:bg-accent"
                aria-label={`Verify ${u.username}`}
              />
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── 5. Listings ─────────────────────────────────────────────────────────── */

function ListingsSection() {
  const store = useStore();
  const listings = store
    .listListings({
      statuses: ["active", "pending"],
      sort: "newest",
      includeOwn: true,
      includeBlocked: true,
    })
    .slice(0, 10);
  const [removeTarget, setRemoveTarget] = useState<Listing | null>(null);
  const [reason, setReason] = useState("");

  const toggleFeatured = (listing: Listing, featured: boolean) => {
    const res = store.setListingFeatured(listing.id, featured);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(featured ? `"${listing.title}" is now featured` : "Pulled from featured");
  };

  const confirmRemove = () => {
    if (!removeTarget) return;
    const res = store.removeListing(removeTarget.id, {
      byAdmin: true,
      reason: reason.trim() || undefined,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Listing removed and seller notified");
    setRemoveTarget(null);
  };

  return (
    <section>
      <SectionHeading icon={Package} title="Recent Listings" />
      {listings.length === 0 ? (
        <EmptyRow>No live listings. A quiet marketplace is a suspicious marketplace.</EmptyRow>
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border">
          {listings.map((l) => (
            <div key={l.id} className="flex items-center gap-3 px-3.5 py-3">
              <Link href={`/app/listings/${l.id}`} className="shrink-0">
                <img
                  src={l.photos[0] || "/placeholder.jpg"}
                  alt=""
                  className="w-10 h-10 rounded object-cover border border-border"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/app/listings/${l.id}`}
                  className="text-sm font-semibold text-foreground truncate block hover:text-accent transition-colors"
                >
                  {l.title}
                </Link>
                <p className="text-xs text-muted-foreground truncate">
                  {l.seller.username} · {timeAgo(l.createdAt)}
                  {l.status === "pending" && (
                    <span className="text-yellow-400"> · deal pending</span>
                  )}
                </p>
              </div>
              <label className="flex items-center gap-1.5 shrink-0 cursor-pointer" title="Featured on the front page">
                <Star
                  size={13}
                  className={cn(
                    l.isFeatured ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground",
                  )}
                />
                <Switch
                  checked={!!l.isFeatured}
                  onCheckedChange={(v) => toggleFeatured(l, v)}
                  className="data-[state=checked]:bg-accent"
                  aria-label={`Feature ${l.title}`}
                />
              </label>
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 text-muted-foreground hover:text-red-400"
                aria-label={`Remove ${l.title}`}
                onClick={() => {
                  setReason("");
                  setRemoveTarget(l);
                }}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent className="max-w-sm bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display font-bold uppercase tracking-wide">
              Remove &quot;{removeTarget?.title}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              It disappears from the marketplace, open negotiations on it close, and the seller
              gets notified with your reason.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional) — the seller sees this."
            rows={3}
            className="bg-surface resize-none"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmRemove}
            >
              Remove listing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/* ── Skeleton fallback ───────────────────────────────────────────────────── */

function AdminSkeleton() {
  return (
    <div className="space-y-10 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-16 bg-card border border-border rounded-lg" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-5 w-40 bg-card rounded" />
          <div className="h-24 bg-card border border-border rounded-lg" />
          <div className="h-24 bg-card border border-border rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur-sm border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/app"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <ArrowLeft size={16} />
              Back to app
            </Link>
            <span className="text-border">/</span>
            <h1 className="font-display font-bold uppercase tracking-wider text-lg text-foreground flex items-center gap-1.5 truncate">
              <ShieldAlert size={18} className="text-accent shrink-0" />
              Mod Desk
            </h1>
          </div>
          <span className="badge-stamp text-accent border-accent hidden sm:inline-flex shrink-0">
            Demo mode
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 pb-16 space-y-10">
        <p className="text-xs text-muted-foreground -mt-2">
          Demo mode: every visitor is a moderator. With great power, et cetera.
        </p>
        <Hydrated fallback={<AdminSkeleton />}>
          <StatsSection />
          <ReportsSection />
          <DisputesSection />
          <UsersSection />
          <ListingsSection />
        </Hydrated>
      </main>
    </div>
  );
}
