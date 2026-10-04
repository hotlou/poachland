"use client";

import { useCallback, useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Instagram } from "lucide-react";
import { toast } from "sonner";
import { fetchTrustStatus, issueDmChallenge, requestStaffReview } from "@/app/actions/trust";
import type { TrustStatus } from "@/lib/trust-types";
import { useStore } from "@/lib/store-context";
import { VerifiedMark } from "@/components/verified-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CommunityVerification() {
  const store = useStore();
  const router = useRouter();
  const field = useId();
  const [status, setStatus] = useState<TrustStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, startTransition] = useTransition();
  const [handle, setHandle] = useState("");
  const [challenge, setChallenge] = useState<{ id: string; code: string; handle: string; expiresAt: string } | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchTrustStatus();
      if (result.ok) { setStatus(result.value); setError(null); }
      else setError(result.error);
    } catch { setError("Could not load verification. Please try again."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function requestReview() {
    startTransition(async () => {
      try {
        const result = await requestStaffReview();
        if (!result.ok) { toast.error(result.error); return; }
        toast.success("Your request is in the staff review queue.");
        await load();
      } catch { toast.error("Could not request a review. Please try again."); }
    });
  }
  function createChallenge() {
    startTransition(async () => {
      try {
        const result = await issueDmChallenge(handle.trim());
        if (!result.ok) { toast.error(result.error); return; }
        setChallenge(result.value);
        toast.success("Your Instagram verification code is ready.");
        await load();
      } catch { toast.error("Could not create a code. Please try again."); }
    });
  }
  const me = store.sessionMe;
  const restricted = !!(me?.sampleBatchId || me?.managedByUserId || me?.impersonatedByAdmin || status?.own?.unavailableReason);
  return <section id="community-verification" aria-labelledby={`${field}-heading`} className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
    <div className="space-y-1">
      <h2 id={`${field}-heading`} className="flex items-center gap-2 font-display text-lg font-bold"><VerifiedMark size={21} /> Community verification</h2>
      <p className="text-sm text-muted-foreground">A blue check shows that staff or eligible members have confirmed a person behind the account. Everyone can sign up and post without a check.</p>
    </div>
    {loading && !status && <p role="status" className="text-sm text-muted-foreground">Loading verification…</p>}
    {error && <div role="alert" className="space-y-2 text-sm"><p>{error}</p><Button variant="outline" disabled={loading} onClick={() => void load()}>Retry verification</Button></div>}
    {restricted ? <p className="rounded-lg bg-surface p-3 text-sm">{status?.own?.unavailableReason ?? "Verification and vouching are available in a member’s own account. Exit Act as to use your personal account. Example and managed inventory profiles cannot receive a check."}</p> : status && <>
      <div className="space-y-2 rounded-lg bg-surface p-3">
        <p className="flex items-center gap-2 font-semibold">{status.verified && <VerifiedMark />}{status.verified ? status.source === "staff" ? "Verified by staff" : "Verified by the community" : "Not yet community verified"}</p>
        <p className="text-sm text-muted-foreground">{status.validVouchCount} of {status.vouchesRequired} eligible vouches{status.verifiedAt ? ` · Verified ${new Date(status.verifiedAt).toLocaleDateString()}` : ""}</p>
        {status.eligibleToVouch ? <p className="text-sm">You can vouch for people you know. {status.remainingVouches} vouches remaining in your rolling 30-day allowance.</p>
          : status.eligibleAt ? <p className="text-sm">You can start vouching on {new Date(status.eligibleAt).toLocaleDateString()}. Newly community-verified members wait seven days.</p>
          : <p className="text-sm text-muted-foreground">Request a staff review or ask two eligible members who know you to vouch on your profile.</p>}
        <p className="text-xs text-muted-foreground">A check confirms a community connection. Trade ratings describe trading experiences separately.</p>
      </div>
      {!status.verified && <div className="space-y-2">
        {status.own?.reviewRequestedAt ? <p role="status" className="text-sm">Staff review requested {new Date(status.own.reviewRequestedAt).toLocaleDateString()}. You can keep browsing and posting while we review.</p>
          : <><p className="text-sm text-muted-foreground">Staff can confirm you through a personal connection or a short conversation. Make sure your profile gives them a way to recognize you.</p><Button className="min-h-11" disabled={busy} onClick={requestReview}>{busy ? "Working…" : "Request staff review"}</Button></>}
      </div>}
      <div className="space-y-3 border-t border-border pt-4">
        <h3 className="flex items-center gap-2 font-semibold"><Instagram size={17} aria-hidden="true" /> Confirm your Instagram account</h3>
        <p className="text-sm text-muted-foreground">Send a one-time code from your Instagram account for staff to check. This confirms ownership of that social account; it does not automatically unlock a blue check.</p>
        {!status.own?.instagramHandle ? <p className="rounded-lg bg-surface p-3 text-sm">Instagram verification is not open yet. You can request a staff review above.</p> : <><p className="text-sm">Our verification inbox: <a className="font-semibold underline underline-offset-2" href={`https://www.instagram.com/${encodeURIComponent(status.own.instagramHandle)}/`} target="_blank" rel="noopener noreferrer">@{status.own.instagramHandle}</a></p><form className="flex flex-col items-start gap-2 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); createChallenge(); }}>
          <label htmlFor={`${field}-instagram`} className="w-full flex-1 space-y-1 text-sm"><span>Your Instagram username</span><Input id={`${field}-instagram`} value={handle} onChange={(event) => setHandle(event.target.value)} placeholder="your_username" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={30} className="min-h-11" /></label>
          <Button className="min-h-11" disabled={busy || !handle.trim()} type="submit">{busy ? "Working…" : challenge ? "Generate a new code" : "Get DM code"}</Button>
        </form></>}
        {challenge && <div className="space-y-3 rounded-lg border border-border bg-surface p-3" role="status">
          <p className="text-sm">Send this code from <strong>@{challenge.handle}</strong> to <strong>@{status.own?.instagramHandle}</strong> on Instagram before {new Date(challenge.expiresAt).toLocaleString()}.</p>
          <div className="flex flex-wrap items-center gap-3"><code className="break-all rounded border border-border bg-card px-3 py-2 font-mono text-lg font-semibold">{challenge.code}</code><Button variant="outline" className="min-h-11" onClick={async () => { try { await navigator.clipboard.writeText(challenge.code); toast.success("Code copied."); } catch { toast.error("Select and copy the code above."); } }}><Copy size={15} aria-hidden="true" />Copy code</Button></div>
          <p className="text-xs text-muted-foreground">This code only links your social account. Never send a sign-in code or password. Generating a new code expires the old one.</p>
        </div>}
        {!!status.own?.evidence.length && <div className="space-y-2"><h4 className="text-sm font-semibold">Social account evidence</h4><ul className="space-y-2">{status.own.evidence.map((evidence) => <li key={evidence.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface p-3 text-sm"><span className="break-all">Instagram @{evidence.handle}</span><span className="text-muted-foreground">{evidence.status === "confirmed" ? "Account ownership confirmed" : evidence.status === "pending" ? "Awaiting confirmation" : "Confirmation revoked"}</span></li>)}</ul></div>}
        <Button variant="outline" className="min-h-11" disabled={loading || busy} onClick={() => startTransition(async () => { await load(); await store.refetch(); router.refresh(); })}>Refresh verification status</Button>
      </div>
    </>}
  </section>;
}
