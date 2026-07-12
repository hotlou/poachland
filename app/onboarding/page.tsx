"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Mail,
  MapPin,
  Plus,
  Repeat2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useHydrated, useStore } from "@/lib/store-context";
import { Hydrated } from "@/components/hydrated";
import { STOCK_AVATARS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/types";

const SUGGESTED_TEAMS = [
  "Brute Squad",
  "Sockeye",
  "Riot",
  "Fury",
  "Revolver",
  "Ring of Fire",
  "Machine",
  "Mixtape",
  "AMP",
  "Truck Stop",
  "Scandal",
  "Johnny Bravo",
];

const TOTAL_STEPS = 4;

/** Mirrors the engine's username normalization so the preview is honest. */
function sanitizeUsername(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 24);
}

const inputCls =
  "w-full rounded-md bg-input border border-border px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow";

export default function OnboardingPage() {
  const router = useRouter();
  const store = useStore();
  const ready = useHydrated();
  const sessionMe = store.sessionMe;

  const [step, setStep] = useState(0);
  const [created, setCreated] = useState<User | null>(null);

  // Session gates: onboarding needs a signed-in user; already-onboarded users
  // (unless they just finished here) go straight to the app.
  const needsLogin = ready && !sessionMe;
  const alreadyOnboarded = ready && !!sessionMe && !sessionMe.needsOnboarding && !created;
  useEffect(() => {
    if (needsLogin) router.replace("/login");
    else if (alreadyOnboarded) router.replace("/app");
  }, [needsLogin, alreadyOnboarded, router]);

  // Step 2 — identity
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [location, setLocation] = useState("");

  // Step 3 — flavor
  const [teams, setTeams] = useState<string[]>([]);
  const [customTeam, setCustomTeam] = useState("");
  const [avatar, setAvatar] = useState<string>(STOCK_AVATARS[0]);
  const [bio, setBio] = useState("");

  // Local availability hint from the snapshot's public users (the server does
  // the authoritative check on dispatch and its rejection surfaces via toast).
  const existing = username.length >= 3 ? store.getUserByUsername(username) : null;
  const usernameTaken = !!existing && existing.id !== sessionMe?.id;
  const identityValid =
    username.length >= 3 && !usernameTaken && displayName.trim().length > 0;

  const allTeamChips = [
    ...SUGGESTED_TEAMS,
    ...teams.filter((t) => !SUGGESTED_TEAMS.includes(t)),
  ];

  const toggleTeam = (team: string) => {
    setTeams((prev) =>
      prev.includes(team) ? prev.filter((t) => t !== team) : [...prev, team],
    );
  };

  const addCustomTeam = () => {
    const team = customTeam.trim();
    if (!team) return;
    setTeams((prev) => (prev.includes(team) ? prev : [...prev, team]));
    setCustomTeam("");
  };

  const handleCreate = () => {
    const res = store.completeOnboarding({
      username,
      displayName,
      location: location.trim(),
      bio,
      favoriteTeams: teams,
      avatar,
    });
    if (!res.ok) {
      toast.error(res.error);
      if (res.error.toLowerCase().includes("username")) {
        setUsernameError(res.error);
        setStep(1); // back to identity to fix the handle
      } else if (res.error.toLowerCase().includes("display name")) {
        setStep(1);
      }
      return;
    }
    setCreated(res.value);
    toast.success(`Welcome to the land, @${res.value.username}`);
  };

  if (!ready || needsLogin || alreadyOnboarded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div
          className="w-8 h-8 rounded-full border-2 border-border border-t-accent animate-spin"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  // ── Success state ───────────────────────────────────────────────────────────
  if (created) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-accent-dim border-2 border-accent flex items-center justify-center mb-6">
          <Check size={30} className="text-accent" strokeWidth={3} />
        </div>
        <div className="badge-stamp text-accent border-accent mb-4">
          Account live
        </div>
        <h1 className="font-display font-black text-4xl uppercase tracking-tight text-balance mb-3">
          Welcome to the land,
          <br />
          <span className="text-accent">@{created.username}</span>
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-8">
          You&apos;re signed in and ready to trade. Post your first listing or
          hit the wanted board — rep is earned one deal at a time.
        </p>
        <button
          onClick={() => router.push("/app")}
          className="inline-flex items-center gap-2 bg-accent text-accent-foreground font-display font-bold uppercase tracking-wide text-base px-8 py-3.5 rounded-sm hover:opacity-90 transition-opacity"
        >
          Enter Poachland <ArrowRight size={18} />
        </button>
      </div>
    );
  }

  // ── Wizard ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-4">
        {step > 0 ? (
          <button
            onClick={() => setStep(step - 1)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Back"
          >
            <ArrowLeft size={16} /> Back
          </button>
        ) : (
          <span className="font-display font-black text-xl tracking-tight uppercase">
            Poachland
          </span>
        )}
        {/* Progress dots */}
        <div className="flex items-center gap-1.5" aria-label={`Step ${step + 1} of ${TOTAL_STEPS}`}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === step ? "w-6 bg-accent" : "w-1.5",
                i < step ? "bg-accent/50" : i > step ? "bg-secondary" : "",
              )}
            />
          ))}
        </div>
      </header>

      <main className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-6 pb-10">
        {/* Step 1 — Welcome */}
        {step === 0 && (
          <div className="flex-1 flex flex-col">
            <div className="badge-stamp text-accent border-accent self-start mb-5">
              Ultimate frisbee only
            </div>
            <h1 className="font-display font-black text-4xl uppercase leading-none tracking-tight text-balance mb-3">
              The collector&apos;s <span className="text-accent">sideline</span>
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed mb-8">
              Trade, sell, or give away jerseys and discs with people who
              actually know what a Brute Squad &apos;22 is worth. No fees, no
              algorithms — trust is the product.
            </p>

            <div className="flex flex-col gap-5 mb-10">
              {[
                {
                  icon: Repeat2,
                  title: "Every deal is a negotiation",
                  desc: "Offer items, add cash, counter until it's fair — or claim free gear outright.",
                },
                {
                  icon: ShieldCheck,
                  title: "Trust you can see",
                  desc: "Ratings on every completed deal roll into a public trust score. Flakes don't last.",
                },
                {
                  icon: Sparkles,
                  title: "The wanted board hunts for you",
                  desc: "Post what you're chasing and get pinged the second a match gets listed.",
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-10 h-10 rounded-sm bg-accent-dim flex items-center justify-center">
                    <Icon size={20} className="text-accent" />
                  </div>
                  <div>
                    <h3 className="font-sans font-semibold text-sm mb-0.5 normal-case tracking-normal">
                      {title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-auto">
              <button
                onClick={() => setStep(1)}
                className="w-full inline-flex items-center justify-center gap-2 bg-accent text-accent-foreground font-display font-bold uppercase tracking-wide text-base px-6 py-3.5 rounded-sm hover:opacity-90 transition-opacity"
              >
                Let&apos;s set you up <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Identity */}
        {step === 1 && (
          <div className="flex-1 flex flex-col">
            <h1 className="font-display font-black text-3xl uppercase tracking-tight mb-1">
              Claim your handle
            </h1>
            <p className="text-sm text-muted-foreground mb-8">
              This is how the community will know you. Choose wisely.
            </p>

            <div className="flex flex-col gap-5">
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Email
                </span>
                <div className="flex items-center gap-2 rounded-md bg-surface border border-border px-3.5 py-2.5 text-sm text-muted-foreground">
                  <Mail size={14} className="flex-shrink-0" />
                  <span className="truncate">{sessionMe?.email}</span>
                  <span className="ml-auto badge-stamp text-accent border-accent flex-shrink-0">
                    Signed in
                  </span>
                </div>
              </div>

              <div>
                <label
                  htmlFor="ob-username"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
                >
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                    @
                  </span>
                  <input
                    id="ob-username"
                    type="text"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="huck_norris"
                    value={username}
                    onChange={(e) => {
                      setUsername(sanitizeUsername(e.target.value));
                      setUsernameError(null);
                    }}
                    className={cn(inputCls, "pl-8")}
                  />
                </div>
                <div className="min-h-5 mt-1.5">
                  <Hydrated>
                    {usernameError ? (
                      <p className="text-xs text-red-400">{usernameError}</p>
                    ) : username.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Lowercase letters, numbers, dots, dashes, underscores.
                      </p>
                    ) : username.length < 3 ? (
                      <p className="text-xs text-muted-foreground">
                        Keep going — at least 3 characters.
                      </p>
                    ) : usernameTaken ? (
                      <p className="text-xs text-red-400">
                        @{username} is taken. Try another.
                      </p>
                    ) : (
                      <p className="text-xs text-accent">
                        @{username} is available ✓
                      </p>
                    )}
                  </Hydrated>
                </div>
              </div>

              <div>
                <label
                  htmlFor="ob-displayname"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
                >
                  Display name
                </label>
                <input
                  id="ob-displayname"
                  type="text"
                  placeholder="Sam Calhoun"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label
                  htmlFor="ob-location"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
                >
                  Location
                </label>
                <div className="relative">
                  <MapPin
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  />
                  <input
                    id="ob-location"
                    type="text"
                    placeholder="Seattle, WA"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className={cn(inputCls, "pl-9")}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Helps traders spot local-only deals. Optional.
                </p>
              </div>
            </div>

            <div className="mt-auto pt-8">
              <button
                onClick={() => setStep(2)}
                disabled={!identityValid}
                className="w-full inline-flex items-center justify-center gap-2 bg-accent text-accent-foreground font-display font-bold uppercase tracking-wide text-base px-6 py-3.5 rounded-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Flavor */}
        {step === 2 && (
          <div className="flex-1 flex flex-col">
            <h1 className="font-display font-black text-3xl uppercase tracking-tight mb-1">
              Rep your colors
            </h1>
            <p className="text-sm text-muted-foreground mb-8">
              Favorite teams show on your profile and help traders talk shop.
            </p>

            <div className="flex flex-col gap-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                  Favorite teams{" "}
                  <span className="normal-case font-normal">(pick any)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {allTeamChips.map((team) => {
                    const selected = teams.includes(team);
                    return (
                      <button
                        key={team}
                        type="button"
                        onClick={() => toggleTeam(team)}
                        aria-pressed={selected}
                        className={cn(
                          "px-3 py-1.5 rounded-sm border text-xs font-semibold transition-colors inline-flex items-center gap-1.5",
                          selected
                            ? "border-accent bg-accent-dim text-accent"
                            : "border-border bg-card text-muted-foreground hover:border-accent/40 hover:text-foreground",
                        )}
                      >
                        {selected && <Check size={12} strokeWidth={3} />}
                        {team}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-3">
                  <input
                    type="text"
                    placeholder="Add your own team…"
                    value={customTeam}
                    onChange={(e) => setCustomTeam(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomTeam();
                      }
                    }}
                    className={cn(inputCls, "flex-1")}
                  />
                  <button
                    type="button"
                    onClick={addCustomTeam}
                    disabled={!customTeam.trim()}
                    aria-label="Add team"
                    className="flex-shrink-0 w-10 rounded-md border border-border bg-card text-muted-foreground hover:text-accent hover:border-accent/40 transition-colors flex items-center justify-center disabled:opacity-40"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                  Pick an avatar
                </p>
                <div className="flex gap-3">
                  {STOCK_AVATARS.map((src) => {
                    const selected = avatar === src;
                    return (
                      <button
                        key={src}
                        type="button"
                        onClick={() => setAvatar(src)}
                        aria-pressed={selected}
                        className={cn(
                          "relative w-16 h-16 rounded-full overflow-hidden border-2 transition-all",
                          selected
                            ? "border-accent ring-2 ring-accent/40"
                            : "border-border opacity-70 hover:opacity-100",
                        )}
                      >
                        {/* plain img: avatars may be data URLs elsewhere in the app */}
                        <img
                          src={src}
                          alt="Avatar option"
                          className="w-full h-full object-cover"
                        />
                        {selected && (
                          <span className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                            <Check
                              size={18}
                              strokeWidth={3}
                              className="text-accent drop-shadow"
                            />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="ob-bio"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
                >
                  Bio{" "}
                  <span className="normal-case font-normal">(optional)</span>
                </label>
                <textarea
                  id="ob-bio"
                  rows={3}
                  maxLength={500}
                  placeholder="Handler with a jersey problem. Hunting anything Sockeye pre-2018."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className={cn(inputCls, "resize-none")}
                />
              </div>
            </div>

            <div className="mt-auto pt-8">
              <button
                onClick={() => setStep(3)}
                className="w-full inline-flex items-center justify-center gap-2 bg-accent text-accent-foreground font-display font-bold uppercase tracking-wide text-base px-6 py-3.5 rounded-sm hover:opacity-90 transition-opacity"
              >
                Continue <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — Review & create */}
        {step === 3 && (
          <div className="flex-1 flex flex-col">
            <h1 className="font-display font-black text-3xl uppercase tracking-tight mb-1">
              Look right?
            </h1>
            <p className="text-sm text-muted-foreground mb-8">
              This is what the community sees. You can change all of it later
              in settings.
            </p>

            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-accent flex-shrink-0">
                  <img
                    src={avatar}
                    alt="Your avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-display font-bold text-lg uppercase tracking-tight leading-tight truncate">
                    {displayName.trim() || "Unnamed trader"}
                  </p>
                  <p className="text-sm text-accent truncate">@{username}</p>
                  {location.trim() && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin size={11} /> {location.trim()}
                    </p>
                  )}
                </div>
              </div>

              {teams.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {teams.map((team) => (
                    <span
                      key={team}
                      className="badge-stamp text-accent border-accent"
                    >
                      {team}
                    </span>
                  ))}
                </div>
              )}

              {bio.trim() && (
                <p className="text-sm text-muted-foreground leading-relaxed border-t border-border pt-3">
                  {bio.trim()}
                </p>
              )}
            </div>

            <div className="mt-auto pt-8">
              <button
                onClick={handleCreate}
                className="w-full inline-flex items-center justify-center gap-2 bg-accent text-accent-foreground font-display font-bold uppercase tracking-wide text-base px-6 py-3.5 rounded-sm hover:opacity-90 transition-opacity"
              >
                Finish setup <Check size={18} strokeWidth={3} />
              </button>
              <p className="text-center text-xs text-muted-foreground mt-4">
                Free forever. No fees, no card, no catch.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
