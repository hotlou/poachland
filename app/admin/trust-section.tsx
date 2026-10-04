"use client";

import { useCallback, useEffect, useId, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { confirmDmManually, fetchAdminTrust, reviewMemberTrust, revokeTrustEvidence, revokeTrustVouch } from "@/app/actions/trust";
import type { AdminTrustData, AdminTrustMember, ReviewMemberTrustInput, TrustVouch } from "@/lib/trust-types";
import { VerifiedMark } from "@/components/verified-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const selectClass = "min-h-11 rounded-lg border border-border bg-card px-3 text-sm text-foreground";
const actionMeta: Record<ReviewMemberTrustInput["action"], { title: string; description: string; destructive?: boolean }> = {
  grant: { title: "Grant staff check", description: "Confirm that staff have verified the person behind this account. This grants a blue check and immediate eligibility to vouch for other members." },
  revoke: { title: "Revoke check", description: "Remove this check and suspend eligibility to vouch. Existing vouches will be reassessed. Automatic verification stays blocked until staff clear this decision." , destructive: true },
  block: { title: "Block verification", description: "Prevent staff or community evidence from granting a check until this decision is cleared. This does not ban the member from posting or using the marketplace.", destructive: true },
  clear: { title: "Clear staff override", description: "Remove the staff grant or block and let eligible community vouches determine this member’s check. A former staff check may disappear if there are not enough qualifying vouches." },
};
function when(value: string | null) { return value ? new Date(value).toLocaleString() : "Not recorded"; }
function relation(value: string) { return value === "played_together" ? "Played together" : value === "met_in_person" ? "Met in person" : value === "traded" ? "Traded together" : value.replaceAll("_", " "); }

export function TrustSection() {
  const field = useId();
  const [data, setData] = useState<AdminTrustData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [decision, setDecision] = useState<{ member: AdminTrustMember; action: ReviewMemberTrustInput["action"] } | null>(null);
  const [note, setNote] = useState("");
  const [revoke, setRevoke] = useState<{ kind: "vouch" | "evidence"; id: string; label: string } | null>(null);
  const [dmCode, setDmCode] = useState("");
  const [senderHandle, setSenderHandle] = useState("");
  const [dmNote, setDmNote] = useState("");
  const [checkedInbox, setCheckedInbox] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAdminTrust();
      if (result.ok) { setData(result.value); setError(null); }
      else setError(result.error);
    } catch { setError("Could not load community verification. Please try again."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const selected = data?.members.find((member) => member.userId === selectedId);
  const query = search.toLowerCase().trim().replace(/^@/, "");
  const members = data?.members.filter((member) => (!query || `${member.username} ${member.displayName} ${member.userId}`.toLowerCase().includes(query)) && (filter === "all" || filter === "pending" && !!member.reviewRequestedAt || filter === "verified" && member.verified || filter === "blocked" && member.override === "blocked")) ?? [];
  const pendingReviews = data?.members.filter((member) => member.reviewRequestedAt).length ?? 0;

  function decide() {
    if (!decision || note.trim().length < 20) return;
    startTransition(async () => {
      try {
        const result = await reviewMemberTrust({ userId: decision.member.userId, action: decision.action, note: note.trim() });
        if (!result.ok) { toast.error(result.error); return; }
        toast.success("Verification decision saved and audited.");
        setDecision(null);
        setNote("");
        await load();
      } catch { toast.error("Could not save the decision. Please try again."); }
    });
  }
  function revokeRecord() {
    if (!revoke || note.trim().length < 20) return;
    startTransition(async () => {
      try {
        const result = await (revoke.kind === "vouch" ? revokeTrustVouch : revokeTrustEvidence)({ id: revoke.id, note: note.trim() });
        if (!result.ok) { toast.error(result.error); return; }
        toast.success(revoke.kind === "vouch" ? "Vouch revoked and dependent checks reassessed." : "Social ownership confirmation revoked.");
        setRevoke(null); setNote("");
        await load();
      } catch { toast.error("Could not revoke this record. Please try again."); }
    });
  }
  function selectVouch(vouch: TrustVouch) { setNote(""); setRevoke({ kind: "vouch", id: vouch.id, label: `@${vouch.issuerUsername} → @${vouch.targetUsername}` }); }
  function confirmDm() {
    if (!checkedInbox) return;
    startTransition(async () => {
      try {
        const result = await confirmDmManually({ code: dmCode.trim(), senderHandle: senderHandle.trim(), note: dmNote.trim() });
        if (!result.ok) { toast.error(result.error); return; }
        toast.success("Instagram ownership confirmed. Review the member separately for a blue check.");
        setDmCode(""); setSenderHandle(""); setDmNote(""); setCheckedInbox(false);
        await load();
      } catch { toast.error("Could not confirm this DM. Please try again."); }
    });
  }

  return <section className="space-y-6" aria-labelledby={`${field}-heading`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="max-w-2xl space-y-2"><h2 id={`${field}-heading`} className="font-display text-2xl font-bold">Community verification</h2><p className="text-sm text-muted-foreground">Staff grants start the community. Two eligible vouches can unlock a blue check. Posting stays open to all members.</p></div><Button variant="outline" className="min-h-11" disabled={loading || busy} onClick={() => void load()}>Refresh reviews</Button></div>
    {loading && !data && <p role="status" className="text-sm text-muted-foreground">Loading verification…</p>}
    {error && <p role="alert" className="rounded-lg border border-destructive p-3 text-sm">{error}</p>}
    {data && <>
      <div className="grid gap-3 sm:grid-cols-3">{[["Waiting for staff review", pendingReviews], ["Community-verified members", data.members.filter((member) => member.verified).length], ["Eligible vouches", data.vouches.filter((vouch) => vouch.valid && !vouch.revokedAt).length]].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-card p-4"><p className="text-2xl font-semibold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div>)}</div>
      <div className="rounded-xl border border-border bg-card p-4 text-sm leading-relaxed">Staff-verified members can vouch immediately. Members verified by the community wait seven days and can give three vouches per rolling 30 days. Only vouches connected to valid staff verification count; circular endorsements cannot create a check. Example accounts, managed inventory profiles, and Act as sessions cannot verify or vouch.</div>
      <section className="space-y-3" aria-labelledby={`${field}-members`}>
        <h3 id={`${field}-members`} className="font-display text-xl font-bold">Member reviews</h3>
        <div className="flex flex-col gap-2 sm:flex-row"><Input aria-label="Search verification members" className="min-h-11 sm:max-w-sm" placeholder="Search username or name" value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label="Verification review filter" className={selectClass} value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All members</option><option value="pending">Staff review requested</option><option value="verified">Has a blue check</option><option value="blocked">Verification blocked</option></select></div>
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">{members.length ? members.slice(0, 100).map((member) => <article key={member.userId} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0 space-y-1"><p className="flex flex-wrap items-center gap-1.5 font-semibold"><span className="break-all">@{member.username || "onboarding"}</span>{member.verified && <VerifiedMark />}<span className="font-normal text-muted-foreground">{member.displayName}</span></p><p className="text-xs text-muted-foreground">{member.verified ? member.source === "staff" ? "Staff verified" : "Community verified" : member.override === "blocked" ? "Verification blocked" : "No check"} · {member.validVouchCount}/{member.vouchesRequired} eligible vouches{member.reviewRequestedAt ? ` · Review requested ${when(member.reviewRequestedAt)}` : ""}</p></div><Button variant="outline" className="min-h-11" aria-label={`Review @${member.username}`} onClick={() => setSelectedId(member.userId)}>{selectedId === member.userId ? "Selected" : "Review member"}</Button></article>) : <p className="p-5 text-sm text-muted-foreground">No members match this filter.</p>}</div>
        {members.length > 100 && <p className="text-sm text-muted-foreground">Showing the first 100 matches. Search a username to narrow the list.</p>}
      </section>
      {selected && <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5" aria-labelledby={`${field}-selected`}>
        <div className="flex flex-wrap justify-between gap-3"><div><h3 id={`${field}-selected`} className="flex items-center gap-2 font-display text-xl font-bold">@{selected.username}{selected.verified && <VerifiedMark size={20} />}</h3><p className="mt-1 text-sm text-muted-foreground">{selected.displayName} · {selected.status} · Staff override: {selected.override}</p></div><Link href={`/u/${encodeURIComponent(selected.username)}`} className="min-h-11 py-2.5 text-sm font-semibold underline" target="_blank">Open profile</Link></div>
        <p className="text-sm">{selected.eligibleToVouch ? `Eligible to vouch · ${selected.remainingVouches} remaining this rolling 30-day period` : selected.eligibleAt ? `Eligible to vouch after ${when(selected.eligibleAt)}` : "Not eligible to vouch"}</p>
        <div className="flex flex-wrap gap-2">{(["grant", "revoke", "block", "clear"] as const).map((action) => <Button key={action} className="min-h-11" variant={actionMeta[action].destructive ? "outline" : action === "grant" ? "default" : "outline"} disabled={busy || action === "revoke" && !selected.verified || action === "clear" && selected.override === "none" || action === "block" && selected.override === "blocked" || action === "grant" && selected.override === "granted"} onClick={() => { setNote(""); setDecision({ member: selected, action }); }}>{actionMeta[action].title}</Button>)}</div>
        <div className="space-y-2"><h4 className="font-semibold">Social ownership evidence</h4><p className="text-xs text-muted-foreground">Confirmed social ownership supports staff review. It never grants a blue check by itself.</p>{selected.evidence.length ? <ul className="divide-y divide-border">{selected.evidence.map((evidence) => <li key={evidence.id} className="space-y-1 py-3 text-sm"><p className="break-all">Instagram @{evidence.handle} · {evidence.status}</p><p className="text-xs text-muted-foreground">{evidence.source === "manual_dm" ? "Staff checked DM" : "Verified webhook DM"} · {when(evidence.confirmedAt ?? evidence.createdAt)}</p>{evidence.note && <p className="break-words text-muted-foreground">{evidence.note}</p>}{evidence.status !== "revoked" && <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => { setNote(""); setRevoke({ kind: "evidence", id: evidence.id, label: `Instagram @${evidence.handle}` }); }}>Revoke social confirmation</Button>}</li>)}</ul> : <p className="text-sm text-muted-foreground">No social ownership evidence.</p>}</div>
        <VouchList onRevoke={selectVouch} disabled={busy} title="Vouches received" rows={data.vouches.filter((vouch) => vouch.targetId === selected.userId)} />
        <VouchList onRevoke={selectVouch} disabled={busy} title="Vouches given" rows={data.vouches.filter((vouch) => vouch.issuerId === selected.userId)} />
      </section>}
      <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5" aria-labelledby={`${field}-dm`}>
        <div className="space-y-1"><h3 id={`${field}-dm`} className="font-display text-xl font-bold">Confirm an Instagram DM</h3><p className="text-sm text-muted-foreground">Open Poachland’s Instagram inbox yourself. Copy the live, unused code from the message and the sender’s username. Match both before confirming.</p></div>
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); confirmDm(); }}>
          <div className="grid gap-3 sm:grid-cols-2"><label htmlFor={`${field}-dm-code`} className="space-y-1 text-sm"><span>Code received in the inbox</span><Input id={`${field}-dm-code`} className="min-h-11 font-mono" value={dmCode} onChange={(event) => setDmCode(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={100} required /></label><label htmlFor={`${field}-dm-sender`} className="space-y-1 text-sm"><span>Instagram sender username</span><Input id={`${field}-dm-sender`} className="min-h-11" value={senderHandle} onChange={(event) => setSenderHandle(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={30} required /></label></div>
          <label htmlFor={`${field}-dm-note`} className="block space-y-1 text-sm"><span>Review note for the audit log</span><Textarea id={`${field}-dm-note`} value={dmNote} onChange={(event) => setDmNote(event.target.value)} placeholder="How and when you checked the sender and message" minLength={20} maxLength={2000} required /></label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-surface p-3 text-sm"><input className="mt-0.5 h-4 w-4 shrink-0" type="checkbox" checked={checkedInbox} onChange={(event) => setCheckedInbox(event.target.checked)} /><span>I checked this code and sender directly in our Instagram inbox.</span></label>
          <Button className="min-h-11" disabled={busy || !checkedInbox || !dmCode.trim() || !senderHandle.trim() || dmNote.trim().length < 20} type="submit">{busy ? "Confirming…" : "Confirm Instagram ownership"}</Button>
        </form>
        {!!data.pendingEvidence.length && <p className="text-sm text-muted-foreground">{data.pendingEvidence.length} social account confirmations waiting for review.</p>}
      </section>
      <VouchList onRevoke={selectVouch} disabled={busy} title="Community vouch history" rows={data.vouches.slice(0, 100)} />
      <p className="text-xs text-muted-foreground">Decisions are recorded in the admin audit log. Removing a check reassesses dependent vouches; it does not ban linked members or remove their listings.</p>
    </>}
    <Dialog open={!!revoke} onOpenChange={(open) => { if (!open && !busy) setRevoke(null); }}><DialogContent><DialogHeader><DialogTitle>Revoke {revoke?.kind === "vouch" ? "vouch" : "social confirmation"}</DialogTitle><DialogDescription>{revoke?.label}. {revoke?.kind === "vouch" ? "Dependent community checks will be reassessed. Member accounts and listings remain available." : "This removes the social ownership evidence. Any separately granted blue check remains until you revoke or block it."}</DialogDescription></DialogHeader><label className="space-y-1 text-sm"><span>Reason for revocation</span><Textarea value={note} onChange={(event) => setNote(event.target.value)} minLength={20} maxLength={2000} placeholder="At least 20 characters for the audit log" /></label><DialogFooter><Button variant="outline" disabled={busy} onClick={() => setRevoke(null)}>Cancel</Button><Button variant="destructive" disabled={busy || note.trim().length < 20} onClick={revokeRecord}>{busy ? "Revoking…" : "Confirm revocation"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!decision} onOpenChange={(open) => { if (!open && !busy) setDecision(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{decision && actionMeta[decision.action].title}{decision ? `: @${decision.member.username}` : ""}</DialogTitle><DialogDescription>{decision && actionMeta[decision.action].description}</DialogDescription></DialogHeader><label htmlFor={`${field}-decision-note`} className="space-y-1 text-sm"><span>Reason and verification method</span><Textarea id={`${field}-decision-note`} value={note} onChange={(event) => setNote(event.target.value)} minLength={20} maxLength={2000} placeholder="At least 20 characters. Record what you confirmed or why you changed this decision." /></label><DialogFooter><Button variant="outline" className="min-h-11" disabled={busy} onClick={() => setDecision(null)}>Cancel</Button><Button className="min-h-11" variant={decision && actionMeta[decision.action].destructive ? "destructive" : "default"} disabled={busy || note.trim().length < 20} onClick={decide}>{busy ? "Saving…" : decision && actionMeta[decision.action].title}</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}

function VouchList({ title, rows, onRevoke, disabled }: { title: string; rows: TrustVouch[]; onRevoke: (vouch: TrustVouch) => void; disabled: boolean }) {
  return <section className="space-y-2"><h4 className="font-semibold">{title}</h4>{rows.length ? <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">{rows.map((vouch) => <li key={vouch.id} className="space-y-1 p-3 text-sm"><p className="break-words"><strong>@{vouch.issuerUsername}</strong> vouched for <strong>@{vouch.targetUsername}</strong></p><p className="text-xs text-muted-foreground">{relation(vouch.relationship)} · {when(vouch.createdAt)} · {vouch.revokedAt ? "Withdrawn" : vouch.valid ? "Eligible" : "Not currently eligible"}</p>{!vouch.revokedAt && <Button className="min-h-11" variant="outline" disabled={disabled} onClick={() => onRevoke(vouch)}>Revoke vouch</Button>}</li>)}</ul> : <p className="text-sm text-muted-foreground">No vouches recorded.</p>}</section>;
}
