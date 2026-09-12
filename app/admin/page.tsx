"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  Clock,
  EyeOff,
  MoreHorizontal,
  RotateCcw,
  ShieldAlert,
  Star,
  UserCog,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fetchAdminData } from "@/app/actions/engine";
import { useAsUser as beginImpersonation } from "@/app/actions/auth";
import type { AdminData, OpMap, OpName } from "@/lib/shared/ops";
import { useHydrated, useStore } from "@/lib/store-context";
import { formatDate, formatMonthYear } from "@/lib/format";
import type {
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
import { SamplesSection, ContentSection, MemberDetailsSection, AuditSection } from "./workspace-sections";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatsSection } from "./stats-section";
import { PartnersSection } from "./partners-section";
import { IdentityQueueSection } from "./identity-queue-section";
import { DisputesSection } from "./disputes-section";
import { ReportsSection } from "./reports-section";
import { AdminUser, runAdminOp, SectionHeading, USER_STATUS_CHIP } from "./admin-shared";

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

type ModAction = "shadowban" | "suspend" | "ban" | "restore";

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
    opts: { days?: number; note: string },
  ) => Promise<boolean>;
}) {
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("all");
  const [page, setPage] = useState(1);
  const filtered = users.filter((u) => !u.deletedAt && (scope === "all" || (scope === "sample" ? !!u.sampleBatchId : !u.sampleBatchId)) && `${u.username} ${u.displayName} ${u.email}`.toLowerCase().includes(search.toLowerCase()));
  const [modTarget, setModTarget] = useState<{ user: AdminUser; action: ModAction } | null>(null);
  const [days, setDays] = useState("7");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const cleanNote = note.trim();
  const parsedDays = Number(days);
  const validNote = cleanNote.length >= 20 && cleanNote.length <= 2_000;
  const validDays = Number.isInteger(parsedDays) && parsedDays >= 1 && parsedDays <= 365;

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

  const impersonate = async (user: AdminUser) => {
    const res = await beginImpersonation(user.id);
    if (res.ok) {
      toast.success(`Now using Poachland as @${user.username}`);
      // Full navigation so the impersonated session bootstraps cleanly.
      window.location.replace(`${window.location.origin}/app`);
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
      ok = await onSetStatus(user.id, "shadowbanned", { note: cleanNote });
    } else if (action === "suspend") {
      ok = await onSetStatus(user.id, "suspended", { days: parsedDays, note: cleanNote });
    } else if (action === "restore") {
      ok = await onSetStatus(user.id, "active", { note: cleanNote });
    } else {
      ok = await onSetStatus(user.id, "banned", { note: cleanNote });
    }
    setBusy(false);
    if (ok) {
      toast.success(
        action === "shadowban"
          ? `@${user.username} shadowbanned`
          : action === "suspend"
            ? `@${user.username} suspended`
            : action === "restore"
              ? `@${user.username} restored`
            : `@${user.username} banned`,
      );
      setModTarget(null);
    }
  };

  return (
    <section>
      <SectionHeading icon={Users} title="Members" />
      <div className="mb-4 flex flex-wrap gap-2"><Input aria-label="Search members" className="w-full sm:w-72" placeholder="Username, name, or email" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /><select aria-label="Member source" className="min-h-11 rounded-lg border border-border bg-card px-3 text-sm" value={scope} onChange={(e) => { setScope(e.target.value); setPage(1); }}><option value="all">Real and sample</option><option value="real">Real only</option><option value="sample">Sample only</option></select></div>
      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {filtered.slice((page - 1) * 20, page * 20).map((u) => (
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
                {u.sampleBatchId && <span className="badge-stamp">Example</span>}
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
                disabled={!!u.sampleBatchId}
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
                    <DropdownMenuItem onSelect={() => openMod(u, "restore")}>
                      <RotateCcw /> Restore
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="flex-col items-start gap-0.5"
                    disabled={!!u.sampleBatchId}
                    onSelect={() => void impersonate(u)}
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

      {/* Reversible account-standing changes. */}
      <div className="mt-3 flex flex-wrap justify-between gap-3 text-sm"><span>{filtered.length} members · Page {page}</span><div className="flex gap-2"><Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="outline" disabled={page * 20 >= filtered.length} onClick={() => setPage(page + 1)}>Next</Button></div></div>
      <Dialog
        open={
          modTarget?.action === "shadowban" ||
          modTarget?.action === "suspend" ||
          modTarget?.action === "restore"
        }
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
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Required rationale (20–2,000 characters). Kept in the audit record."
                minLength={20}
                maxLength={2_000}
                rows={3}
                className="bg-surface resize-none"
                aria-label="Shadowban rationale"
              />
              <DialogFooter className="gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => setModTarget(null)}>
                  Cancel
                </Button>
                <Button
                  className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={busy || !validNote}
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
                    max={365}
                    step={1}
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    className="mt-1 bg-surface"
                    aria-label="Suspension length in days"
                  />
                </label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Required rationale (20–2,000 characters). The user sees this."
                  minLength={20}
                  maxLength={2_000}
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
                  disabled={busy || !validNote || !validDays}
                  onClick={() => void confirmMod()}
                >
                  {busy ? "Working…" : "Suspend"}
                </Button>
              </DialogFooter>
            </>
          )}
          {modTarget?.action === "restore" && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display font-bold tracking-tight">
                  Restore @{modTarget.user.username}?
                </DialogTitle>
                <DialogDescription>
                  Restores normal account access and explains the decision to the member.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Required rationale (20–2,000 characters). The user sees this."
                minLength={20}
                maxLength={2_000}
                rows={3}
                className="bg-surface resize-none"
                aria-label="Restoration rationale"
              />
              <DialogFooter className="gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => setModTarget(null)}>
                  Cancel
                </Button>
                <Button
                  className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={busy || !validNote}
                  onClick={() => void confirmMod()}
                >
                  {busy ? "Working…" : "Restore account"}
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
              Blocks access and hides public content. You can restore the account later; banning does not delete it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Required rationale (20–2,000 characters). The user sees this."
            minLength={20}
            maxLength={2_000}
            rows={3}
            className="bg-surface resize-none"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Keep them</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-white hover:bg-destructive/90"
              disabled={busy || !validNote}
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
              Admin
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
            <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-surface p-1">{[["overview", "Overview"], ["samples", "Samples"], ["content", "Content"], ["members", "Members"], ["queues", "Review queues"], ["partners", "Partners"], ["audit", "Audit log"]].map(([id, label]) => <TabsTrigger className="min-h-11" key={id} value={id}>{label}</TabsTrigger>)}</TabsList>
            <TabsContent value="overview"><StatsSection stats={data.stats} /></TabsContent>
            <TabsContent value="samples"><SamplesSection run={run} /></TabsContent>
            <TabsContent value="content"><ContentSection run={run} /></TabsContent>
            <TabsContent value="queues">
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
            </TabsContent>
            <TabsContent value="members" className="space-y-8">
              <MemberDetailsSection users={data.users} run={run} />
              <UsersSection
                users={data.users}
                onSetVerified={(userId, verified) =>
                  run("adminSetUserVerified", { userId, verified })
                }
                onSetStatus={(userId, status, opts) =>
                  run("adminSetUserStatus", {
                    userId,
                    status,
                    days: opts.days,
                    note: opts.note,
                  })
                }
              />
            </TabsContent>
            <TabsContent value="partners">
            <PartnersSection partners={data.partners} onChanged={reload} />
            </TabsContent>
            <TabsContent value="audit"><AuditSection /></TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}
