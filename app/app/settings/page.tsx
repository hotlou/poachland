"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  Database,
  ShieldCheck,
  Star,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store-context";
import { Hydrated } from "@/components/hydrated";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function SettingsSkeleton() {
  return (
    <div className="px-4 pt-5 space-y-4 animate-pulse">
      <div className="h-32 bg-surface rounded-lg" />
      <div className="h-20 bg-surface rounded-lg" />
      <div className="h-20 bg-surface rounded-lg" />
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <Icon size={14} className="text-accent" />
      <h2 className="font-display font-bold text-sm uppercase tracking-wider">
        {children}
      </h2>
    </div>
  );
}

function SettingsContent() {
  const store = useStore();
  const router = useRouter();
  const me = store.requireUser();
  const users = store.listUsers();
  const blocked = store.blockedUsers();

  const signInAs = (userId: string, username: string) => {
    const res = store.signInAs(userId);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Signed in as @${username}`);
    router.push("/app");
  };

  return (
    <div className="px-4 pt-5 pb-8 space-y-7">
      {/* Demo: switch trader */}
      <section>
        <SectionTitle icon={Users}>Demo: Switch Trader</SectionTitle>
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          This is a demo — hop between accounts to play both sides of a
          negotiation.
        </p>
        <div className="flex flex-col gap-2">
          {users.map((u) => {
            const isMe = u.id === me.id;
            return (
              <div
                key={u.id}
                className={cn(
                  "flex items-center gap-3 bg-card border rounded-lg p-3",
                  isMe ? "border-accent" : "border-border",
                )}
              >
                <div className="w-10 h-10 rounded-full overflow-hidden border border-border flex-shrink-0">
                  <img
                    src={u.avatar}
                    alt={u.displayName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {u.displayName}
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · @{u.username}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Star size={10} className="fill-yellow-400 text-yellow-400" />
                    {u.trustScore.toFixed(1)} · {u.tradesCompleted} trades
                  </p>
                </div>
                {isMe ? (
                  <span className="badge-stamp text-accent border-accent flex-shrink-0">
                    <UserCheck size={10} className="mr-1" /> You
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => signInAs(u.id, u.username)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-md border border-border text-xs font-semibold text-foreground hover:border-accent hover:text-accent transition-colors"
                  >
                    Sign in
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Blocked traders */}
      <section>
        <SectionTitle icon={Ban}>Blocked Traders</SectionTitle>
        {blocked.length === 0 ? (
          <p className="text-sm text-muted-foreground bg-card border border-border rounded-lg p-4 text-center">
            Nobody blocked. Keep it that way.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {blocked.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 bg-card border border-border rounded-lg p-3"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden border border-border flex-shrink-0 grayscale opacity-60">
                  <img
                    src={u.avatar}
                    alt={u.displayName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{u.displayName}</p>
                  <p className="text-xs text-muted-foreground">@{u.username}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const res = store.unblockUser(u.id);
                    if (!res.ok) {
                      toast.error(res.error);
                      return;
                    }
                    toast.success(`Unblocked @${u.username}`);
                  }}
                  className="flex-shrink-0 px-3 py-1.5 rounded-md border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors"
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Data */}
      <section>
        <SectionTitle icon={Database}>Data</SectionTitle>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            Everything lives in this browser only — listings, deals, messages,
            the lot. No servers, no cloud, no takebacks after a reset.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md border border-red-400/50 text-sm font-semibold text-red-400 hover:bg-red-400/10 transition-colors"
              >
                <Trash2 size={15} /> Reset demo data
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-sm">
              <AlertDialogHeader>
                <AlertDialogTitle>Reset demo data?</AlertDialogTitle>
                <AlertDialogDescription>
                  Wipes every local change — your listings, deals, messages,
                  ratings, and profile edits — and restores the original seed
                  data. There is no undo.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep my data</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    store.resetDemo();
                    toast.success("Fresh start. Demo data reset.");
                    router.push("/app");
                  }}
                >
                  Reset everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>

      {/* Moderation */}
      <section>
        <SectionTitle icon={ShieldCheck}>Moderation</SectionTitle>
        <Link
          href="/admin"
          className="flex items-center justify-between bg-card border border-border rounded-lg p-4 card-lift"
        >
          <div>
            <p className="text-sm font-semibold">Moderator dashboard</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Reports, disputes, and community stats.
            </p>
          </div>
          <span className="text-accent text-sm font-semibold">Open →</span>
        </Link>
      </section>

      {/* About */}
      <section className="pt-2 border-t border-border">
        <h2 className="font-display font-bold text-sm uppercase tracking-wider mb-2">
          About Poachland
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The ultimate-frisbee collector marketplace. Trade jerseys and discs
          with people who actually get it. No fees, no cut, no middleman —
          trust is the product, and you build it one clean deal at a time.
        </p>
        <p className="text-[11px] text-muted-foreground/60 mt-4 text-center">
          Poachland v1.0 · local demo build
        </p>
      </section>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display font-bold text-xl uppercase tracking-tight">
          Settings
        </h1>
      </header>
      <Hydrated fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Hydrated>
    </div>
  );
}
