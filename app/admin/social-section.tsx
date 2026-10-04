"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createSocialDraft, fetchAdminSocial, saveSocialSettings, updateSocialPost } from "@/app/actions/social";
import type { SocialAdminData, SocialPostView, SocialSettingsView } from "@/lib/social-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function AdminSocialSection() {
  const [data, setData] = useState<SocialAdminData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState(7);
  const reload = useCallback(async () => {
    const result = await fetchAdminSocial();
    if (result.data) { setData(result.data); setError(null); } else setError(result.error ?? "Could not load publishing.");
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  async function generate(cadence: "daily" | "weekly" | "custom") {
    setBusy(true);
    try { const result = await createSocialDraft({ cadence, days }); if (result.error) toast.error(result.error); else { toast.success(result.reused ? "Opened the existing draft for this period." : "Draft ready for review."); await reload(); } }
    catch { toast.error("Could not create a draft."); } finally { setBusy(false); }
  }
  return <section className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-2xl font-bold">Instagram highlights</h2><p className="mt-1 text-sm text-muted-foreground">Real gear and public exchanges, with permission from everyone featured.</p></div><Button variant="outline" onClick={() => void reload()}>Refresh queue</Button></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!data && !error && <p role="status">Loading highlights…</p>}
    {data && <>
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-semibold">{data.connection.configured ? `Publishing configured${data.connection.handle ? ` for @${data.connection.handle}` : ""}` : "Instagram setup needed"}</h3>
        <p className="text-sm text-muted-foreground">Drafts, downloadable images, and copyable captions work before connecting Instagram. Publishing uses Meta’s API and your existing hosting; no social scheduling subscription is required.</p>
        {!data.connection.configured && <p className="text-xs text-muted-foreground break-words">Server configuration needed: {data.connection.missing.join(", ")}. Use an Instagram professional account and a Meta developer app with approved publishing permissions. Tokens stay on the server.</p>}
        <p className="text-xs text-muted-foreground">DM verification also needs the app secret, webhook verify token, and messaging access. Configure the callback at /api/instagram/webhook. A configured token still needs valid account permissions.</p>
      </div>
      <Settings key={JSON.stringify(data.settings)} initial={data.settings} connected={data.connection.configured} reload={reload} />
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4"><h3 className="font-semibold">Create a highlight</h3><p className="text-sm text-muted-foreground">Daily uses the previous UTC day. Weekly uses the previous Monday–Sunday. Custom uses the previous complete UTC days. Up to three eligible items are ranked; empty periods stay empty.</p><div className="flex flex-wrap gap-3 items-end"><Button disabled={busy} onClick={() => void generate("daily")}>Yesterday</Button><Button disabled={busy} variant="outline" onClick={() => void generate("weekly")}>Last week</Button><label className="text-sm space-y-1">Lookback days<Input type="number" min={1} max={30} value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-28" /></label><Button disabled={busy || !Number.isInteger(days) || days < 1 || days > 30} variant="outline" onClick={() => void generate("custom")}>Create custom draft</Button></div></div>
      {!data.posts.length && <div className="rounded-2xl border border-dashed border-border p-8 text-center"><h3 className="font-semibold">Your first highlight starts with real activity.</h3><p className="mt-2 text-sm text-muted-foreground">Members can allow social features in their profile settings. Eligible listings need uploaded photos. Public completed exchanges need permission from both members.</p></div>}
      <div className="space-y-5">{data.posts.map((post) => <PostCard key={`${post.id}:${post.status}:${post.caption}`} post={post} connected={data.connection.configured} paused={data.settings.paused} reload={reload} />)}</div>
    </>}
  </section>;
}

function Settings({ initial, connected, reload }: { initial: SocialSettingsView; connected: boolean; reload: () => Promise<void> }) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  return <form className="rounded-2xl border border-border bg-card p-5 space-y-4" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true);
    try { const result = await saveSocialSettings(value); if (result.error) toast.error(result.error); else { toast.success("Publishing settings saved."); await reload(); } } catch { toast.error("Could not save settings."); } finally { setBusy(false); }
  }}><h3 className="font-semibold">Schedule and control</h3><div className="grid gap-3 sm:grid-cols-2">
    {([['paused', 'Pause all scheduled publishing'], ['daily', 'Generate daily highlights'], ['weekly', 'Generate weekly highlights'], ['automatic', 'Automatically approve future highlights']] as const).map(([key, label]) => <label key={key} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={value[key]} disabled={key === "automatic" && !connected} onChange={(e) => setValue({ ...value, [key]: e.target.checked })} className="size-5" />{label}</label>)}
  </div><label className="block text-sm space-y-1">Generate after this UTC hour<Input className="w-28" type="number" min={0} max={23} value={value.hourUtc} onChange={(e) => setValue({ ...value, hourUtc: Number(e.target.value) })} /></label><p className="text-xs text-muted-foreground">Automatic approval applies only to future generated drafts. Every post is checked again before publishing. Turning it off leaves existing approved posts scheduled; Pause stops the queue. Changes after Meta accepts a post require removing it in Instagram.</p><Button disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button></form>;
}

function PostCard({ post, connected, paused, reload }: { post: SocialPostView; connected: boolean; paused: boolean; reload: () => Promise<void> }) {
  const [caption, setCaption] = useState(post.caption);
  const [when, setWhen] = useState("");
  const [mediaId, setMediaId] = useState("");
  const [busy, setBusy] = useState(false);
  const editable = ["draft", "scheduled", "failed", "cancelled"].includes(post.status);
  async function act(action: "edit" | "refresh" | "approve" | "cancel" | "retry" | "resolve_published") {
    setBusy(true);
    try {
      const result = await updateSocialPost({ id: post.id, action, ...(action === "edit" ? { caption } : {}), ...(action === "approve" && when ? { scheduledAt: new Date(when).toISOString() } : {}), ...(action === "resolve_published" ? { mediaId } : {}) });
      if (result.error) toast.error(result.error); else { toast.success("Highlight updated."); await reload(); }
    } catch { toast.error("Could not update this highlight."); } finally { setBusy(false); }
  }
  return <article className="rounded-2xl border border-border bg-card p-5 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
    <div className="space-y-2">
      {/* The signed image endpoint revalidates visibility and consent on every request. */}
      <img src={post.imageUrl} alt={`${post.cadence} highlight preview; unavailable if its source permission changed`} className="w-full max-w-[260px] rounded-xl aspect-[4/5] bg-surface object-contain" />
      <a className="inline-flex min-h-11 items-center text-sm underline" href={post.imageUrl} download={`poachland-${post.id}.jpg`} target="_blank" rel="noreferrer">Download JPEG</a>
    </div>
    <div className="space-y-3 min-w-0"><div className="flex flex-wrap gap-2 items-center"><h3 className="font-semibold capitalize">{post.cadence} highlight</h3><span className="badge-stamp">{post.status}</span></div><p className="text-xs text-muted-foreground">{post.windowStart.slice(0, 10)} through {new Date(new Date(post.windowEnd).getTime() - 1).toISOString().slice(0, 10)} UTC{post.scheduledAt ? ` · Scheduled ${new Date(post.scheduledAt).toLocaleString()}` : ""}</p>
      <label className="block text-sm space-y-1">Caption<Textarea value={caption} onChange={(e) => setCaption(e.target.value)} disabled={!editable || busy} maxLength={2200} rows={8} /></label>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(caption); toast.success("Caption copied."); } catch { toast.error("Select the caption and copy it manually."); } }}>Copy caption</Button>{editable && <><Button disabled={busy || caption === post.caption || !caption.trim()} onClick={() => void act("edit")}>Save caption</Button><Button disabled={busy} variant="outline" onClick={() => void act("refresh")}>Refresh sources</Button></>}</div>
      <ul className="text-sm space-y-1">{post.sources.map((source) => <li key={`${source.kind}:${source.id}`}><a className="underline" href={source.url} target="_blank" rel="noreferrer">{source.title}</a> · {source.kind === "haul" ? "public completed exchange" : "available listing"}</li>)}</ul>
      {post.error && <p role="alert" className="rounded-lg bg-surface p-3 text-sm">{post.error}</p>}
      {editable && post.status !== "cancelled" && <div className="flex flex-wrap items-end gap-3"><label className="block text-sm space-y-1">Publish time (local, optional)<Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></label><Button disabled={busy || !connected || paused || caption !== post.caption} onClick={() => void act(post.status === "failed" ? "retry" : "approve")}>{post.status === "failed" ? "Retry before publication" : when ? "Approve and schedule" : "Approve next worker run"}</Button><Button variant="outline" disabled={busy} onClick={() => void act("cancel")}>Cancel</Button></div>}
      {post.status === "review" && <div className="space-y-3"><p className="text-sm">Check the connected Instagram account. If the post exists, enter its media ID below. Otherwise cancel this queue item; it will never publish again automatically.</p><label className="block text-sm space-y-1">Published Instagram media ID<Input value={mediaId} onChange={(e) => setMediaId(e.target.value)} /></label><div className="flex flex-wrap gap-2"><Button disabled={busy || !/^\d{1,50}$/.test(mediaId)} onClick={() => void act("resolve_published")}>Record confirmed publication</Button><Button variant="outline" disabled={busy} onClick={() => void act("cancel")}>Cancel queue item</Button></div></div>}
      {post.mediaId && <p className="text-xs text-muted-foreground break-all">Instagram media ID: {post.mediaId}</p>}
    </div>
  </article>;
}
