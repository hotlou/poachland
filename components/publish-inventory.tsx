"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { publishRealInventory } from "@/app/actions/admin";
import { useStore } from "@/lib/store-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Listing } from "@/lib/types";

export function PublishInventory({ listing }: { listing: Listing }) {
  const me = useStore().sessionMe;
  const [username, setUsername] = useState(me?.username.replace(/^sample_/, "gear_") ?? "");
  const [displayName, setDisplayName] = useState(me?.managedByUserId ? me.displayName : "");
  const [location, setLocation] = useState(me?.managedByUserId ? me.location : "");
  const [ownsGear, setOwnsGear] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!me?.impersonatedByAdmin || listing.sellerId !== me.id || !listing.sampleBatchId || listing.status !== "active") return null;
  const hasPhotos = listing.photos.length > 0 && listing.photos.every((p) => p.startsWith("https://"));
  async function publish() {
    setBusy(true);
    try {
      const result = await publishRealInventory({ listingId: listing.id, username, displayName, location, ownsGear });
      if (!result.ok) { toast.error(result.error); return; }
      window.location.replace(`/app/listings/${listing.id}`);
    } catch { toast.error("Could not publish. Your example is still available to edit."); }
    finally { setBusy(false); }
  }
  return <section className="rounded-xl border border-border bg-card p-4 space-y-3 text-sm">
    <h2 className="font-semibold">Publish as real inventory</h2>
    <p className="text-muted-foreground">Replace the item details and all photos with gear you own, then save. Publication enables messages and offers. This profile will say “Admin-managed inventory”; its fictional ratings, biography, and swap totals won’t carry over.</p>
    <Link href={`/app/listings/${listing.id}/edit`} className="inline-block underline font-semibold">Edit details and upload your photos</Link>
    {!hasPhotos && <p className="text-muted-foreground">Your own uploaded photos are required before publication.</p>}
    {!me.managedByUserId && <>
      <label className="block space-y-1"><span>Inventory handle</span><Input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={30} /></label>
      <label className="block space-y-1"><span>Inventory profile name</span><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Lou’s gear closet" maxLength={80} /></label>
      <label className="block space-y-1"><span>Your shipping location</span><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, state" maxLength={120} /></label>
    </>}
    <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={ownsGear} onChange={(e) => setOwnsGear(e.target.checked)} /><span>I own this gear, and the saved details and photos accurately describe it.</span></label>
    <Button disabled={busy || !ownsGear || !hasPhotos || !displayName.trim() || !location.trim()} onClick={() => void publish()}>{busy ? "Publishing…" : "Publish as real inventory"}</Button>
    <p className="text-xs text-muted-foreground">This item will survive example-batch deletion. Hide or remove it individually in Admin → Content.</p>
  </section>;
}
