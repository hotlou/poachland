"use client";

/**
 * HaulCard — one shared completed trade on The Haul (community wall).
 *
 * Used by the in-app feed (/app/haul), the home preview, the deal room, and
 * the public /haul page. It celebrates the deal: who traded what, a rounded
 * "vague" cash figure (never the exact number — we cheer the swap, not the
 * receipt), additive reactions (🔥 👏 🤝 😮 🏴‍☠️ — a 🏴‍☠️ "heist" is a badge
 * of honor, never a shaming), and comments. Traders (and mods) can hide a
 * post or turn comments off; comment authors, traders, and mods can remove a
 * comment.
 *
 * Interactions require a session — signed-out viewers (the public page) get
 * a nudge to /login instead of dead taps.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  EyeOff,
  MessageCircle,
  MessagesSquare,
  MoreHorizontal,
  Send,
  SmilePlus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DEAL_KIND_LABELS } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { useStore } from "@/lib/store-context";
import { HAUL_REACTIONS, type HaulPost, type HaulReactionEmoji, type HaulSide } from "@/lib/types";

/** Round cash to a friendly bucket and prefix "~" — celebratory, not precise. */
function vagueCash(n: number): string {
  if (n <= 0) return "";
  const bucket =
    n < 20
      ? Math.max(5, Math.round(n / 5) * 5)
      : n < 100
        ? Math.round(n / 10) * 10
        : n < 500
          ? Math.round(n / 25) * 25
          : Math.round(n / 50) * 50;
  return `~$${bucket}`;
}

function SidePanel({ side, label }: { side: HaulSide; label: string }) {
  const empty = side.items.length === 0 && side.cash <= 0;
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-display font-bold mb-1.5">
        {label}
      </p>
      {empty ? (
        <p className="text-xs text-muted-foreground italic">nothing</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {side.items.map((it, i) => (
            <div key={`${it.listingId ?? it.title}-${i}`} className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-md overflow-hidden bg-surface border border-border flex-shrink-0">
                {it.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.photo} alt="" className="w-full h-full object-cover" />
                ) : null}
              </div>
              <span className="text-xs text-foreground leading-tight line-clamp-2">{it.title}</span>
            </div>
          ))}
          {side.cash > 0 && (
            <span className="inline-flex items-center self-start rounded-full border border-accent/40 bg-accent/10 text-accent px-2 py-0.5 text-[11px] font-semibold">
              {vagueCash(side.cash)} cash
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ReactionBar({
  post,
  onReact,
}: {
  post: HaulPost;
  onReact: (emoji: HaulReactionEmoji) => void;
}) {
  const [open, setOpen] = useState(false);
  const present = HAUL_REACTIONS.filter((r) => (post.reactionCounts[r.emoji] ?? 0) > 0);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {present.map((r) => {
        const mine = post.myReaction === r.emoji;
        return (
          <button
            key={r.emoji}
            type="button"
            onClick={() => onReact(r.emoji)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
              mine
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-card text-foreground hover:border-accent/50",
            )}
          >
            <span className="text-sm leading-none">{r.emoji}</span>
            {post.reactionCounts[r.emoji]}
          </button>
        );
      })}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="React to this trade"
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-accent hover:border-accent/50 transition-colors"
        >
          <SmilePlus size={13} />
          {present.length === 0 && "React"}
        </button>
        {open && (
          <>
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-10 cursor-default"
            />
            <div className="absolute z-20 bottom-full mb-1.5 left-0 flex items-center gap-0.5 rounded-full border border-border bg-popover shadow-lg px-1.5 py-1">
              {HAUL_REACTIONS.map((r) => (
                <button
                  key={r.emoji}
                  type="button"
                  title={r.label}
                  aria-label={r.label}
                  onClick={() => {
                    onReact(r.emoji);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-lg hover:bg-muted transition-colors",
                    post.myReaction === r.emoji && "bg-accent/15 ring-1 ring-accent",
                  )}
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function HaulCard({
  post,
  profileHrefBase = "/app/u",
  compact = false,
  readOnly = false,
}: {
  post: HaulPost;
  profileHrefBase?: string;
  compact?: boolean;
  readOnly?: boolean;
}) {
  const store = useStore();
  const router = useRouter();
  const me = store.currentUser();
  const session = store.sessionMe;
  const canInteract = !readOnly && !!me;

  const [showComments, setShowComments] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const isParty = !!me && (post.proposerId === me.id || post.ownerId === me.id);
  const isAdmin = !!session?.isAdmin;
  const heist = (post.reactionCounts["🏴‍☠️"] ?? 0) >= 3;

  const nudge = () => {
    toast.message("Join Poachland to celebrate", {
      description: "It's free — one email to react and comment.",
    });
    router.push("/login");
  };

  const react = (emoji: HaulReactionEmoji) => {
    if (!canInteract) return nudge();
    store.reactHaul(post.id, emoji);
  };

  const submitComment = () => {
    if (!canInteract) return nudge();
    const body = draft.trim();
    if (!body) return;
    const res = store.commentHaul({ haulId: post.id, body });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setDraft("");
  };

  const removeComment = (commentId: string, mine: boolean) => {
    const res = store.deleteHaulComment(commentId, { byAdmin: !mine && !isParty && isAdmin });
    if (!res.ok) toast.error(res.error);
  };

  const hide = () => {
    const res = store.hideHaul(post.id, { byAdmin: !isParty && isAdmin });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Hidden from the Haul");
    setMenuOpen(false);
  };

  const toggleComments = () => {
    const res = store.setHaulComments(post.id, !post.commentsEnabled);
    if (!res.ok) toast.error(res.error);
    setMenuOpen(false);
  };

  const Party = ({ user }: { user: HaulPost["proposer"] }) => (
    <Link href={`${profileHrefBase}/${user.username}`} className="flex items-center gap-1.5 min-w-0">
      <span className="w-6 h-6 rounded-full overflow-hidden border border-border flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={user.avatar} alt={user.displayName} className="w-full h-full object-cover" />
      </span>
      <span className="text-xs font-semibold text-foreground truncate">@{user.username}</span>
    </Link>
  );

  return (
    <article className="rounded-2xl border border-border bg-card p-4 card-lift">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="badge-stamp text-accent border-accent">{DEAL_KIND_LABELS[post.kind]}</span>
        {heist && (
          <span className="badge-stamp text-pop border-pop">🏴‍☠️ Certified Heist</span>
        )}
        <span className="text-[11px] text-muted-foreground ml-auto">{timeAgo(post.createdAt)}</span>
        {(isParty || isAdmin) && (
          <div className="relative -my-1">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Trade options"
              className="w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen && (
              <>
                <button
                  type="button"
                  aria-hidden
                  tabIndex={-1}
                  onClick={() => setMenuOpen(false)}
                  className="fixed inset-0 z-10 cursor-default"
                />
                <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-xl border border-border bg-popover shadow-lg py-1 text-sm">
                  <button
                    type="button"
                    onClick={hide}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-foreground hover:bg-muted transition-colors"
                  >
                    <EyeOff size={14} /> Hide from the Haul
                  </button>
                  {isParty && (
                    <button
                      type="button"
                      onClick={toggleComments}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-foreground hover:bg-muted transition-colors"
                    >
                      <MessagesSquare size={14} />
                      {post.commentsEnabled ? "Turn comments off" : "Turn comments on"}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Trade sides */}
      <div className="flex items-center gap-3 rounded-xl bg-surface/60 border border-border p-3">
        <SidePanel side={post.proposerSide} label={`@${post.proposer.username} gave`} />
        <ArrowRightLeft size={16} className="text-accent flex-shrink-0" />
        <SidePanel side={post.ownerSide} label={`@${post.owner.username} gave`} />
      </div>

      {/* Parties line */}
      <div className="flex items-center gap-2 mt-3">
        <Party user={post.proposer} />
        <ArrowRightLeft size={12} className="text-muted-foreground flex-shrink-0" />
        <Party user={post.owner} />
      </div>

      {/* Note */}
      {post.note && (
        <p className="text-sm text-foreground leading-relaxed mt-3 border-l-2 border-accent/40 pl-3">
          &ldquo;{post.note}&rdquo;
        </p>
      )}

      {/* Reactions */}
      <div className="mt-3">
        <ReactionBar post={post} onReact={react} />
      </div>

      {/* Comments */}
      <div className="mt-3 pt-3 border-t border-border">
        {compact ? (
          <Link
            href="/app/haul"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-accent transition-colors"
          >
            <MessageCircle size={13} />
            {post.commentCount > 0
              ? `${post.commentCount} comment${post.commentCount === 1 ? "" : "s"}`
              : "Comment"}
          </Link>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setShowComments((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-accent transition-colors"
            >
              <MessageCircle size={13} />
              {post.commentCount > 0
                ? `${post.commentCount} comment${post.commentCount === 1 ? "" : "s"}`
                : "Comment"}
            </button>

            {(showComments || post.commentCount > 0) && post.comments.length > 0 && (
              <div className="flex flex-col gap-2.5 mt-3">
                {post.comments.map((c) => {
                  const mine = !!me && c.userId === me.id;
                  const canRemove = mine || isParty || isAdmin;
                  return (
                    <div key={c.id} className="flex items-start gap-2">
                      <Link
                        href={`${profileHrefBase}/${c.user.username}`}
                        className="w-6 h-6 rounded-full overflow-hidden border border-border flex-shrink-0 mt-0.5"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={c.user.avatar}
                          alt={c.user.displayName}
                          className="w-full h-full object-cover"
                        />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs leading-relaxed text-foreground">
                          <Link
                            href={`${profileHrefBase}/${c.user.username}`}
                            className="font-semibold hover:underline"
                          >
                            @{c.user.username}
                          </Link>{" "}
                          <span className="text-muted-foreground">{timeAgo(c.createdAt)}</span>
                        </p>
                        <p className="text-sm text-foreground leading-snug break-words">{c.body}</p>
                      </div>
                      {canRemove && (
                        <button
                          type="button"
                          onClick={() => removeComment(c.id, mine)}
                          aria-label="Remove comment"
                          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {post.commentsEnabled ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitComment();
                }}
                className="flex items-center gap-2 mt-3"
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onFocus={() => setShowComments(true)}
                  placeholder={canInteract ? "Say something nice…" : "Join to comment"}
                  className="flex-1 bg-surface border border-border rounded-full px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors"
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  aria-label="Post comment"
                  className="w-9 h-9 rounded-full bg-accent text-accent-foreground flex items-center justify-center flex-shrink-0 disabled:opacity-40"
                >
                  <Send size={15} />
                </button>
              </form>
            ) : (
              <p className="text-[11px] text-muted-foreground italic mt-3">
                Comments are off for this trade.
              </p>
            )}
          </>
        )}
      </div>
    </article>
  );
}
