"use client";

/**
 * Settings → Danger zone: export your data, and delete your account behind
 * heavy guardrails (blocked while deals are in flight, and a type-your-exact-
 * username confirmation). Deletion scrubs your personal data server-side and
 * bounces you to /goodbye.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Download, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store-context";
import { deleteMyAccount } from "@/app/actions/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AccountDangerZone() {
  const store = useStore();
  const router = useRouter();
  const me = store.currentUser();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  if (!me) return null;

  const inFlight = store.dealsForUser(me.id, {
    statuses: ["open", "accepted", "disputed"],
  });
  const blocked = inFlight.length > 0;
  const typedOk = confirm.trim().toLowerCase() === me.username.toLowerCase();

  const doDelete = async () => {
    if (!typedOk || blocked) return;
    setBusy(true);
    const res = await deleteMyAccount(confirm.trim());
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setOpen(false);
    router.replace("/goodbye");
  };

  return (
    <section className="rounded-xl border border-red-600/30 dark:border-red-400/30 bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-red-600/20 dark:border-red-400/20 flex items-center gap-2">
        <AlertTriangle size={15} className="text-red-600 dark:text-red-400" />
        <h2 className="font-display font-bold text-sm text-foreground">Danger zone</h2>
      </div>

      <div className="p-4 space-y-4">
        {/* Export */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Download your data</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              A JSON file with your profile, listings, deals, messages, and more.
            </p>
          </div>
          <a
            href="/api/account/export"
            className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:border-accent hover:text-accent transition-colors"
          >
            <Download size={13} /> Export
          </a>
        </div>

        <div className="border-t border-border" />

        {/* Delete */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Delete your account</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Permanently scrubs your personal data. This can&apos;t be undone.
            </p>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); setConfirm(""); }}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full border border-red-600/50 dark:border-red-400/50 bg-card px-3.5 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-600/10 transition-colors"
              >
                <Trash2 size={13} /> Delete
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete your account?</DialogTitle>
                <DialogDescription>
                  This permanently removes your profile, listings, wanted posts, saved
                  payment handles, and linked identities, and hides your shared trades.
                  Completed deals and the ratings you exchanged stay on record (so your
                  trade partners keep their history), but your name is removed from them.
                </DialogDescription>
              </DialogHeader>

              {blocked ? (
                <div className="rounded-lg border border-orange-600/40 bg-orange-600/10 dark:border-orange-400/40 dark:bg-orange-400/10 p-3">
                  <p className="text-sm text-orange-700 dark:text-orange-400 font-semibold">
                    You have {inFlight.length} deal{inFlight.length === 1 ? "" : "s"} in
                    progress.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Wrap up or cancel them first so nobody&apos;s left hanging.{" "}
                    <Link href="/app/trades" className="text-accent font-semibold hover:underline">
                      Go to your deals
                    </Link>
                    .
                  </p>
                </div>
              ) : (
                <>
                  <label className="block">
                    <span className="text-xs text-muted-foreground">
                      Type your username{" "}
                      <span className="font-mono font-semibold text-foreground">
                        {me.username}
                      </span>{" "}
                      to confirm
                    </span>
                    <input
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={me.username}
                      className="mt-1.5 w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-red-500 transition-colors"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!typedOk || busy}
                    onClick={doDelete}
                    className={cn(
                      "w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-display font-semibold transition-colors",
                      typedOk && !busy
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : "bg-red-600/30 text-white/70 cursor-not-allowed",
                    )}
                  >
                    {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    {busy ? "Deleting…" : "Permanently delete my account"}
                  </button>
                  <p className="text-[11px] text-muted-foreground text-center">
                    Consider{" "}
                    <a href="/api/account/export" className="text-accent font-semibold hover:underline">
                      exporting your data
                    </a>{" "}
                    first — you won&apos;t be able to after this.
                  </p>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </section>
  );
}
