"use client";

import { useState } from "react";
import Link from "next/link";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store-context";
import { timeAgo } from "@/lib/format";
import { LISTING_STATUS_LABELS } from "@/lib/constants";
import type { DealRecord, Report } from "@/lib/types";
import { Button } from "@/components/ui/button";
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
import { type AdminUser, EmptyRow, REPORT_STATUS_STAMP, SectionHeading } from "./admin-shared";

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

export function ReportsSection({
  reports,
  findUser,
  findDisputedDeal,
  onResolve,
}: {
  reports: Report[];
  findUser: (id: string) => AdminUser | undefined;
  findDisputedDeal: (id: string) => DealRecord | undefined;
  onResolve: (report: Report, action: ResolveAction, note: string) => Promise<boolean>;
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
    const ok = await onResolve(resolving.report, resolving.action, note.trim());
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
                  placeholder="Resolution rationale (required; shared when action is taken)."
                  rows={3}
                  maxLength={2000}
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
                  disabled={busy || note.trim().length < 20}
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
