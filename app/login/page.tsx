"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, ExternalLink, KeyRound, Mail, MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { logInWithPassword, sendMagicLink } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

const RESEND_COOLDOWN_S = 30;

const inputCls =
  "w-full rounded-md bg-input border border-border px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow";

function LoginCard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlError = searchParams.get("error");

  const [mode, setMode] = useState<"magic" | "password">("magic");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(
    urlError === "expired"
      ? "That link expired or was already used — request a fresh one"
      : null,
  );
  const [devLink, setDevLink] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const submitPassword = async () => {
    const trimmed = email.trim();
    if (!trimmed || !password || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await logInWithPassword(trimmed, password);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Full navigation (not router.push): the client store bootstrapped a
      // signed-out snapshot, so a soft navigation would bounce off the auth
      // gate before the next refetch. A fresh load re-bootstraps as us.
      window.location.assign(res.needsOnboarding ? "/onboarding" : "/app");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async () => {
    const trimmed = email.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await sendMagicLink(trimmed);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSent(true);
      setCooldown(RESEND_COOLDOWN_S);
      setDevLink("devLink" in res && res.devLink ? res.devLink : null);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="px-5 py-4">
        <Link
          href="/"
          className="font-display font-black text-xl tracking-tight uppercase"
        >
          Poachland
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-5 pb-16">
        <div className="w-full max-w-sm">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="badge-stamp text-accent border-accent inline-flex mb-5">
              Ultimate Frisbee Only
            </div>
            <h1 className="font-display font-black text-3xl uppercase leading-none tracking-tight mb-2">
              Sign in <span className="text-accent">/</span> join
            </h1>

            {sent ? (
              <>
                <div className="flex items-start gap-3 mt-5 bg-accent/10 border border-accent/40 rounded-md px-3.5 py-3">
                  <MailCheck size={18} className="text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">Check your email</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      We sent a sign-in link to{" "}
                      <span className="text-foreground">{email.trim()}</span>. It
                      expires in 15 minutes.
                    </p>
                  </div>
                </div>

                {devLink && (
                  <a
                    href={devLink}
                    className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-md border border-dashed border-accent/60 text-accent text-sm font-semibold hover:bg-accent/10 transition-colors"
                  >
                    <ExternalLink size={14} /> DEV: open magic link
                  </a>
                )}

                <button
                  type="button"
                  onClick={submit}
                  disabled={cooldown > 0 || submitting}
                  className={cn(
                    "mt-4 w-full py-2.5 rounded-md border border-border text-sm font-semibold transition-colors",
                    cooldown > 0 || submitting
                      ? "text-muted-foreground cursor-not-allowed"
                      : "text-foreground hover:border-accent hover:text-accent",
                  )}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend link"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSent(false);
                    setDevLink(null);
                    setError(null);
                  }}
                  className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
                >
                  Use a different email
                </button>
              </>
            ) : (
              <>
                <div className="flex gap-1 mt-1 mb-4 bg-surface border border-border rounded-md p-1">
                  {(
                    [
                      { key: "magic", label: "Magic link", icon: Mail },
                      { key: "password", label: "Password", icon: KeyRound },
                    ] as const
                  ).map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setMode(key);
                        setError(null);
                      }}
                      className={cn(
                        "flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded text-xs font-semibold transition-colors",
                        mode === key
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon size={13} /> {label}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                  {mode === "magic"
                    ? "We email you a sign-in link — no password needed. New accounts start here."
                    : "Sign in with the password you set in Settings. Forgot it? A magic link always works."}
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void (mode === "magic" ? submit() : submitPassword());
                  }}
                  className="flex flex-col gap-3"
                >
                  <div className="relative">
                    <Mail
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                    />
                    <input
                      type="email"
                      name="email"
                      autoComplete="username email"
                      inputMode="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError(null);
                      }}
                      className={cn(inputCls, "pl-9")}
                      aria-label="Email address"
                    />
                  </div>
                  {mode === "password" && (
                    <div className="relative">
                      <KeyRound
                        size={15}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                      />
                      <input
                        type="password"
                        name="password"
                        autoComplete="current-password"
                        placeholder="Your password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setError(null);
                        }}
                        className={cn(inputCls, "pl-9")}
                        aria-label="Password"
                      />
                    </div>
                  )}
                  {error && <p className="text-xs text-red-400">{error}</p>}
                  <button
                    type="submit"
                    disabled={!email.trim() || (mode === "password" && !password) || submitting}
                    className="w-full inline-flex items-center justify-center gap-2 bg-accent text-accent-foreground font-display font-bold uppercase tracking-wide text-sm px-6 py-3 rounded-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {submitting
                      ? mode === "magic"
                        ? "Sending…"
                        : "Signing in…"
                      : mode === "magic"
                        ? "Email me a link"
                        : "Sign in"}
                    {!submitting && <ArrowRight size={16} />}
                  </button>
                </form>
              </>
            )}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-5 leading-relaxed">
            New here? Same link — your account is created the first time you
            sign in.
          </p>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginCard />
    </Suspense>
  );
}
