"use client";

import { useRef, useState } from "react";
import { Copy, Link2, Mail, MessageCircle, Send, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { publicUrl, shareDestinations, sharePost, type ShareContent } from "@/lib/sharing";
import { cn } from "@/lib/utils";

const actionClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function ShareButton({ content, label = "Share", className, iconOnly = false }: {
  content: ShareContent;
  label?: string;
  className?: string;
  iconOnly?: boolean;
}) {
  const [text, setText] = useState(content.text);
  const [nativeAvailable, setNativeAvailable] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copyFallback, setCopyFallback] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  const url = publicUrl(content.path);
  const destinations = shareDestinations({ title: content.title, text, url });

  async function copy(value: string, message: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyFallback(null);
      toast.success(message);
    } catch {
      setCopyFallback(value);
      toast.error("Select the text below to copy it.");
      requestAnimationFrame(() => { fallbackRef.current?.focus(); fallbackRef.current?.select(); });
    }
  }

  async function nativeShare() {
    setSharing(true);
    try {
      await navigator.share({ title: content.title, text: text.trim(), url });
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        toast.error("Sharing couldn't open. Choose an app below or copy the post.");
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <Dialog onOpenChange={(open) => {
      if (open) {
        setNativeAvailable(typeof navigator.share === "function");
        setText(content.text);
        setCopyFallback(null);
        setImageFailed(false);
      }
    }}>
      <DialogTrigger asChild>
        <button type="button" aria-label={label} className={cn(actionClass, className)}>
          <Share2 size={16} aria-hidden="true" />{!iconOnly && label}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl p-5 sm:p-6">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-2xl font-bold">{label}</DialogTitle>
          <DialogDescription>Send it to a teammate, a group chat, or your feed.</DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {!imageFailed && <img src={content.imagePath ?? "/opengraph-image"} alt={`Link preview for ${content.title}`} width={1200} height={630} onError={() => setImageFailed(true)} className="aspect-[1200/630] w-full object-cover" />}
          {imageFailed && <p className="p-4 font-display text-xl font-bold">{content.title}</p>}
          <div className="flex items-center gap-2 border-t border-border px-3 py-2">
            <Link2 size={14} aria-hidden="true" className="shrink-0 text-muted-foreground" />
            <input aria-label="Public share link" readOnly value={url} onFocus={(event) => event.target.select()} className="min-w-0 w-full bg-transparent text-xs text-muted-foreground" />
          </div>
        </div>
        <label className="grid gap-2 text-sm font-semibold">
          Your post
          <textarea aria-label="Your post" value={text} onChange={(event) => setText(event.target.value)} rows={4} maxLength={3000} className="w-full resize-y rounded-xl border border-border bg-card p-3 text-sm font-normal leading-relaxed focus-visible:outline-2 focus-visible:outline-ring" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={actionClass} onClick={() => copy(url, "Link copied")}><Link2 size={16} />Copy link</button>
          <button type="button" className={actionClass} onClick={() => copy(sharePost(text, url), "Post and link copied")}><Copy size={16} />Copy post</button>
        </div>
        {nativeAvailable && <button type="button" disabled={sharing} className={cn(actionClass, "border-accent bg-accent text-accent-foreground disabled:opacity-60")} onClick={nativeShare}><Share2 size={16} />{sharing ? "Opening sharing…" : "Share to apps…"}</button>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {destinations.map(({ name, href, hint }) => {
            const Icon = name === "Email" ? Mail : name === "Telegram" ? Send : MessageCircle;
            return <a key={name} href={href} target={name === "Email" ? undefined : "_blank"} rel="noopener noreferrer" title={hint} className={actionClass}><Icon size={15} aria-hidden="true" />{name}</a>;
          })}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">Facebook adds the link preview. For a caption, Instagram, or a group post, use Copy post and paste it in.</p>
        {copyFallback !== null && <label className="grid gap-2 text-sm font-semibold">Select and copy<textarea ref={fallbackRef} readOnly value={copyFallback} onFocus={(event) => event.target.select()} rows={4} className="w-full rounded-xl border border-border bg-card p-3 text-sm font-normal" /></label>}
      </DialogContent>
    </Dialog>
  );
}
