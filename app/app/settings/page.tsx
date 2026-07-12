"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  IdCard,
  LogOut,
  Mail,
  Plus,
  ShieldCheck,
  Trash2,
  UserCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { logOut } from "@/app/actions/auth";
import { useStore } from "@/lib/store-context";
import { Hydrated } from "@/components/hydrated";
import {
  IDENTITY_PROVIDER_META,
  IDENTITY_STATUS_META,
} from "@/components/identity-chips";
import type { IdentityProvider } from "@/lib/types";
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

const PROVIDER_OPTIONS: IdentityProvider[] = ["instagram", "facebook", "usau", "other"];

const inputCls =
  "w-full rounded-md bg-input border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow";

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

/* ── Linked identities ─────────────────────────────────────────────────────── */

function IdentitiesSection() {
  const store = useStore();
  const me = store.requireUser();
  const identities = store.listIdentities(me.id);

  const [provider, setProvider] = useState<IdentityProvider>("instagram");
  const [handle, setHandle] = useState("");
  const [url, setUrl] = useState("");

  const add = () => {
    const res = store.linkIdentity({
      provider,
      handle,
      url: url.trim() || undefined,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Linked ${IDENTITY_PROVIDER_META[provider].label} @${res.value.handle}`);
    setHandle("");
    setUrl("");
  };

  const remove = (id: string, label: string) => {
    const res = store.removeIdentity(id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Removed ${label}`);
  };

  return (
    <section>
      <SectionTitle icon={IdCard}>Linked Identities</SectionTitle>
      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
        Tie your trader rep to a real identity. Verification reviews are coming
        soon — linked handles already show on your profile.
      </p>

      {identities.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {identities.map((identity) => {
            const meta = IDENTITY_PROVIDER_META[identity.provider];
            const status = IDENTITY_STATUS_META[identity.status];
            const Icon = meta.icon;
            return (
              <div
                key={identity.id}
                className="flex items-center gap-3 bg-card border border-border rounded-lg p-3"
              >
                <div className="w-9 h-9 rounded-md bg-surface border border-border flex items-center justify-center flex-shrink-0 text-muted-foreground">
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    @{identity.handle}
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · {meta.label}
                    </span>
                  </p>
                  {identity.url ? (
                    <a
                      href={identity.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-accent truncate block transition-colors"
                    >
                      {identity.url}
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground">No link attached</p>
                  )}
                </div>
                <span className={cn("badge-stamp flex-shrink-0", status.cls)}>
                  {status.label}
                </span>
                <button
                  type="button"
                  onClick={() => remove(identity.id, `@${identity.handle}`)}
                  aria-label={`Remove ${identity.handle}`}
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-red-400 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add identity */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="bg-card border border-border rounded-lg p-3.5 space-y-2.5"
      >
        <div className="flex gap-2">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as IdentityProvider)}
            aria-label="Provider"
            className={cn(inputCls, "w-32 flex-shrink-0 appearance-none")}
          >
            {PROVIDER_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {IDENTITY_PROVIDER_META[p].label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="handle (e.g. huck_norris)"
            maxLength={80}
            className={inputCls}
            aria-label="Handle"
          />
        </div>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Profile URL (optional)"
          className={inputCls}
          aria-label="Profile URL"
        />
        <button
          type="submit"
          disabled={!handle.trim()}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md bg-accent text-accent-foreground text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={14} /> Link identity
        </button>
      </form>
    </section>
  );
}

/* ── Page content ──────────────────────────────────────────────────────────── */

function SettingsContent() {
  const store = useStore();
  const sessionMe = store.sessionMe;
  const blocked = store.blockedUsers();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = () => {
    setSigningOut(true);
    // Server action clears the session cookie and redirects to /login.
    void logOut().catch(() => setSigningOut(false));
  };

  return (
    <div className="px-4 pt-5 pb-8 space-y-7">
      {/* Account */}
      <section>
        <SectionTitle icon={UserCircle}>Account</SectionTitle>
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Mail size={14} className="text-muted-foreground flex-shrink-0" />
            <span className="text-muted-foreground">Signed in as</span>
            <span className="font-semibold truncate">{sessionMe?.email}</span>
          </div>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md border border-border text-sm font-semibold text-foreground hover:border-red-400/60 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            <LogOut size={15} /> {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </section>

      {/* Linked identities */}
      <IdentitiesSection />

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
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      className="flex-shrink-0 px-3 py-1.5 rounded-md border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors"
                    >
                      Unblock
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-w-sm">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Unblock @{u.username}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Their listings and messages become visible again, and
                        they can open deals with you.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          const res = store.unblockUser(u.id);
                          if (!res.ok) {
                            toast.error(res.error);
                            return;
                          }
                          toast.success(`Unblocked @${u.username}`);
                        }}
                      >
                        Unblock
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Moderation — admins only */}
      {sessionMe?.isAdmin && (
        <section>
          <SectionTitle icon={ShieldCheck}>Moderation</SectionTitle>
          <Link
            href="/admin"
            className="flex items-center justify-between bg-card border border-border rounded-lg p-4 card-lift"
          >
            <div>
              <p className="text-sm font-semibold">Moderator dashboard</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Reports, disputes, identity reviews, and community stats.
              </p>
            </div>
            <span className="text-accent text-sm font-semibold">Open →</span>
          </Link>
        </section>
      )}

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
          Poachland v1.0
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
