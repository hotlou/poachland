"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, IdCard } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { IDENTITY_PROVIDER_META, IDENTITY_STATUS_META } from "@/components/identity-chips";
import { timeAgo } from "@/lib/format";
import type { IdentityRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type AdminUser, EmptyRow, SectionHeading } from "./admin-shared";

/* ── 2. Identity review queue ────────────────────────────────────────────── */

export function IdentityQueueSection({
  queue,
  findUser,
  onReview,
}: {
  queue: IdentityRecord[];
  findUser: (id: string) => AdminUser | undefined;
  onReview: (
    identity: IdentityRecord,
    status: "verified" | "rejected",
    note: string,
  ) => Promise<boolean>;
}) {
  const [reviewing, setReviewing] = useState<{
    identity: IdentityRecord;
    status: "verified" | "rejected";
  } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const open = (identity: IdentityRecord, status: "verified" | "rejected") => {
    setNote("");
    setReviewing({ identity, status });
  };

  const confirm = async () => {
    if (!reviewing || busy) return;
    setBusy(true);
    const ok = await onReview(reviewing.identity, reviewing.status, note.trim());
    setBusy(false);
    if (ok) {
      toast.success(
        reviewing.status === "verified" ? "Identity verified" : "Identity rejected",
      );
      setReviewing(null);
    }
  };

  return (
    <section>
      <SectionHeading icon={IdCard} title="Identity review queue" count={queue.length} />
      {queue.length === 0 ? (
        <EmptyRow>No identities waiting on review.</EmptyRow>
      ) : (
        <div className="space-y-2">
          {queue.map((identity) => {
            const meta = IDENTITY_PROVIDER_META[identity.provider];
            const status = IDENTITY_STATUS_META[identity.status];
            const Icon = meta.icon;
            const user = findUser(identity.userId);
            return (
              <div
                key={identity.id}
                className="bg-card border border-border rounded-xl p-3.5 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center flex-shrink-0 text-muted-foreground">
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        @{identity.handle}
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          · {meta.label}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user ? (
                          <Link
                            href={`/app/u/${user.username}`}
                            className="hover:text-accent transition-colors"
                          >
                            {user.username}
                          </Link>
                        ) : (
                          "unknown user"
                        )}{" "}
                        · submitted {timeAgo(identity.submittedAt)}
                      </p>
                    </div>
                  </div>
                  <span className={cn("badge-stamp shrink-0", status.cls)}>{status.label}</span>
                </div>
                {identity.url && (
                  <a
                    href={identity.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                  >
                    <ExternalLink size={11} /> {identity.url}
                  </a>
                )}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
                    onClick={() => open(identity, "verified")}
                  >
                    Verify
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full text-red-700 border-red-700/40 hover:text-red-700 dark:text-red-400 dark:border-red-400/40 dark:hover:text-red-400"
                    onClick={() => open(identity, "rejected")}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent className="max-w-sm bg-card border-border">
          {reviewing && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display font-bold tracking-tight">
                  {reviewing.status === "verified" ? "Verify identity" : "Reject identity"}
                </DialogTitle>
                <DialogDescription>
                  {reviewing.status === "verified"
                    ? `Marks @${reviewing.identity.handle} as a verified ${IDENTITY_PROVIDER_META[reviewing.identity.provider].label} identity. It shows with a check on the trader's profile.`
                    : `Rejects @${reviewing.identity.handle}. The trader sees the rejection on their settings page.`}
                </DialogDescription>
              </DialogHeader>
              <div className="py-1">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Decision rationale for the trader and record (required)."
                  rows={3}
                  maxLength={2000}
                  className="bg-surface resize-none"
                />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => setReviewing(null)}>
                  Cancel
                </Button>
                <Button
                  variant={reviewing.status === "rejected" ? "destructive" : "default"}
                  className={
                    reviewing.status === "rejected"
                      ? "rounded-full"
                      : "rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
                  }
                  disabled={busy || note.trim().length < 20}
                  onClick={() => void confirm()}
                >
                  {busy ? "Working…" : reviewing.status === "verified" ? "Verify" : "Reject"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

