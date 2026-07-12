"use client";

import { Ban, Clock, LogOut } from "lucide-react";
import { logOut } from "@/app/actions/auth";
import { useHydrated, useStore } from "@/lib/store-context";
import { formatDate, timeUntil } from "@/lib/format";

/**
 * Full-screen standing gate. When the signed-in account is suspended or banned
 * the app is replaced with a plain notice — no nav, just the wordmark and a way
 * out. Everything else (including an admin viewing "as" a gated user) falls
 * through untouched.
 *
 * Shadowban never reaches the client: the server masks it to "active", so it
 * simply never trips this gate.
 */
export function AccountGate({ children }: { children: React.ReactNode }) {
  const store = useStore();
  const ready = useHydrated();
  const me = store.sessionMe;

  // Don't gate until we have an authoritative snapshot — avoids a flash of the
  // notice during the initial load, when sessionMe is still null.
  if (!ready || !me) return <>{children}</>;
  if (me.accountStatus !== "suspended" && me.accountStatus !== "banned") {
    return <>{children}</>;
  }

  const banned = me.accountStatus === "banned";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="px-5 py-4 flex justify-center">
        <span className="font-display font-black text-xl tracking-tight text-accent">
          Poachland
        </span>
      </header>

      <main className="flex-1 flex items-center justify-center px-5 pb-16">
        <div
          className={
            banned
              ? "w-full max-w-md rounded-xl border border-red-500/40 bg-red-500/10 p-6 sm:p-8 shadow-sm"
              : "w-full max-w-md rounded-xl border border-amber-500/40 bg-amber-500/10 p-6 sm:p-8 shadow-sm"
          }
        >
          <div
            className={
              banned
                ? "w-11 h-11 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center mb-4"
                : "w-11 h-11 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center mb-4"
            }
          >
            {banned ? <Ban size={20} /> : <Clock size={20} />}
          </div>

          {banned ? (
            <>
              <h1 className="font-display font-black text-2xl tracking-tight mb-2">
                Your account has been banned
              </h1>
              {me.moderationNote && (
                <p className="text-sm text-foreground/90 leading-relaxed bg-card border border-border rounded-lg px-3.5 py-3 mb-4">
                  {me.moderationNote}
                </p>
              )}
              <p className="text-sm text-muted-foreground leading-relaxed">
                This decision is final for now. If you think it&apos;s a mistake,
                reply to your sign-in email.
              </p>
            </>
          ) : (
            <>
              <h1 className="font-display font-black text-2xl tracking-tight mb-2">
                Your account is suspended
              </h1>
              {me.suspendedUntil && (
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-sm font-semibold text-foreground">
                    Lifts {formatDate(me.suspendedUntil)}
                  </span>
                  <span className="badge-pill bg-amber-500/15 text-amber-700 dark:text-amber-400">
                    {timeUntil(me.suspendedUntil)}
                  </span>
                </div>
              )}
              {me.moderationNote && (
                <p className="text-sm text-foreground/90 leading-relaxed bg-card border border-border rounded-lg px-3.5 py-3 mb-4">
                  {me.moderationNote}
                </p>
              )}
              <p className="text-sm text-muted-foreground leading-relaxed">
                It lifts on its own — come back then and you&apos;re good to go.
                If you think it&apos;s a mistake, reply to your sign-in email.
              </p>
            </>
          )}

          <form action={logOut} className="mt-6">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:border-accent hover:text-accent transition-colors"
            >
              <LogOut size={15} /> Sign out
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
