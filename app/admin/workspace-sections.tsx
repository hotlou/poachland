"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { fetchAdminAudit, fetchAdminContent, fetchAdminMember, fetchAdminSamples } from "@/app/actions/admin";
import type { AdminContentRow, ContentAction, ContentKind, ContentQuery } from "@/lib/admin-types";
import type { AdminData, OpMap, OpName } from "@/lib/shared/ops";
import { SAMPLE_BATCH_ID, SAMPLE_NOTICE } from "@/lib/sample-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";

export type AdminRunner = <K extends OpName>(op: K, payload: OpMap[K]) => Promise<boolean>;
const selectClass = "min-h-11 rounded-lg border border-border bg-card px-3 text-sm text-foreground";

function useAdminQuery<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    let live = true;
    setLoading(true);
    loader().then((result) => { if (live) { setData(result); setError(null); } }).catch(() => {
      if (live) setError("Could not load this section. Please try again.");
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [loader, version]);
  return { data, error, loading, refresh };
}

function QueryState({ error, loading, refresh }: { error?: string | null; loading: boolean; refresh: () => void }) {
  return error ? <div role="alert" className="rounded-xl border border-destructive p-4 text-sm">{error} <Button variant="outline" onClick={refresh}>Retry</Button></div>
    : loading ? <p role="status" className="py-4 text-sm text-muted-foreground">Loading…</p> : null;
}

function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-sm">
    <span>{total} records · Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</span>
    <div className="flex gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button><Button variant="outline" disabled={page * pageSize >= total} onClick={() => onPage(page + 1)}>Next</Button></div>
  </div>;
}

function ConfirmAction({ open, title, description, expected, destructive, minReason = 10, onClose, onConfirm }: {
  open: boolean; title: string; description: string; expected?: string; destructive?: boolean; minReason?: number;
  onClose: () => void; onConfirm: (note: string, confirmation: string) => Promise<boolean>;
}) {
  const [note, setNote] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const field = useId();
  return <Dialog open={open} onOpenChange={(value) => { if (!value && !busy) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      <label htmlFor={`${field}-reason`} className="text-sm font-medium">Reason for the audit log</label>
      <Textarea id={`${field}-reason`} value={note} onChange={(e) => setNote(e.target.value)} minLength={minReason} maxLength={2000} placeholder={`At least ${minReason} characters`} />
      {expected && <><label htmlFor={`${field}-confirm`} className="break-words text-sm">Type <strong>{expected}</strong> to confirm.</label><Input id={`${field}-confirm`} autoComplete="off" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button variant={destructive ? "destructive" : "default"} disabled={busy || note.trim().length < minReason || (!!expected && expected !== confirmation)} onClick={async () => {
        setBusy(true);
        try { if (await onConfirm(note.trim(), confirmation)) onClose(); }
        catch { toast.error("The action failed. Please try again."); }
        finally { setBusy(false); }
      }}>{busy ? "Working…" : title}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function SamplesSection({ run }: { run: AdminRunner }) {
  const query = useAdminQuery(useCallback(() => fetchAdminSamples(), []));
  const [action, setAction] = useState<"publish" | "delete" | null>(null);
  const [days, setDays] = useState("30");
  const [busy, setBusy] = useState(false);
  const data = query.data && !("error" in query.data) ? query.data : null;
  const batch = data?.batches.find((b) => b.id === SAMPLE_BATCH_ID);
  const published = batch?.state === "published" && new Date(batch.expiresAt) > new Date();
  const validDays = Number.isInteger(Number(days)) && Number(days) >= 1 && Number(days) <= 90;
  async function apply(action: "publish" | "hide" | "delete", note: string, confirm: string) {
    const ok = await run("adminSampleBatch", { action, batchId: SAMPLE_BATCH_ID, confirm, note, days: Number(days) });
    if (ok) { query.refresh(); toast.success(action === "hide" ? "All examples hidden. Publish again to restore them." : action === "delete" ? "Sample batch deleted." : "Examples published."); }
    return ok;
  }
  return <section className="space-y-5">
    <div><h2 className="font-display text-2xl font-bold">Sample content</h2><p className="mt-1 text-sm text-muted-foreground">Preview, publish, hide, or remove this entire collection without selecting individual records.</p></div>
    <QueryState {...query} error={query.error ?? (query.data && "error" in query.data ? query.data.error : null)} />
    {data && <>
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{data.plan.name}</h3><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{data.plan.id}</p></div><span className="badge-stamp">{published ? "Published" : batch?.state === "deleted" ? "Deleted" : "Hidden"}</span></div>
        <p className="text-sm">Original fixture: {data.plan.users} profiles · {data.plan.listings} items ({data.plan.activeListings} available examples) · {data.plan.completedSwaps} completed swaps · {data.plan.ratings} ratings · {data.plan.haulPosts} Haul posts</p>
        <p className="rounded-lg bg-surface p-3 text-sm">{SAMPLE_NOTICE} Sample activity is excluded from real usage and reputation totals. Messages, offers, claims, reactions, and saves are disabled.</p>
        {batch && <p className="text-sm text-muted-foreground">Published {formatDate(batch.publishedAt)} · Expires {formatDate(batch.expiresAt)}{batch.archivalReason ? ` · ${batch.archivalReason}` : ""}</p>}
        <div className="flex flex-wrap items-end gap-3"><label className="space-y-1 text-sm">Lifetime in days<Input className="w-28" type="number" min={1} max={90} value={days} onChange={(e) => setDays(e.target.value)} /></label>
          <Button disabled={!validDays || busy} onClick={() => setAction("publish")}>{published ? "Extend publication" : "Publish examples"}</Button>
          <Button variant="outline" disabled={!published || busy} onClick={async () => { setBusy(true); try { await apply("hide", "Temporarily hide the sample collection from public browsing and sharing.", `HIDE ${SAMPLE_BATCH_ID}`); } finally { setBusy(false); } }}>Hide all examples</Button>
          <Button variant="destructive" disabled={!batch || batch.state === "deleted" || busy} onClick={() => setAction("delete")}>Delete batch permanently</Button>
        </div>
        <p className="text-xs text-muted-foreground">Hide keeps the records and individual moderation decisions. Publish restores the batch for the chosen lifetime. Delete removes only this batch’s connected records; its audit history remains. Previously shared previews may remain cached by other services.</p>
      </div>
      <div><h3 className="mb-3 font-semibold">Original fixture preview</h3><p className="mb-3 text-sm text-muted-foreground">This is the publishing template. Use Content to inspect current records and individual moderation changes.</p><div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{data.plan.items.map((item) => <div key={item.id} className="overflow-hidden rounded-xl border border-border bg-card"><img src={item.photo} alt={`Illustration: ${item.title}`} className="aspect-[4/3] w-full object-cover" /><div className="p-3"><p className="text-sm font-medium">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.status} · Example</p>{published && item.status !== "removed" && <Link className="mt-2 inline-block text-sm text-accent underline" href={`/l/${item.id}`} target="_blank">Open public preview</Link>}</div></div>)}</div></div>
      {action && <ConfirmAction key={action} open title={action === "delete" ? "Delete sample batch" : "Publish sample batch"} destructive={action === "delete"}
        description={action === "delete" ? "Permanently remove this batch’s profiles, listings, deals, offers, ratings, and Haul posts. Real content is protected; deletion stops if outside records reference these examples." : `Publish ${data.plan.users} visibly labeled example profiles and ${data.plan.listings} items for ${days} days. Existing records and moderation decisions will not be overwritten.`}
        expected={`${action.toUpperCase()} ${SAMPLE_BATCH_ID}`} onClose={() => setAction(null)} onConfirm={(note, confirm) => apply(action, note, confirm)} />}
    </>}
  </section>;
}

export function ContentSection({ run }: { run: AdminRunner }) {
  const [filters, setFilters] = useState<ContentQuery>({ kind: "listing", page: 1, scope: "all", visibility: "all" });
  const [search, setSearch] = useState("");
  const query = useAdminQuery(useCallback(() => fetchAdminContent(filters), [filters]));
  const [target, setTarget] = useState<{ row: AdminContentRow; action: ContentAction } | null>(null);
  const data = query.data && !("error" in query.data) ? query.data : null;
  const change = (patch: Partial<ContentQuery>) => setFilters((f) => ({ ...f, ...patch, page: 1 }));
  return <section className="space-y-4"><div><h2 className="font-display text-2xl font-bold">Content library</h2><p className="mt-1 text-sm text-muted-foreground">Search all records, including completed and hidden content. Hiding keeps transaction history intact.</p></div>
    <form onSubmit={(e) => { e.preventDefault(); change({ query: search }); }} className="flex flex-wrap gap-2">
      <select aria-label="Content type" className={selectClass} value={filters.kind} onChange={(e) => change({ kind: e.target.value as ContentKind })}><option value="listing">Listings</option><option value="wanted">Wanted posts</option><option value="rating">Ratings</option><option value="haul">Haul posts</option><option value="comment">Haul comments</option></select>
      <select aria-label="Content source" className={selectClass} value={filters.scope} onChange={(e) => change({ scope: e.target.value as ContentQuery["scope"] })}><option value="all">Real and sample</option><option value="real">Real only</option><option value="sample">Sample only</option></select>
      <select aria-label="Content visibility" className={selectClass} value={filters.visibility} onChange={(e) => change({ visibility: e.target.value as ContentQuery["visibility"] })}><option value="all">All visibility</option><option value="visible">Public</option><option value="hidden">Hidden or removed</option></select>
      <Input aria-label="Search content" className="min-h-11 w-full sm:w-64" placeholder="Title, username, text, or ID" value={search} onChange={(e) => setSearch(e.target.value)} /><Button type="submit">Search</Button>
    </form>
    <QueryState {...query} error={query.error ?? (query.data && "error" in query.data ? query.data.error : null)} />
    {data && !query.loading && <><div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">{data.items.length === 0 && <p className="p-6 text-sm text-muted-foreground">No content matches these filters.</p>}{data.items.map((row) => <article key={row.id} className="flex flex-col gap-3 p-4 sm:flex-row">
      {row.photo && <img className="h-20 w-24 rounded-lg object-cover" src={row.photo} alt="" />}
      <div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><h3 className="font-semibold">{row.title}</h3>{row.sampleBatchId && <span className="badge-stamp">Example</span>}<span className="badge-stamp">{row.visible ? row.state : "Hidden"}</span></div><p className="mt-1 break-all text-xs text-muted-foreground">@{row.username ?? "deleted"} · {formatDate(row.createdAt)} · {row.id}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{row.body}</p>
      {row.kind === "listing" && row.visible && <Link className="mt-2 inline-block text-sm text-accent underline" href={`/l/${row.id}`} target="_blank">Open listing</Link>}</div>
      <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col"><Button variant="outline" onClick={() => setTarget({ row, action: row.hidden ? "restore" : "hide" })}>{row.hidden ? "Restore" : "Hide"}</Button><Button variant="destructive" onClick={() => setTarget({ row, action: "delete" })}>Delete permanently</Button></div>
    </article>)}</div><Pager {...data} onPage={(page) => setFilters((f) => ({ ...f, page }))} /></>}
    {target && <ConfirmAction key={`${target.row.id}-${target.action}`} open title={target.action === "delete" ? "Delete permanently" : target.action === "hide" ? "Hide content" : "Restore content"} destructive={target.action === "delete"}
      description={target.action === "delete" ? `Permanently delete “${target.row.title}”. Listings involved in a deal must be hidden instead. Audit records remain.` : target.action === "hide" ? `Hide “${target.row.title}” from public views. The record and existing deals remain; you can restore it later.` : `Restore “${target.row.title}”. A hidden batch, moderated author, or closed listing still stays unavailable.`}
      expected={target.action === "delete" ? `DELETE ${target.row.id}` : undefined} onClose={() => setTarget(null)} onConfirm={async (note, confirm) => { const ok = await run("adminModerateContent", { id: target.row.id, kind: target.row.kind, action: target.action, note, confirm }); if (ok) { query.refresh(); toast.success("Moderation saved."); } return ok; }} />}
  </section>;
}

export function MemberDetailsSection({ users, run }: { users: AdminData["users"]; run: AdminRunner }) {
  const [id, setId] = useState("");
  const [erase, setErase] = useState(false);
  const query = useAdminQuery(useCallback(() => id ? fetchAdminMember(id) : Promise.resolve({ member: null }), [id]));
  const member = query.data && !("error" in query.data) ? query.data.member : null;
  const user = users.find((u) => u.id === id);
  return <section className="space-y-4 rounded-xl border border-border bg-card p-5"><div><h2 className="font-display text-xl font-bold">Member activity</h2><p className="mt-1 text-sm text-muted-foreground">Inspect usage and account history without opening private message text.</p></div>
    <select aria-label="Inspect member" className={`${selectClass} w-full`} value={id} onChange={(e) => setId(e.target.value)}><option value="">Choose a member</option>{users.filter((u) => !u.deletedAt).map((u) => <option key={u.id} value={u.id}>@{u.username || "onboarding"} · {u.displayName}{u.sampleBatchId ? " · Example" : ""}</option>)}</select>
    {id && <QueryState {...query} error={query.error ?? (query.data && "error" in query.data ? query.data.error : null)} />}
    {member && <><p className="text-sm text-muted-foreground">Joined {formatDate(member.joinedAt)} · Last signed-in visit: {member.lastActiveAt ? new Date(member.lastActiveAt).toLocaleString() : "Not recorded"}{member.sampleBatchId ? " · Sample history; excluded from real totals" : member.managedByUserId ? " · Managed inventory; example history excluded" : ""}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Listings", member.listings], ["Available", member.activeListings], ["Completed deals", member.completedDeals], ["Deals in progress", member.inFlightDeals], ["Messages sent", member.messagesSent], ["Ratings received", member.ratingsReceived], ["Reports against account", member.reportsReceived]].map(([label, value]) => <div key={label} className="rounded-lg bg-surface p-3"><p className="text-xl font-semibold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}</div>
      <details><summary className="cursor-pointer py-2 text-sm font-semibold">Recent marketplace actions ({member.recentEvents.length})</summary><ul className="divide-y divide-border">{member.recentEvents.map((e, i) => <li key={`${e.createdAt}-${i}`} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span>{e.name.replaceAll("_", " ")}</span><time className="text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</time></li>)}</ul>{!member.recentEvents.length && <p className="text-sm text-muted-foreground">No real marketplace actions recorded.</p>}</details>
      {user && !user.isAdmin && !user.sampleBatchId && <Button variant="destructive" onClick={() => setErase(true)}>Erase account and close access</Button>}
    </>}
    {erase && user && <ConfirmAction key={user.id} open title="Erase account" minReason={20} destructive expected={user.username} description="Scrub profile and sign-in details, revoke sessions, and remove public content. This cannot be undone. Minimal completed-deal records remain for counterparties. Open, accepted, or disputed deals must be resolved first." onClose={() => setErase(false)} onConfirm={async (note, confirm) => { const ok = await run("adminCloseAccount", { userId: user.id, confirm, note }); if (ok) { setId(""); query.refresh(); toast.success("Account erased and closed."); } return ok; }} />}
  </section>;
}

export function AuditSection() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [targetId, setTargetId] = useState("");
  const query = useAdminQuery(useCallback(() => fetchAdminAudit(page, targetId), [page, targetId]));
  const data = query.data && !("error" in query.data) ? query.data : null;
  return <section className="space-y-4"><div><h2 className="font-display text-2xl font-bold">Audit log</h2><p className="mt-1 text-sm text-muted-foreground">Who changed what, when, and why. Audit records remain after content is removed.</p></div>
    <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setTargetId(search); setPage(1); }}><Input aria-label="Audit target ID" className="w-full sm:w-80" placeholder="Filter by exact record or batch ID" value={search} onChange={(e) => setSearch(e.target.value)} /><Button type="submit">Search audit</Button></form>
    <QueryState {...query} error={query.error ?? (query.data && "error" in query.data ? query.data.error : null)} />
    {data && !query.loading && <><div className="divide-y divide-border rounded-xl border border-border bg-card">{!data.items.length && <p className="p-5 text-sm text-muted-foreground">No audit events match.</p>}{data.items.map((event) => <article key={event.id} className="space-y-1 p-4"><div className="flex flex-wrap justify-between gap-2 text-sm"><strong>{event.action}</strong><time className="text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</time></div><p className="break-all text-xs text-muted-foreground">@{event.actorUsername ?? "moderator"} · {event.targetType ?? "record"} {event.targetId}</p>{typeof event.metadata.note === "string" && <p className="pt-1 text-sm">{event.metadata.note}</p>}</article>)}</div><Pager page={data.page} total={data.total} pageSize={25} onPage={setPage} /></>}
  </section>;
}
