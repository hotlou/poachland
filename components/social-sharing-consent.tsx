"use client";

import { useState } from "react";
import { Instagram } from "lucide-react";
import { toast } from "sonner";
import { dispatchOp } from "@/app/actions/engine";
import { useStore } from "@/lib/store-context";
import { Switch } from "@/components/ui/switch";

export function SocialSharingConsent() {
  const store = useStore();
  const [busy, setBusy] = useState(false);
  const enabled = store.sessionMe?.socialSharingAllowed === true;
  const actingAsMember = !!store.sessionMe?.impersonatedByAdmin && !store.sessionMe?.managedByUserId;
  return <section className="rounded-xl border border-border bg-card p-4 space-y-3">
    <h2 className="flex items-center gap-2 font-semibold"><Instagram size={16} /> Poachland highlights</h2>
    <div className="flex items-start justify-between gap-4">
      <div><label htmlFor="social-sharing" className="text-sm font-medium">Include my public activity on Instagram</label>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Allow Poachland to feature your real listings and public Haul posts, including photos and your username. Optional and off by default. Turn this off to stop future posts; already published Instagram posts may need staff removal.</p></div>
      <Switch id="social-sharing" checked={enabled} disabled={busy || !!store.sessionMe?.sampleBatchId || actingAsMember} onCheckedChange={async (value) => {
        setBusy(true);
        try {
          const result = await dispatchOp("updateProfile", { patch: { socialSharingAllowed: value } });
          if (!result.ok) { toast.error(result.error); return; }
          await store.refetch();
          toast.success(value ? "Your public activity can be considered for highlights." : "Future Instagram sharing is off.");
        } catch { toast.error("Could not save your preference. Please try again."); }
        finally { setBusy(false); }
      }} />
    </div>
    {actingAsMember && <p className="text-xs text-muted-foreground">The member controls this permission in their own session. Managed inventory can be opted in by its managing moderator.</p>}
  </section>;
}
