"use client";

import { useCallback, useEffect, useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { fetchTrustStatus, revokeMyVouch, vouchForUser } from "@/app/actions/trust";
import { useStore } from "@/lib/store-context";
import type { TrustStatus } from "@/lib/trust-types";
import { VerifiedMark } from "@/components/verified-mark";
import { Button } from "@/components/ui/button";

const relationships = [
  ["played_together", "We have played together"],
  ["met_in_person", "We have met in person"],
  ["traded", "We have traded together"],
] as const;

export function MemberVouch({ userId }: { userId: string }) {
  const field = useId();
  const store = useStore();
  const router = useRouter();
  const [status, setStatus] = useState<TrustStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const [relationship, setRelationship] = useState<(typeof relationships)[number][0]>("played_together");
  const [attested, setAttested] = useState(false);
  const [withdraw, setWithdraw] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchTrustStatus(userId);
      if (result.ok) { setStatus(result.value); setError(null); }
      else setError(result.error);
    } catch { setError("Could not load community verification."); }
    finally { setLoading(false); }
  }, [userId]);
  useEffect(() => { setStatus(null); setAttested(false); setWithdraw(false); void load(); }, [load]);

  function submitVouch() {
    if (!attested) return;
    startTransition(async () => {
      try {
        const result = await vouchForUser(userId, relationship);
        if (!result.ok) { toast.error(result.error); return; }
        toast.success("Your vouch has been recorded.");
        setAttested(false);
        await load();
        await store.refetch();
        router.refresh();
      } catch { toast.error("Could not save your vouch. Please try again."); }
    });
  }
  function withdrawVouch() {
    const vouch = status?.viewer?.vouch;
    if (!vouch) return;
    startTransition(async () => {
      try {
        const result = await revokeMyVouch(vouch.id);
        if (!result.ok) { toast.error(result.error); return; }
        toast.success("Your vouch has been withdrawn.");
        setWithdraw(false);
        await load();
        await store.refetch();
        router.refresh();
      } catch { toast.error("Could not withdraw your vouch. Please try again."); }
    });
  }
  const activeVouch = status?.viewer?.vouch && !status.viewer.vouch.revokedAt;
  return <section aria-labelledby={`${field}-heading`} className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm">
    <h2 id={`${field}-heading`} className="flex items-center gap-2 font-semibold">{status?.verified && <VerifiedMark />}Community verification</h2>
    {loading && !status && <p role="status" className="text-muted-foreground">Loading verification…</p>}
    {error && <div role="alert" className="space-y-2"><p>{error}</p><Button variant="outline" disabled={loading} onClick={() => void load()}>Retry verification</Button></div>}
    {status && <>
      <p>{status.verified ? status.source === "staff" ? "Verified by Poachland staff." : `Verified through ${status.validVouchCount} eligible community vouches.` : `${status.validVouchCount} of ${status.vouchesRequired} eligible vouches toward a community check.`}</p>
      <p className="text-xs text-muted-foreground">Vouches are personal connections. Trade ratings describe trading experiences separately.</p>
      {status.own ? <Link className="inline-block min-h-11 py-3 font-semibold underline underline-offset-2" href="/app/settings#community-verification">Manage your verification</Link>
        : activeVouch ? <div className="space-y-2 border-t border-border pt-3"><p>You vouched for @{status.username}.{!status.viewer?.vouch?.valid ? " This vouch is not currently eligible toward their check." : ""}</p>{withdraw ? <><p>Withdraw your endorsement? Their community verification may change.</p><div className="flex flex-wrap gap-2"><Button variant="outline" className="min-h-11" disabled={busy} onClick={() => setWithdraw(false)}>Keep my vouch</Button><Button variant="destructive" className="min-h-11" disabled={busy} onClick={withdrawVouch}>{busy ? "Withdrawing…" : "Confirm withdrawal"}</Button></div></> : <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => setWithdraw(true)}>Withdraw my vouch</Button>}</div>
          : status.viewer?.vouch?.revokedAt ? <p className="rounded-lg bg-surface p-3 text-muted-foreground">This vouch was withdrawn or revoked and no longer contributes to their check. It cannot be issued again for this account.</p> : status.viewer?.eligibleToVouch && status.viewer.remainingVouches > 0 ? <form className="space-y-3 border-t border-border pt-3" onSubmit={(event) => { event.preventDefault(); submitVouch(); }}>
            <label htmlFor={`${field}-relationship`} className="block space-y-1"><span className="font-medium">How do you know @{status.username}?</span><select id={`${field}-relationship`} className="min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm" value={relationship} onChange={(event) => setRelationship(event.target.value as typeof relationship)}>{relationships.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-surface p-3"><input className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600" type="checkbox" checked={attested} onChange={(event) => setAttested(event.target.checked)} /><span>I know this person through playing, meeting, or trading, and recognize this as their account.</span></label>
            <Button className="min-h-11" disabled={busy || !attested} type="submit">{busy ? "Saving vouch…" : `Vouch for @${status.username}`}</Button>
            <p className="text-xs text-muted-foreground">{status.viewer.remainingVouches} vouches remaining in your rolling 30-day allowance. You can withdraw your vouch later.</p>
          </form> : !status.viewer ? <Link href="/login" className="inline-block min-h-11 py-3 font-semibold underline underline-offset-2">Sign in to vouch for someone you know</Link>
            : <p className="rounded-lg bg-surface p-3 text-muted-foreground">{status.viewer.eligibleToVouch ? "You’ve used your three vouches for this rolling 30-day period. Try again when an earlier vouch is more than 30 days old." : "Only eligible verified members can vouch. Staff-verified members can start immediately; community-verified members wait seven days."} <Link href="/app/settings#community-verification" className="font-semibold underline underline-offset-2">Your verification</Link></p>}
    </>}
  </section>;
}
