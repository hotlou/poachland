"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  Clock,
  ExternalLink,
  EyeOff,
  Flag,
  Gavel,
  Handshake,
  IdCard,
  ImagePlus,
  LayoutGrid,
  Megaphone,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  ShieldAlert,
  Star,
  Store,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { dispatchOp, fetchAdminData } from "@/app/actions/engine";
import { useAsUser } from "@/app/actions/auth";
import type { AdminData, OpMap, OpName } from "@/lib/shared/ops";
import { useHydrated, useStore } from "@/lib/store-context";
import type { RemotePoachStore } from "@/lib/remote-store";
import { DealStatusBadge } from "@/components/deal-status-badge";
import { IDENTITY_PROVIDER_META, IDENTITY_STATUS_META } from "@/components/identity-chips";
import { formatDate, formatMonthYear, timeAgo } from "@/lib/format";
import { LISTING_STATUS_LABELS } from "@/lib/constants";
import { fileToDataUrl } from "@/lib/image";
import type {
  DealRecord,
  IdentityRecord,
  Listing,
  Partner,
  PartnerCategory,
  Report,
  UserStatus,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

/**
 * Run an admin op against the server, then refresh both the admin view and
 * the shared world snapshot. Returns true on success.
 */
async function runAdminOp<K extends OpName>(
  store: RemotePoachStore,
  reload: () => Promise<void>,
  op: K,
  payload: OpMap[K],
): Promise<boolean> {
  try {
    const result = await dispatchOp(op, payload);
    if (!result.ok) {
      toast.error(result.error);
      if (result.snapshot) store.applySnapshot(result.snapshot);
      return false;
    }
    store.applySnapshot(result.snapshot);
    await reload();
    return true;
  } catch (error) {
    console.error(`[admin] ${op} failed`, error);
    toast.error("Couldn't reach the server. Try again.");
    return false;
  }
}

type AdminUser = AdminData["users"][number];

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
      <Icon size={15} className="text-accent" strokeWidth={2.5} />
      <h2 className="font-display font-bold uppercase tracking-[0.14em] text-xs text-muted-foreground">
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
    <div className="bg-card border border-border rounded-xl px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

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

const REPORT_STATUS_STAMP: Record<Report["status"], { label: string; cls: string }> = {
  pending: {
    label: "Pending",
    cls: "text-amber-700 border-amber-700 dark:text-yellow-400 dark:border-yellow-400",
  },
  resolved: {
    label: "Resolved",
    cls: "text-emerald-700 border-emerald-700 dark:text-emerald-400 dark:border-emerald-400",
  },
  dismissed: { label: "Dismissed", cls: "text-muted-foreground border-border" },
};

/** Moderation status → quiet chip. `active` shows nothing (kept off the roster). */
const USER_STATUS_CHIP: Record<Exclude<UserStatus, "active">, { label: string; cls: string }> = {
  shadowbanned: {
    label: "Shadowbanned",
    cls: "text-purple-700 border-purple-700/50 dark:text-purple-400 dark:border-purple-400/50",
  },
  suspended: {
    label: "Suspended",
    cls: "text-amber-700 border-amber-700/50 dark:text-yellow-400 dark:border-yellow-400/50",
  },
  banned: {
    label: "Banned",
    cls: "text-red-700 border-red-700/50 dark:text-red-400 dark:border-red-400/50",
  },
};

/* ── 1. Stats grid ───────────────────────────────────────────────────────── */

function StatsSection({ stats }: { stats: AdminData["stats"] }) {
  const tiles: { label: string; value: number; tone?: "warn" | "alert" }[] = [
    { label: "Members", value: stats.users },
    { label: "Verified", value: stats.verifiedUsers },
    { label: "Active listings", value: stats.activeListings },
    { label: "ISO posts", value: stats.isoPosts },
    { label: "Ratings", value: stats.ratings },
    { label: "Deals open", value: stats.dealsOpen },
    { label: "Deals agreed", value: stats.dealsAccepted },
    { label: "Completed", value: stats.dealsCompleted },
    {
      label: "Disputed",
      value: stats.dealsDisputed,
      tone: stats.dealsDisputed > 0 ? "alert" : undefined,
    },
    {
      label: "Pending reports",
      value: stats.pendingReports,
      tone: stats.pendingReports > 0 ? "warn" : undefined,
    },
    {
      label: "Identity queue",
      value: stats.pendingIdentities,
      tone: stats.pendingIdentities > 0 ? "warn" : undefined,
    },
    { label: "Messages", value: stats.messages },
  ];
  return (
    <section>
      <SectionHeading icon={LayoutGrid} title="The state of the land" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {tiles.map((t) => (
          <div
            key={t.label}
            className={cn(
              "bg-card border border-border rounded-xl p-3",
              t.tone === "alert" && "border-red-700/50 dark:border-red-400/50",
              t.tone === "warn" && "border-amber-700/50 dark:border-yellow-400/50",
            )}
          >
            <p
              className={cn(
                "font-display font-bold text-2xl leading-none",
                t.tone === "alert"
                  ? "text-red-700 dark:text-red-400"
                  : t.tone === "warn"
                    ? "text-amber-700 dark:text-yellow-400"
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

/* ── 2. Identity review queue ────────────────────────────────────────────── */

function IdentityQueueSection({
  queue,
  findUser,
  onReview,
}: {
  queue: IdentityRecord[];
  findUser: (id: string) => AdminUser | undefined;
  onReview: (
    identity: IdentityRecord,
    status: "verified" | "rejected",
    note?: string,
  ) => Promise<boolean>;
}) {
  const [reviewing, setReviewing] = useState<{
    identity: IdentityRecord;
    status: "verified" | "rejected";
  } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const open = (identity: IdentityRecord, status: "verified" | "rejected") => {
    setNote("");
    setReviewing({ identity, status });
  };

  const confirm = async () => {
    if (!reviewing || busy) return;
    setBusy(true);
    const ok = await onReview(reviewing.identity, reviewing.status, note.trim() || undefined);
    setBusy(false);
    if (ok) {
      toast.success(
        reviewing.status === "verified" ? "Identity verified" : "Identity rejected",
      );
      setReviewing(null);
    }
  };

  return (
    <section>
      <SectionHeading icon={IdCard} title="Identity review queue" count={queue.length} />
      {queue.length === 0 ? (
        <EmptyRow>No identities waiting on review.</EmptyRow>
      ) : (
        <div className="space-y-2">
          {queue.map((identity) => {
            const meta = IDENTITY_PROVIDER_META[identity.provider];
            const status = IDENTITY_STATUS_META[identity.status];
            const Icon = meta.icon;
            const user = findUser(identity.userId);
            return (
              <div
                key={identity.id}
                className="bg-card border border-border rounded-xl p-3.5 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center flex-shrink-0 text-muted-foreground">
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        @{identity.handle}
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          · {meta.label}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user ? (
                          <Link
                            href={`/app/u/${user.username}`}
                            className="hover:text-accent transition-colors"
                          >
                            {user.username}
                          </Link>
                        ) : (
                          "unknown user"
                        )}{" "}
                        · submitted {timeAgo(identity.submittedAt)}
                      </p>
                    </div>
                  </div>
                  <span className={cn("badge-stamp shrink-0", status.cls)}>{status.label}</span>
                </div>
                {identity.url && (
                  <a
                    href={identity.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                  >
                    <ExternalLink size={11} /> {identity.url}
                  </a>
                )}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
                    onClick={() => open(identity, "verified")}
                  >
                    Verify
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full text-red-700 border-red-700/40 hover:text-red-700 dark:text-red-400 dark:border-red-400/40 dark:hover:text-red-400"
                    onClick={() => open(identity, "rejected")}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent className="max-w-sm bg-card border-border">
          {reviewing && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display font-bold tracking-tight">
                  {reviewing.status === "verified" ? "Verify identity" : "Reject identity"}
                </DialogTitle>
                <DialogDescription>
                  {reviewing.status === "verified"
                    ? `Marks @${reviewing.identity.handle} as a verified ${IDENTITY_PROVIDER_META[reviewing.identity.provider].label} identity. It shows with a check on the trader's profile.`
                    : `Rejects @${reviewing.identity.handle}. The trader sees the rejection on their settings page.`}
                </DialogDescription>
              </DialogHeader>
              <div className="py-1">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional reviewer note — goes on the record."
                  rows={3}
                  className="bg-surface resize-none"
                />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => setReviewing(null)}>
                  Cancel
                </Button>
                <Button
                  variant={reviewing.status === "rejected" ? "destructive" : "default"}
                  className={
                    reviewing.status === "rejected"
                      ? "rounded-full"
                      : "rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
                  }
                  disabled={busy}
                  onClick={() => void confirm()}
                >
                  {busy ? "Working…" : reviewing.status === "verified" ? "Verify" : "Reject"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ── 3. Reports queue ────────────────────────────────────────────────────── */

type ResolveAction = "remove-listing" | "warn-user" | "dismiss";

/** Quiet chip-style tab trigger — overrides the boxed shadcn segmented look. */
const chipTabCls =
  "flex-none h-auto rounded-full border border-border bg-card px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors " +
  "data-[state=active]:border-accent data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-sm " +
  "dark:data-[state=active]:border-accent dark:data-[state=active]:bg-accent dark:data-[state=active]:text-accent-foreground";

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

function ReportTarget({
  report,
  findUser,
  findDisputedDeal,
}: {
  report: Report;
  findUser: (id: string) => AdminUser | undefined;
  findDisputedDeal: (id: string) => DealRecord | undefined;
}) {
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
    const user = findUser(report.targetId);
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
  // Deal report: admin snapshots only include the admin's own deals, so fall
  // back to the disputed-deals feed for a record.
  const deal = findDisputedDeal(report.targetId) ?? store.getDeal(report.targetId);
  if (!deal) return <p className="text-xs text-muted-foreground">Deal not in view.</p>;
  const listing = store.getListing(deal.listingId);
  const proposer = findUser(deal.proposerId);
  const owner = findUser(deal.ownerId);
  return (
    <Link href={`/app/trades/${deal.id}`} className="flex items-center gap-2.5 group min-w-0">
      <img
        src={listing?.photos[0] || "/placeholder.jpg"}
        alt=""
        className="w-10 h-10 rounded object-cover border border-border shrink-0"
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground truncate group-hover:text-accent transition-colors">
          {listing?.title ?? "A deal"}
        </p>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground truncate">
          Deal · {proposer?.username ?? "?"} ⇄ {owner?.username ?? "?"}
        </p>
      </div>
    </Link>
  );
}

function ReportRow({
  report,
  findUser,
  findDisputedDeal,
  onAction,
}: {
  report: Report;
  findUser: (id: string) => AdminUser | undefined;
  findDisputedDeal: (id: string) => DealRecord | undefined;
  onAction?: (report: Report, action: ResolveAction) => void;
}) {
  const reporter = findUser(report.reporterId);
  const stamp = REPORT_STATUS_STAMP[report.status];
  return (
    <div className="bg-card border border-border rounded-xl p-3.5 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <ReportTarget report={report} findUser={findUser} findDisputedDeal={findDisputedDeal} />
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
              className="rounded-full"
              onClick={() => onAction(report, "remove-listing")}
            >
              Remove listing
            </Button>
          )}
          {report.targetType !== "deal" && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full text-amber-700 border-amber-700/40 hover:text-amber-700 dark:text-yellow-400 dark:border-yellow-400/40 dark:hover:text-yellow-400"
              onClick={() => onAction(report, "warn-user")}
            >
              Warn user
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() => onAction(report, "dismiss")}
          >
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

function ReportsSection({
  reports,
  findUser,
  findDisputedDeal,
  onResolve,
}: {
  reports: Report[];
  findUser: (id: string) => AdminUser | undefined;
  findDisputedDeal: (id: string) => DealRecord | undefined;
  onResolve: (report: Report, action: ResolveAction, note?: string) => Promise<boolean>;
}) {
  const [resolving, setResolving] = useState<{ report: Report; action: ResolveAction } | null>(
    null,
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const pending = reports.filter((r) => r.status === "pending");
  const handled = reports.filter((r) => r.status !== "pending");

  const openAction = (report: Report, action: ResolveAction) => {
    setNote("");
    setResolving({ report, action });
  };

  const confirm = async () => {
    if (!resolving || busy) return;
    setBusy(true);
    const ok = await onResolve(resolving.report, resolving.action, note.trim() || undefined);
    setBusy(false);
    if (ok) {
      toast.success(
        resolving.action === "remove-listing"
          ? "Listing removed and seller notified"
          : resolving.action === "warn-user"
            ? "Warning sent"
            : "Report dismissed",
      );
      setResolving(null);
    }
  };

  const copy = resolving ? RESOLVE_COPY[resolving.action] : null;

  return (
    <section>
      <SectionHeading icon={Flag} title="Reports queue" count={pending.length} />
      <Tabs defaultValue="pending">
        <TabsList className="mb-2 h-auto w-auto justify-start gap-2 rounded-none bg-transparent p-0 flex-wrap">
          <TabsTrigger value="pending" className={chipTabCls}>
            Pending{pending.length > 0 ? ` (${pending.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="handled" className={chipTabCls}>
            Handled{handled.length > 0 ? ` (${handled.length})` : ""}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="space-y-2">
          {pending.length === 0 ? (
            <EmptyRow>Queue&apos;s clear. The community polices itself. Mostly.</EmptyRow>
          ) : (
            pending.map((r) => (
              <ReportRow
                key={r.id}
                report={r}
                findUser={findUser}
                findDisputedDeal={findDisputedDeal}
                onAction={openAction}
              />
            ))
          )}
        </TabsContent>
        <TabsContent value="handled" className="space-y-2">
          {handled.length === 0 ? (
            <EmptyRow>Nothing handled yet. Get to work, mod.</EmptyRow>
          ) : (
            handled.map((r) => (
              <ReportRow
                key={r.id}
                report={r}
                findUser={findUser}
                findDisputedDeal={findDisputedDeal}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!resolving} onOpenChange={(open) => !open && setResolving(null)}>
        <DialogContent className="max-w-sm bg-card border-border">
          {resolving && copy && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display font-bold tracking-tight">
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
                <Button variant="outline" className="rounded-full" onClick={() => setResolving(null)}>
                  Cancel
                </Button>
                <Button
                  variant={copy.destructive ? "destructive" : "default"}
                  className={
                    copy.destructive
                      ? "rounded-full"
                      : "rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
                  }
                  disabled={busy}
                  onClick={() => void confirm()}
                >
                  {busy ? "Working…" : copy.cta}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ── 4. Disputed deals ───────────────────────────────────────────────────── */

function DisputesSection({
  disputes,
  findUser,
  onResolve,
}: {
  disputes: DealRecord[];
  findUser: (id: string) => AdminUser | undefined;
  onResolve: (
    deal: DealRecord,
    outcome: "cancelled" | "completed",
    note?: string,
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
    const ok = await onResolve(resolving.deal, resolving.outcome, note.trim() || undefined);
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
                  placeholder="Optional note for both parties."
                  rows={3}
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
                  disabled={busy}
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

/* ── 5. Users ────────────────────────────────────────────────────────────── */

/** Small quiet chip for a member's moderation standing. `active` → nothing. */
function UserStatusChip({ user }: { user: AdminUser }) {
  if (user.status === "active") return null;
  const meta = USER_STATUS_CHIP[user.status];
  const label =
    user.status === "suspended" && user.suspendedUntil
      ? `Suspended · until ${formatDate(user.suspendedUntil)}`
      : meta.label;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[13px] font-medium shrink-0",
        meta.cls,
      )}
    >
      {label}
    </span>
  );
}

type ModAction = "shadowban" | "suspend" | "ban";

function UsersSection({
  users,
  onSetVerified,
  onSetStatus,
}: {
  users: AdminUser[];
  onSetVerified: (userId: string, verified: boolean) => Promise<boolean>;
  onSetStatus: (
    userId: string,
    status: UserStatus,
    opts?: { days?: number; note?: string },
  ) => Promise<boolean>;
}) {
  const [modTarget, setModTarget] = useState<{ user: AdminUser; action: ModAction } | null>(null);
  const [days, setDays] = useState("7");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const toggleVerified = async (user: AdminUser, verified: boolean) => {
    const ok = await onSetVerified(user.id, verified);
    if (ok) {
      toast.success(
        verified
          ? `${user.username} is now verified`
          : `Verification pulled from ${user.username}`,
      );
    }
  };

  const openMod = (user: AdminUser, action: ModAction) => {
    setDays("7");
    setNote("");
    setModTarget({ user, action });
  };

  const restore = async (user: AdminUser) => {
    const ok = await onSetStatus(user.id, "active");
    if (ok) toast.success(`@${user.username} restored`);
  };

  const useAs = async (user: AdminUser) => {
    const res = await useAsUser(user.id);
    if (res.ok) {
      toast.success(`Now using Poachland as @${user.username}`);
      // Full navigation so the impersonated session bootstraps cleanly.
      window.location.assign("/app");
    } else {
      toast.error(res.error);
    }
  };

  const confirmMod = async () => {
    if (!modTarget || busy) return;
    const { user, action } = modTarget;
    setBusy(true);
    let ok = false;
    if (action === "shadowban") {
      ok = await onSetStatus(user.id, "shadowbanned");
    } else if (action === "suspend") {
      const parsed = Number.parseInt(days, 10);
      const d = Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
      ok = await onSetStatus(user.id, "suspended", { days: d, note: note.trim() || undefined });
    } else {
      ok = await onSetStatus(user.id, "banned", { note: note.trim() || undefined });
    }
    setBusy(false);
    if (ok) {
      toast.success(
        action === "shadowban"
          ? `@${user.username} shadowbanned`
          : action === "suspend"
            ? `@${user.username} suspended`
            : `@${user.username} banned`,
      );
      setModTarget(null);
    }
  };

  return (
    <section>
      <SectionHeading icon={Users} title="Members" />
      <div className="bg-card border border-border rounded-xl divide-y divide-border">
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
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 min-w-0 flex-wrap">
                <Link
                  href={`/app/u/${u.username}`}
                  className="truncate hover:text-accent transition-colors"
                >
                  {u.username}
                </Link>
                {u.isVerified && (
                  <BadgeCheck size={14} className="text-accent shrink-0" strokeWidth={2.5} />
                )}
                <UserStatusChip user={u} />
                {u.isAdmin && (
                  <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[13px] font-medium text-muted-foreground shrink-0">
                    Mod
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              <p className="text-xs text-muted-foreground truncate">
                <Star
                  size={10}
                  className="inline fill-amber-700 text-amber-700 dark:fill-yellow-400 dark:text-yellow-400 -mt-0.5"
                />{" "}
                {u.trustScore.toFixed(1)} · {u.tradesCompleted} trades · since{" "}
                {formatMonthYear(u.memberSince)}
              </p>
              {u.moderationNote && (
                <p className="text-xs text-muted-foreground/80 italic truncate mt-0.5">
                  {u.moderationNote}
                </p>
              )}
            </div>
            <label className="flex items-center gap-2 shrink-0 cursor-pointer">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium hidden sm:inline">
                Verified
              </span>
              <Switch
                checked={u.isVerified}
                onCheckedChange={(v) => void toggleVerified(u, v)}
                className="data-[state=checked]:bg-accent"
                aria-label={`Verify ${u.username}`}
              />
            </label>
            {!u.isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                    aria-label={`Moderate ${u.username}`}
                  >
                    <MoreHorizontal size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60 bg-card border-border">
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Moderation
                  </DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => openMod(u, "shadowban")}>
                    <EyeOff /> Shadowban
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => openMod(u, "suspend")}>
                    <Clock /> Suspend
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onSelect={() => openMod(u, "ban")}>
                    <Ban /> Ban
                  </DropdownMenuItem>
                  {u.status !== "active" && (
                    <DropdownMenuItem onSelect={() => void restore(u)}>
                      <RotateCcw /> Restore
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="flex-col items-start gap-0.5"
                    onSelect={() => void useAs(u)}
                  >
                    <span className="flex items-center gap-2">
                      <UserCog /> Use as @{u.username}
                    </span>
                    <span className="pl-6 text-[11px] text-muted-foreground">
                      View the app exactly as they see it. Exit anytime from the banner.
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ))}
      </div>

      {/* Shadowban / Suspend — reversible, accent-styled dialogs. */}
      <Dialog
        open={modTarget?.action === "shadowban" || modTarget?.action === "suspend"}
        onOpenChange={(o) => !o && setModTarget(null)}
      >
        <DialogContent className="max-w-sm bg-card border-border">
          {modTarget?.action === "shadowban" && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display font-bold tracking-tight">
                  Shadowban @{modTarget.user.username}?
                </DialogTitle>
                <DialogDescription>
                  Their listings, posts, and profile vanish for everyone else. They won&apos;t know.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => setModTarget(null)}>
                  Cancel
                </Button>
                <Button
                  className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={busy}
                  onClick={() => void confirmMod()}
                >
                  {busy ? "Working…" : "Shadowban"}
                </Button>
              </DialogFooter>
            </>
          )}
          {modTarget?.action === "suspend" && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display font-bold tracking-tight">
                  Suspend @{modTarget.user.username}?
                </DialogTitle>
                <DialogDescription>Locks them out with a notice until it lifts.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-1">
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground">Days</span>
                  <Input
                    type="number"
                    min={1}
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    className="mt-1 bg-surface"
                    aria-label="Suspension length in days"
                  />
                </label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note — the user sees this on their notice."
                  rows={3}
                  className="bg-surface resize-none"
                />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => setModTarget(null)}>
                  Cancel
                </Button>
                <Button
                  className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={busy}
                  onClick={() => void confirmMod()}
                >
                  {busy ? "Working…" : "Suspend"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Ban — permanent, destructive confirm. */}
      <AlertDialog
        open={modTarget?.action === "ban"}
        onOpenChange={(o) => !o && setModTarget(null)}
      >
        <AlertDialogContent className="max-w-sm bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display font-bold tracking-tight">
              Ban @{modTarget?.user.username}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Permanent. They see a banned notice and can&apos;t act. Content hidden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note — the user sees this on their notice."
            rows={3}
            className="bg-surface resize-none"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Keep them</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-white hover:bg-destructive/90"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault(); // keep the dialog open until the server answers
                void confirmMod();
              }}
            >
              {busy ? "Banning…" : "Ban user"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/* ── 6. Listings ─────────────────────────────────────────────────────────── */

function ListingsSection({
  onSetFeatured,
  onRemove,
}: {
  onSetFeatured: (id: string, featured: boolean) => Promise<boolean>;
  onRemove: (id: string, reason?: string) => Promise<boolean>;
}) {
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
  const [busy, setBusy] = useState(false);

  const toggleFeatured = async (listing: Listing, featured: boolean) => {
    const ok = await onSetFeatured(listing.id, featured);
    if (ok) {
      toast.success(featured ? `"${listing.title}" is now featured` : "Pulled from featured");
    }
  };

  const confirmRemove = async () => {
    if (!removeTarget || busy) return;
    setBusy(true);
    const ok = await onRemove(removeTarget.id, reason.trim() || undefined);
    setBusy(false);
    if (ok) {
      toast.success("Listing removed and seller notified");
      setRemoveTarget(null);
    }
  };

  return (
    <section>
      <SectionHeading icon={Package} title="Recent listings" />
      {listings.length === 0 ? (
        <EmptyRow>No live listings. A quiet marketplace is a suspicious marketplace.</EmptyRow>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
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
                    <span className="text-amber-700 dark:text-yellow-400"> · deal pending</span>
                  )}
                </p>
              </div>
              <label
                className="flex items-center gap-1.5 shrink-0 cursor-pointer"
                title="Featured on the front page"
              >
                <Star
                  size={13}
                  className={cn(
                    l.isFeatured
                      ? "fill-amber-700 text-amber-700 dark:fill-yellow-400 dark:text-yellow-400"
                      : "text-muted-foreground",
                  )}
                />
                <Switch
                  checked={!!l.isFeatured}
                  onCheckedChange={(v) => void toggleFeatured(l, v)}
                  className="data-[state=checked]:bg-accent"
                  aria-label={`Feature ${l.title}`}
                />
              </label>
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 rounded-full text-muted-foreground hover:text-red-700 dark:hover:text-red-400"
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
            <AlertDialogTitle className="font-display font-bold tracking-tight">
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
            <AlertDialogCancel className="rounded-full">Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-white hover:bg-destructive/90"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault(); // keep the dialog open until the server answers
                void confirmRemove();
              }}
            >
              {busy ? "Removing…" : "Remove listing"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/* ── 7. Partners (sponsors & vendors) ────────────────────────────────────── */

const PARTNER_CATEGORY_LABELS: Record<PartnerCategory, string> = {
  jerseys: "Jerseys",
  discs: "Discs",
  apparel: "Apparel",
  cleats: "Cleats",
  accessories: "Accessories",
  media: "Media",
  other: "Other",
};

const PARTNER_CATEGORIES = Object.keys(PARTNER_CATEGORY_LABELS) as PartnerCategory[];

const PARTNER_KIND_META: Record<Partner["kind"], { label: string; icon: React.ElementType }> = {
  sponsor: { label: "Sponsor", icon: Megaphone },
  vendor: { label: "Vendor", icon: Store },
};

type PartnerForm = {
  id?: string;
  kind: Partner["kind"];
  name: string;
  slug: string;
  tagline: string;
  description: string;
  logo: string;
  url: string;
  category: PartnerCategory;
  featured: boolean;
  active: boolean;
};

const EMPTY_PARTNER_FORM: PartnerForm = {
  kind: "sponsor",
  name: "",
  slug: "",
  tagline: "",
  description: "",
  logo: "",
  url: "",
  category: "other",
  featured: false,
  active: true,
};

/** Square logo tile — the partner's mark, or an initial fallback when none. */
function PartnerLogo({ logo, name, size = 40 }: { logo: string; name: string; size?: number }) {
  if (logo) {
    return (
      <img
        src={logo}
        alt={`${name || "Partner"} logo`}
        className="rounded-lg object-contain bg-surface border border-border shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-lg bg-surface border border-border flex items-center justify-center shrink-0 font-display font-bold text-muted-foreground"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </div>
  );
}

function PartnerKindBadge({ kind }: { kind: Partner["kind"] }) {
  const meta = PARTNER_KIND_META[kind];
  const Icon = meta.icon;
  return (
    <span className="badge-stamp shrink-0 inline-flex items-center gap-1 text-accent border-accent">
      <Icon size={10} strokeWidth={2.5} /> {meta.label}
    </span>
  );
}

function PartnersSection({
  partners,
  onChanged,
}: {
  partners: Partner[];
  onChanged: () => Promise<void>;
}) {
  const store = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<PartnerForm | null>(null); // null → form closed
  const [busy, setBusy] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Partner | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const editing = !!form?.id;

  const openAdd = () => setForm({ ...EMPTY_PARTNER_FORM });
  const openEdit = (p: Partner) =>
    setForm({
      id: p.id,
      kind: p.kind,
      name: p.name,
      slug: p.slug,
      tagline: p.tagline,
      description: p.description,
      logo: p.logo,
      url: p.url,
      category: p.category,
      featured: p.featured,
      active: p.active,
    });

  const patch = (v: Partial<PartnerForm>) => setForm((f) => (f ? { ...f, ...v } : f));

  const pickLogo = async (file: File) => {
    try {
      patch({ logo: await fileToDataUrl(file, 400) });
    } catch {
      toast.error("Couldn't read that image");
    }
  };

  const submit = async () => {
    if (!form || busy) return;
    const name = form.name.trim();
    if (!name) {
      toast.error("Give the partner a name");
      return;
    }
    setBusy(true);
    const res = store.upsertPartner({
      id: form.id,
      kind: form.kind,
      name,
      slug: form.slug.trim() || undefined,
      tagline: form.tagline.trim() || undefined,
      description: form.description.trim() || undefined,
      logo: form.logo || undefined,
      url: form.url.trim() || undefined,
      category: form.category,
      featured: form.featured,
      active: form.active,
    });
    if (!res.ok) {
      setBusy(false);
      toast.error(res.error);
      return;
    }
    await onChanged();
    setBusy(false);
    toast.success(editing ? `${res.value.name} updated` : `${res.value.name} added`);
    setForm(null);
  };

  const confirmRemove = async () => {
    if (!removeTarget || removeBusy) return;
    setRemoveBusy(true);
    const res = store.removePartner(removeTarget.id);
    if (!res.ok) {
      setRemoveBusy(false);
      toast.error(res.error);
      return;
    }
    await onChanged();
    setRemoveBusy(false);
    toast.success(`${removeTarget.name} removed`);
    setRemoveTarget(null);
  };

  const fieldLabel = "text-xs font-medium text-muted-foreground";

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <SectionHeading icon={Handshake} title="Partners" count={partners.length} />
        <Button
          size="sm"
          variant={form ? "outline" : "default"}
          className={cn(
            "rounded-full mb-3 shrink-0",
            !form && "bg-accent text-accent-foreground hover:bg-accent/90",
          )}
          onClick={() => (form ? setForm(null) : openAdd())}
        >
          {form ? "Close" : (
            <>
              <Plus size={15} /> Add partner
            </>
          )}
        </Button>
      </div>

      {/* Add / edit form */}
      {form && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3.5 mb-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-display font-bold tracking-tight text-sm text-foreground">
              {editing ? "Edit partner" : "New partner"}
            </p>
            {/* Kind — segmented sponsor / vendor toggle */}
            <div className="inline-flex rounded-full border border-border bg-surface p-0.5">
              {(Object.keys(PARTNER_KIND_META) as Partner["kind"][]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => patch({ kind: k })}
                  className={cn(
                    "rounded-full px-3 py-1 text-[13px] font-medium transition-colors",
                    form.kind === k
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {PARTNER_KIND_META[k].label}
                </button>
              ))}
            </div>
          </div>

          {/* Logo */}
          <div className="flex items-center gap-3">
            <PartnerLogo logo={form.logo} name={form.name} size={56} />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus size={14} /> {form.logo ? "Replace logo" : "Upload logo"}
              </Button>
              {form.logo && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="rounded-full text-muted-foreground hover:text-red-700 dark:hover:text-red-400"
                  onClick={() => patch({ logo: "" })}
                >
                  Remove
                </Button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void pickLogo(file);
              }}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={fieldLabel}>Name</span>
              <Input
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="e.g. VC Ultimate"
                className="mt-1 bg-surface"
              />
            </label>
            <label className="block">
              <span className={fieldLabel}>Slug</span>
              <Input
                value={form.slug}
                onChange={(e) => patch({ slug: e.target.value })}
                placeholder="Auto-derived from name if blank"
                className="mt-1 bg-surface"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Used at /vendors/&lt;slug&gt;. Leave blank to auto-generate.
              </span>
            </label>
          </div>

          <label className="block">
            <span className={fieldLabel}>Tagline</span>
            <Input
              value={form.tagline}
              onChange={(e) => patch({ tagline: e.target.value })}
              placeholder="Short one-liner shown under the name"
              className="mt-1 bg-surface"
            />
          </label>

          <label className="block">
            <span className={fieldLabel}>Description</span>
            <Textarea
              value={form.description}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="A sentence or two about the partner."
              rows={3}
              className="mt-1 bg-surface resize-none"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={fieldLabel}>External URL</span>
              <Input
                type="url"
                value={form.url}
                onChange={(e) => patch({ url: e.target.value })}
                placeholder="https://…"
                className="mt-1 bg-surface"
              />
            </label>
            <label className="block">
              <span className={fieldLabel}>Category</span>
              <select
                value={form.category}
                onChange={(e) => patch({ category: e.target.value as PartnerCategory })}
                className="mt-1 w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              >
                {PARTNER_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {PARTNER_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={form.featured}
                onCheckedChange={(v) => patch({ featured: v })}
                className="data-[state=checked]:bg-accent"
                aria-label="Featured"
              />
              <span className="text-sm text-foreground">Featured</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => patch({ active: v })}
                className="data-[state=checked]:bg-accent"
                aria-label="Active"
              />
              <span className="text-sm text-foreground">Active</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setForm(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={busy}
              onClick={() => void submit()}
            >
              {busy ? "Saving…" : editing ? "Save changes" : "Add partner"}
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {partners.length === 0 ? (
        <EmptyRow>No partners yet. Add a sponsor or vendor to fill the shop.</EmptyRow>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {partners.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-3.5 py-3">
              <PartnerLogo logo={p.logo} name={p.name} size={40} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 flex-wrap min-w-0">
                  <span className="truncate">{p.name}</span>
                  <PartnerKindBadge kind={p.kind} />
                  {p.featured && (
                    <span className="badge-stamp shrink-0 text-amber-700 border-amber-700 dark:text-yellow-400 dark:border-yellow-400">
                      Featured
                    </span>
                  )}
                  {!p.active && (
                    <span className="badge-stamp shrink-0 text-muted-foreground border-border">
                      Inactive
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {PARTNER_CATEGORY_LABELS[p.category]} · /{p.slug}
                  {p.tagline ? ` · ${p.tagline}` : ""}
                </p>
                {p.url && (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-accent hover:underline mt-0.5"
                  >
                    <ExternalLink size={11} /> {p.url}
                  </a>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                aria-label={`Edit ${p.name}`}
                onClick={() => openEdit(p)}
              >
                <Pencil size={15} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 rounded-full text-muted-foreground hover:text-red-700 dark:hover:text-red-400"
                aria-label={`Remove ${p.name}`}
                onClick={() => setRemoveTarget(p)}
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
            <AlertDialogTitle className="font-display font-bold tracking-tight">
              Remove &quot;{removeTarget?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This partner is pulled from the shop directory and support strips. You can always add
              them back later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-white hover:bg-destructive/90"
              disabled={removeBusy}
              onClick={(e) => {
                e.preventDefault(); // keep the dialog open until the server answers
                void confirmRemove();
              }}
            >
              {removeBusy ? "Removing…" : "Remove partner"}
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-16 bg-card border border-border rounded-xl" />
        ))}
      </div>
      <div className="grid gap-10 md:grid-cols-2 md:gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-5 w-40 bg-card rounded" />
            <div className="h-24 bg-card border border-border rounded-xl" />
            <div className="h-24 bg-card border border-border rounded-xl" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <div className="h-5 w-40 bg-card rounded" />
        <div className="h-24 bg-card border border-border rounded-xl" />
        <div className="h-24 bg-card border border-border rounded-xl" />
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function AdminPage() {
  const store = useStore();
  const router = useRouter();
  const ready = useHydrated();
  const isAdmin = !!store.sessionMe?.isAdmin;
  const denied = ready && !isAdmin;

  const [data, setData] = useState<AdminData | null>(null);

  useEffect(() => {
    if (denied) router.replace("/app");
  }, [denied, router]);

  const reload = useCallback(async () => {
    const res = await fetchAdminData();
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    setData(res);
  }, []);

  useEffect(() => {
    if (ready && isAdmin) void reload();
  }, [ready, isAdmin, reload]);

  const findUser = useCallback(
    (id: string) => data?.users.find((u) => u.id === id),
    [data],
  );
  const findDisputedDeal = useCallback(
    (id: string) => data?.disputedDeals.find((d) => d.id === id),
    [data],
  );

  const run = useCallback(
    <K extends OpName>(op: K, payload: OpMap[K]) => runAdminOp(store, reload, op, payload),
    [store, reload],
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur-sm border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/app"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <ArrowLeft size={16} />
              Back to app
            </Link>
            <span className="text-border">/</span>
            <h1 className="font-display font-bold tracking-tight text-lg text-foreground flex items-center gap-1.5 truncate">
              <ShieldAlert size={18} className="text-accent shrink-0" />
              Mod desk
            </h1>
          </div>
          <span className="badge-stamp text-accent border-accent hidden sm:inline-flex shrink-0">
            Mod access
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 pb-16 space-y-10">
        {!ready || denied || !data ? (
          <AdminSkeleton />
        ) : (
          <>
            <StatsSection stats={data.stats} />
            {/* Review queues, side by side on desktop */}
            <div className="grid gap-10 md:grid-cols-2 md:gap-6 items-start">
              <IdentityQueueSection
                queue={data.identityQueue}
                findUser={findUser}
                onReview={(identity, status, note) =>
                  run("adminReviewIdentity", { identityId: identity.id, status, note })
                }
              />
              <ReportsSection
                reports={data.reports}
                findUser={findUser}
                findDisputedDeal={findDisputedDeal}
                onResolve={(report, action, note) =>
                  run("adminResolveReport", { reportId: report.id, action, note })
                }
              />
            </div>
            <DisputesSection
              disputes={data.disputedDeals}
              findUser={findUser}
              onResolve={(deal, outcome, note) =>
                run("adminResolveDispute", { dealId: deal.id, outcome, note })
              }
            />
            {/* Rosters, side by side on desktop */}
            <div className="grid gap-10 md:grid-cols-2 md:gap-6 items-start">
              <UsersSection
                users={data.users}
                onSetVerified={(userId, verified) =>
                  run("adminSetUserVerified", { userId, verified })
                }
                onSetStatus={(userId, status, opts) =>
                  run("adminSetUserStatus", {
                    userId,
                    status,
                    days: opts?.days,
                    note: opts?.note,
                  })
                }
              />
              <ListingsSection
                onSetFeatured={(id, featured) => run("adminSetListingFeatured", { id, featured })}
                onRemove={(id, reason) => run("adminRemoveListing", { id, reason })}
              />
            </div>
            <PartnersSection partners={data.partners} onChanged={reload} />
          </>
        )}
      </main>
    </div>
  );
}
