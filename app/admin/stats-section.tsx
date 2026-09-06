import { LayoutGrid } from "lucide-react";
import type { AdminData } from "@/lib/shared/ops";
import { cn } from "@/lib/utils";

export function StatsSection({ stats }: { stats: AdminData["stats"] }) {
  const tiles: { label: string; value: number; tone?: "warn" | "alert" }[] = [
    { label: "Members", value: stats.users }, { label: "Verified", value: stats.verifiedUsers },
    { label: "Active listings", value: stats.activeListings }, { label: "ISO posts", value: stats.isoPosts },
    { label: "Ratings", value: stats.ratings }, { label: "Deals open", value: stats.dealsOpen },
    { label: "Deals agreed", value: stats.dealsAccepted }, { label: "Completed", value: stats.dealsCompleted },
    { label: "Disputed", value: stats.dealsDisputed, tone: stats.dealsDisputed > 0 ? "alert" : undefined },
    { label: "Pending reports", value: stats.pendingReports, tone: stats.pendingReports > 0 ? "warn" : undefined },
    { label: "Identity queue", value: stats.pendingIdentities, tone: stats.pendingIdentities > 0 ? "warn" : undefined },
    { label: "Messages", value: stats.messages },
    { label: "Email ready", value: stats.emailReady, tone: stats.oldestReadyEmailMinutes >= 15 ? "warn" : undefined },
    { label: "Email dead", value: stats.emailDeadLetters, tone: stats.emailDeadLetters > 0 ? "alert" : undefined },
    { label: "Oldest report (h)", value: stats.oldestPendingReportHours, tone: stats.oldestPendingReportHours >= 48 ? "alert" : stats.oldestPendingReportHours >= 24 ? "warn" : undefined },
  ];
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <LayoutGrid size={15} className="text-accent" strokeWidth={2.5} />
        <h2 className="font-display text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">The state of the land</h2>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((tile) => (
          <div key={tile.label} className={cn("rounded-xl border border-border bg-card p-3", tile.tone === "alert" && "border-red-700/50 dark:border-red-400/50", tile.tone === "warn" && "border-amber-700/50 dark:border-yellow-400/50")}>
            <p className={cn("font-display text-2xl font-bold leading-none", tile.tone === "alert" ? "text-red-700 dark:text-red-400" : tile.tone === "warn" ? "text-amber-700 dark:text-yellow-400" : "text-foreground")}>{tile.value}</p>
            <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{tile.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <h3 className="font-display text-sm font-bold">Lifetime marketplace funnel</h3>
        <p className="mt-1 text-xs text-muted-foreground">Server-recorded successful actions. Completion and dispute rates use accepted deals as the denominator.</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[["Onboarded", stats.funnel.onboarded], ["Listings", stats.funnel.listed], ["Offers", stats.funnel.offered], ["Accepted", stats.funnel.accepted], ["Completed", stats.funnel.completed], ["Disputed", stats.funnel.disputed]].map(([label, value]) => (
            <div key={String(label)}><p className="font-display text-xl font-black">{value}</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p></div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Acceptance rate: {stats.funnel.offered ? Math.round((stats.funnel.accepted / stats.funnel.offered) * 100) : 0}% · Completion rate: {stats.funnel.accepted ? Math.round((stats.funnel.completed / stats.funnel.accepted) * 100) : 0}% · Dispute rate: {stats.funnel.accepted ? Math.round((stats.funnel.disputed / stats.funnel.accepted) * 100) : 0}%</p>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-display text-sm font-bold">Acquisition and activation</h3>
          <p className="mt-1 text-xs text-muted-foreground">Members by persisted referral attribution, plus unique members who created a listing.</p>
          <p className="mt-3 text-sm text-foreground">Direct: <strong>{stats.acquisition.directMembers}</strong> · Referred: <strong>{stats.acquisition.referredMembers}</strong> · Activated listers: <strong>{stats.funnel.activatedListers}</strong></p>
          <p className="mt-2 text-xs text-muted-foreground">Listing activation: {stats.funnel.onboarded ? Math.round((stats.funnel.activatedListers / stats.funnel.onboarded) * 100) : 0}%</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-display text-sm font-bold">Active members</h3>
          <p className="mt-1 text-xs text-muted-foreground">Unique signed-in actors with a successful marketplace event in each rolling window.</p>
          <p className="mt-3 text-sm text-foreground">7 days: <strong>{stats.retention.activeUsers7d}</strong> · 30 days: <strong>{stats.retention.activeUsers30d}</strong></p>
          <p className="mt-2 text-xs text-muted-foreground">30-day active rate: {stats.users ? Math.round((stats.retention.activeUsers30d / stats.users) * 100) : 0}%</p>
        </div>
      </div>
    </section>
  );
}
