"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  Bitcoin,
  CircleDollarSign,
  DollarSign,
  IdCard,
  Landmark,
  LogOut,
  Mail,
  Plus,
  ShieldCheck,
  Smartphone,
  SunMoon,
  Trash2,
  UserCircle,
  Wallet,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { EmailCategory, EmailPrefs } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { logOut, updatePassword } from "@/app/actions/auth";
import { useStore } from "@/lib/store-context";
import { Hydrated } from "@/components/hydrated";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  IDENTITY_PROVIDER_META,
  IDENTITY_STATUS_META,
} from "@/components/identity-chips";
import type { IdentityProvider, PaymentKind } from "@/lib/types";
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

const PAYMENT_KIND_META: Record<
  PaymentKind,
  { label: string; icon: React.ElementType; placeholder: string }
> = {
  venmo: { label: "Venmo", icon: Smartphone, placeholder: "@your-venmo" },
  paypal: { label: "PayPal", icon: CircleDollarSign, placeholder: "you@email.com or paypal.me/you" },
  cashapp: { label: "Cash App", icon: DollarSign, placeholder: "$yourcashtag" },
  zelle: { label: "Zelle", icon: Landmark, placeholder: "email or phone number" },
  crypto: { label: "Crypto", icon: Bitcoin, placeholder: "wallet address" },
  other: { label: "Other", icon: Wallet, placeholder: "handle or address" },
};

const PAYMENT_KINDS = Object.keys(PAYMENT_KIND_META) as PaymentKind[];

/** Keep long values (crypto addresses) readable: trim the middle, not the end. */
function truncateMiddle(value: string, max = 24): string {
  if (value.length <= max) return value;
  return `${value.slice(0, 12)}…${value.slice(-9)}`;
}

const inputCls =
  "w-full rounded-lg bg-input border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow";

function SettingsSkeleton() {
  return (
    <div className="px-4 pt-5 animate-pulse md:grid md:grid-cols-2 md:gap-6">
      <div className="space-y-4">
        <div className="h-32 bg-surface rounded-xl" />
        <div className="h-20 bg-surface rounded-xl" />
      </div>
      <div className="h-40 bg-surface rounded-xl mt-4 md:mt-0" />
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
      <h2 className="font-display font-bold text-xs uppercase tracking-[0.14em] text-muted-foreground">
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
      <SectionTitle icon={IdCard}>Linked identities</SectionTitle>
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
                className="flex items-center gap-3 bg-card border border-border rounded-xl p-3"
              >
                <div className="w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center flex-shrink-0 text-muted-foreground">
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
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-red-700 dark:hover:text-red-400 transition-colors"
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
        className="bg-card border border-border rounded-xl p-3.5 space-y-2.5"
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
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-full bg-accent text-accent-foreground text-sm font-semibold shadow-sm hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={14} /> Link identity
        </button>
      </form>
    </section>
  );
}

/* ── Email notifications ───────────────────────────────────────────────────── */

const EMAIL_CATEGORIES: { key: EmailCategory; label: string; blurb: string }[] = [
  { key: "deals", label: "Deal activity", blurb: "Offers, counters, acceptances, shipping, completions." },
  { key: "messages", label: "Messages", blurb: "When someone messages you (one email per thread until you read it)." },
  { key: "community", label: "Community", blurb: "Wanted-post matches, new ratings, badges you earn." },
  { key: "account", label: "Account & safety", blurb: "Moderation notices, dispute updates, key account changes." },
];

const DEFAULT_EMAIL_PREFS: EmailPrefs = {
  deals: true,
  messages: true,
  community: true,
  account: true,
};

function EmailNotificationsSection() {
  const store = useStore();
  const prefs = store.sessionMe?.emailPrefs ?? DEFAULT_EMAIL_PREFS;

  const toggle = (key: EmailCategory, on: boolean) => {
    const next = { ...prefs, [key]: on };
    const res = store.setEmailPrefs(next);
    if (!res.ok) toast.error(res.error);
  };

  return (
    <section>
      <SectionTitle icon={Mail}>Email notifications</SectionTitle>
      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {EMAIL_CATEGORIES.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{c.label}</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{c.blurb}</p>
            </div>
            <Switch
              checked={prefs[c.key] !== false}
              onCheckedChange={(on) => toggle(c.key, on)}
              aria-label={`${c.label} emails`}
              className="flex-shrink-0 data-[state=checked]:bg-accent"
            />
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
        We only email when something needs you. Every email has a one-tap
        unsubscribe too.
      </p>
    </section>
  );
}

/* ── Payment handles ───────────────────────────────────────────────────────── */

function PaymentHandlesSection() {
  const store = useStore();
  const methods = store.myPaymentMethods();

  const [kind, setKind] = useState<PaymentKind>("venmo");
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");

  const add = () => {
    const res = store.addPaymentMethod({
      kind,
      label: label.trim() || undefined,
      value,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Saved your ${PAYMENT_KIND_META[kind].label} handle`);
    setValue("");
    setLabel("");
  };

  const remove = (id: string, name: string) => {
    const res = store.removePaymentMethod(id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Removed ${name}`);
  };

  return (
    <section>
      <SectionTitle icon={Wallet}>Payment handles</SectionTitle>
      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
        Private. Never shown on your profile. Revealed only to your trade
        partner once a deal is accepted, so you two can settle up.
      </p>

      {methods.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {methods.map((m) => {
            const meta = PAYMENT_KIND_META[m.kind];
            const Icon = meta.icon;
            return (
              <div
                key={m.id}
                className="flex items-center gap-3 bg-card border border-border rounded-xl p-3"
              >
                <div className="w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center flex-shrink-0 text-muted-foreground">
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-semibold font-mono tracking-tight truncate"
                    title={m.value}
                  >
                    {truncateMiddle(m.value)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {meta.label}
                    {m.label ? ` · ${m.label}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(m.id, `your ${meta.label} handle`)}
                  aria-label={`Remove ${meta.label} handle`}
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-red-700 dark:hover:text-red-400 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add handle */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="bg-card border border-border rounded-xl p-3.5 space-y-2.5"
      >
        <div className="flex flex-wrap gap-1.5">
          {PAYMENT_KINDS.map((k) => {
            const meta = PAYMENT_KIND_META[k];
            const Icon = meta.icon;
            const on = kind === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={on}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                  on
                    ? "border-accent bg-accent text-accent-foreground shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon size={12} /> {meta.label}
              </button>
            );
          })}
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={PAYMENT_KIND_META[kind].placeholder}
          maxLength={120}
          className={cn(inputCls, "font-mono")}
          aria-label="Handle or address"
        />
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (optional) — e.g. BTC, personal"
          maxLength={40}
          className={inputCls}
          aria-label="Label"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-full bg-accent text-accent-foreground text-sm font-semibold shadow-sm hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={14} /> Save handle
        </button>
      </form>
    </section>
  );
}

/* ── Password ──────────────────────────────────────────────────────────────── */

function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const store = useStore();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (saving) return;
    if (next.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      const res = await updatePassword(next, hasPassword ? current : undefined);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(hasPassword ? "Password changed." : "Password set. You can use it to sign in now.");
      setOpen(false);
      setCurrent("");
      setNext("");
      setConfirm("");
      void store.refetch(); // pick up hasPassword on the session
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full border border-border text-sm font-semibold text-foreground hover:border-accent hover:text-accent transition-colors"
        >
          {hasPassword ? "Change password" : "Set a password"}
        </button>
        <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
          {hasPassword
            ? "You can sign in with your password or a magic link."
            : "Optional — for password managers and faster sign-ins. Magic links keep working either way."}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="pt-1 space-y-2"
    >
      {/* Hidden username field helps password managers save the right login. */}
      <input
        type="email"
        name="email"
        autoComplete="username email"
        value={store.sessionMe?.email ?? ""}
        readOnly
        hidden
      />
      {hasPassword && (
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className={inputCls}
          aria-label="Current password"
        />
      )}
      <input
        type="password"
        autoComplete="new-password"
        placeholder="New password (8+ characters)"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        className={inputCls}
        aria-label="New password"
      />
      <input
        type="password"
        autoComplete="new-password"
        placeholder="Repeat new password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className={inputCls}
        aria-label="Repeat new password"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !next || !confirm || (hasPassword && !current)}
          className="flex-1 py-2.5 rounded-full bg-accent text-accent-foreground text-sm font-semibold shadow-sm hover:bg-accent/90 transition-colors disabled:opacity-40"
        >
          {saving ? "Saving…" : hasPassword ? "Change password" : "Set password"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-2.5 rounded-full border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
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
      {/* Account + Appearance | Identities — two columns at md+ */}
      <div className="flex flex-col gap-7 md:grid md:grid-cols-2 md:items-start md:gap-6">
        <div className="flex flex-col gap-7">
          {/* Account */}
          <section>
            <SectionTitle icon={UserCircle}>Account</SectionTitle>
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Mail size={14} className="text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">Signed in as</span>
                <span className="font-semibold truncate">{sessionMe?.email}</span>
              </div>
              <PasswordSection hasPassword={!!sessionMe?.hasPassword} />
              <button
                type="button"
                onClick={signOut}
                disabled={signingOut}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full border border-border text-sm font-semibold text-foreground hover:border-red-700/60 hover:text-red-700 dark:hover:border-red-400/60 dark:hover:text-red-400 transition-colors disabled:opacity-50"
              >
                <LogOut size={15} /> {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </section>

          {/* Appearance */}
          <section>
            <SectionTitle icon={SunMoon}>Appearance</SectionTitle>
            <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Day mode by default. Night market if you&apos;re into that.
              </p>
              <ThemeToggle withLabel className="flex-shrink-0" />
            </div>
          </section>

          {/* Email notifications */}
          <EmailNotificationsSection />
        </div>

        {/* Linked identities + payment handles */}
        <div className="flex flex-col gap-7">
          <IdentitiesSection />
          <PaymentHandlesSection />
        </div>
      </div>

      {/* Blocked traders */}
      <section>
        <SectionTitle icon={Ban}>Blocked traders</SectionTitle>
        {blocked.length === 0 ? (
          <p className="text-sm text-muted-foreground bg-card border border-border rounded-xl p-4 text-center">
            Nobody blocked. Keep it that way.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {blocked.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 bg-card border border-border rounded-xl p-3"
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
                      className="flex-shrink-0 px-3.5 py-1.5 rounded-full border border-border bg-card text-[13px] font-medium text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors"
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
            className="flex items-center justify-between bg-card border border-border rounded-xl p-4 card-lift"
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
        <h2 className="font-display font-bold text-xs uppercase tracking-[0.14em] text-muted-foreground mb-2">
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
        <h1 className="font-display font-bold text-xl tracking-tight">
          Settings
        </h1>
      </header>
      <Hydrated fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Hydrated>
    </div>
  );
}
